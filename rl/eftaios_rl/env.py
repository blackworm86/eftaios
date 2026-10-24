"""Turns the engine into decisions for a learner: observations (public information + the seat's own private state), masks and rewards.

The policy sees only what a player at that seat could know. `priv` (the truth about the others) is for the training-time critic only.
"""
import math

import numpy as np

from . import engine
from . import maps as maps_mod

D_DYN = 27   # per-cell dynamic channels, uint8 (see _dyn)
D_STAT = 9   # per-cell static channels: wall, dangerous, secure, H, A, pod1-4
G_DIM = 96   # global vector
P_DIM = 40   # critic-only privileged vector
SLOTS = 7    # other seats, in turn order after this one
AGES = 8     # turns of announcement history kept as heat maps
PHASES = {"move": 0, "attack": 1, "decoy": 2}
KIND_IDX = {"noise": 0, "attack": 1, "silence-secure": 2, "silence": 3}

REWARD = {"escape": 0.5, "kill": 0.2, "friendly": -0.3, "win": 1.0, "progress": 0.05}  # progress: per step a Human gets nearer to an open pod (and minus per step further)


def static_channels(board):
    k = board.kind
    ch = [k == "x", k == ".", k == "s", k == "H", k == "A"] + [k == str(n) for n in (1, 2, 3, 4)]
    return np.stack(ch, 0).astype(np.float32)  # (9, N)


class Env:
    """One game. Call decision() to see whose turn it is and what they see, then act(action)."""

    def __init__(self, map_id, n, seed=None, ultimate=True, roles=None):
        self.g = engine.Game(map_id, n, seed=seed, ultimate=ultimate, roles=roles)
        self.n = n
        self.board = self.g.board
        self._log_seen = 0
        self._pod_dist_cache = {}

    # ---------------------------------------------------------------- state
    @property
    def done(self):
        return self.g.phase == "over"

    @property
    def seat(self):
        return self.g.cur

    @property
    def phase(self):
        return self.g.phase

    def legal_mask(self):
        """Boolean mask over cells (move / decoy) for the current decision; for attack: [no, yes]."""
        g = self.g
        if g.phase == "move":
            m = np.zeros(self.board.n, bool)
            m[g.legal_moves()] = True
            return m
        if g.phase == "decoy":
            return self.board.kind != "x"
        return np.ones(2, bool)

    def act(self, action):
        """Apply the current decision. Returns (reward for the seat that acted)."""
        g = self.g
        me = g.cur
        before_log = len(g.log)
        d0 = self.pod_distance(g.seats[me].pos) if (g.phase == "move" and g.seats[me].role == "human") else None
        if g.phase == "move":
            g.step_move(int(action))
        elif g.phase == "attack":
            g.step_attack(bool(action))
        else:
            g.step_decoy(int(action))
        r = 0.0
        if d0 is not None and g.seats[me].over is None:  # a step nearer to a pod is rewarded, a step away is not (it adds up to nothing over a round trip)
            r += REWARD["progress"] * (d0 - self.pod_distance(g.seats[me].pos))
        for e in g.log[before_log:]:
            if e["kind"] == "out" and e["text"].startswith("killed|human") and e["seat"] != me and g.seats[me].role == "alien":
                r += REWARD["kill"]
            elif e["kind"] == "out" and e["text"].startswith("killed|alien") and e["seat"] != me:
                r += REWARD["friendly"]
            elif e["kind"] == "out" and e["text"].startswith("escaped") and e["seat"] == me:
                r += REWARD["escape"]
        return r

    def pod_distance(self, cell):
        """Steps a Human needs from `cell` to the nearest open pod (walls, start sectors and other pods are not walked through)."""
        key = frozenset(self.g.open_pods)
        d = self._pod_dist_cache.get(key)
        if d is None:
            b = self.board
            d = np.full(b.n, 40, np.int32)
            q = [b.pod_cell[n] for n in key]
            for c in q:
                d[c] = 0
            for c in q:
                for nb in b.neighbors[c]:
                    if d[nb] == 40 and b.kind[nb] not in "xHA1234":
                        d[nb] = d[c] + 1
                        q.append(nb)
            self._pod_dist_cache[key] = d
        return int(d[cell])

    def final_rewards(self):
        """Terminal reward per seat: +1 for the side the seat ends on if it won, -1 otherwise."""
        res = self.g.result
        out = []
        for s in self.g.seats:
            alien_side = s.role == "alien"
            out.append(REWARD["win"] if (res["aliens_win"] == alien_side) else -REWARD["win"])
        return out

    # ---------------------------------------------------------------- observation
    def _events(self):
        """Public events with their age in turns."""
        t = self.g.turn
        return [(t - e["turn"], e) for e in self.g.log]

    def _slot_of(self, me, j):
        return (j - me - 1) % self.n  # 0 .. n-2

    def decision(self):
        """(seat, observation dict) for the seat on the move."""
        g, b, me = self.g, self.board, self.g.cur
        s = g.seats[me]
        N = b.n
        dyn = np.zeros((D_DYN, N), np.float32)
        dyn[0, s.pos] = 1
        mask = self.legal_mask()
        if g.phase != "attack":
            dyn[1, mask] = 1
        for n_, cell in b.pod_cell.items():
            if n_ in g.open_pods:
                dyn[2, cell] = 1
        slot_trace = np.zeros((SLOTS, N), np.float32)
        last = {}
        for age, e in self._events():
            if e["cell"] is not None and e["kind"] in ("noise", "attack") and age < AGES:
                dyn[3 + age if e["kind"] == "noise" else 11 + age, e["cell"]] += 1
            if e["seat"] != me and e["cell"] is not None and e["kind"] in ("noise", "attack"):
                sl = self._slot_of(me, e["seat"])
                slot_trace[sl, e["cell"]] = max(slot_trace[sl, e["cell"]], 0.75 ** age)
            if e["seat"] != me and e["kind"] in ("noise", "attack", "silence"):
                key = "silence-secure" if (e["kind"] == "silence" and e["text"] == "secure") else e["kind"]
                last[e["seat"]] = (age, key)
        dyn[3:19] = np.minimum(dyn[3:19], 1)
        dyn[19:19 + SLOTS] = slot_trace
        for k, (_, pos, _) in enumerate(reversed(s.path[-6:])):
            dyn[26, pos] = max(dyn[26, pos], 0.8 ** k)
        glob = np.zeros(G_DIM, np.float32)
        glob[0 if s.role == "human" else 1] = 1
        glob[2], glob[3], glob[4] = float(s.fed), float(s.reborn), g.turn / engine.MAX_TURN
        glob[5 + PHASES[g.phase]] = 1
        glob[8] = sum(o.over is not None for o in g.seats) / self.n
        glob[9] = len(g.open_pods) / 4
        glob[10] = sum(o.reborn for o in g.seats) / self.n
        glob[11] = sum(o.over == "escaped" for o in g.seats) / self.n
        for k, ab in enumerate(["Fast Alien", "Psychic Alien", "Captain", "Engineer", "Brute Alien"]):
            glob[12 + k] = float(s.ability == ab)
        for j, o in enumerate(g.seats):
            if j == me:
                continue
            sl = self._slot_of(me, j)
            base = 17 + sl * 11
            glob[base] = float(o.over is None)
            glob[base + 1] = float(o.over == "escaped")
            glob[base + 2] = float(o.over == "dead")
            glob[base + 3] = float(o.reborn)  # a Human killed or mutated is public: it is an Alien now
            if j in last:
                age, key = last[j]
                glob[base + 4 + KIND_IDX[key]] = 1
                glob[base + 8] = min(age, 8) / 8
            else:
                glob[base + 8] = 1
            glob[base + 9] = sum(1 for e in g.log if e["seat"] == j and e["kind"] == "attack") > 0  # attacked: an Alien
            glob[base + 10] = sum(1 for e in g.log if e["seat"] == j and e["cell"] is not None) / 10
        priv = np.zeros(P_DIM, np.float32)
        dist = self._dist_from(s.pos)
        for j, o in enumerate(g.seats):
            if j == me:
                continue
            sl = self._slot_of(me, j)
            priv[sl * 5:sl * 5 + 5] = [o.role == "alien", o.reborn, min(dist[o.pos], 20) / 20, dist[o.pos] <= 3, o.fed]
        priv[35] = sum(o.role == "alien" and o.over is None for o in g.seats) / self.n
        priv[36] = sum(o.role == "human" and o.over is None for o in g.seats) / self.n
        return me, {
            "map": b.id, "phase": PHASES[g.phase], "dyn": (dyn * 255).astype(np.uint8), "glob": glob, "priv": priv,
            "mask": mask, "me": s.pos, "role": 0 if s.role == "human" else 1,
        }

    def _dist_from(self, src):
        n = self.board.n
        d = np.full(n, 99, np.int32)
        d[src] = 0
        q = [src]
        for c in q:
            for nb in self.board.neighbors[c]:
                if d[nb] == 99 and self.board.kind[nb] != "x":
                    d[nb] = d[c] + 1
                    q.append(nb)
        return d
