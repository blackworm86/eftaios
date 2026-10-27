"""Turns the engine into decisions for a learner: observations (public information + the seat's own private state), masks and rewards.

The policy sees only what a player at that seat could know. `priv` (the truth about the others) is for the training-time critic only.
"""
import math

import numpy as np

from . import engine
from . import maps as maps_mod

D_DYN = 37   # per-cell dynamic channels, uint8: 0 me, 1 legal targets, 2 open pods, 3-18 announcement heat, 19-25 per-player traces, 26 my path, 27 walk to a pod, 28 walk from me, 29-36 Spotlight / Sensor reveal heat
D_STAT = 9   # per-cell static channels: wall, dangerous, secure, H, A, pod1-4
G_DIM = 260  # global vector: 0-93 as before, 96-105 my items, 106-121 my Character, 122-125 power used / Adrenaline / Cat / noises still to name, 127+ seven slots of 19 (known side, cards played, known Character)
P_DIM = 40   # critic-only privileged vector
SLOTS = 7    # other seats, in turn order after this one
AGES = 8     # turns of announcement history kept as heat maps
PHASES = {"move": 0, "attack": 1, "decoy": 2, "pre": 3, "post": 4, "target_cell": 5, "target_seat": 6}
ITEMS = ["adrenaline", "sedatives", "attack", "cat", "spotlight", "teleport", "defense", "clone", "sensor", "mutation"]
CHARS = engine.HUMAN_CHARS + engine.ALIEN_CHARS
KIND_IDX = {"noise": 0, "attack": 1, "silence-secure": 2, "silence": 3}

REWARD = {"escape": 0.5, "kill": 0.2, "friendly": -0.3, "win": 1.0, "progress": 0.05}  # progress: per step a Human gets nearer to an open pod (and minus per step further)


def static_channels(board):
    k = board.kind
    ch = [k == "x", k == ".", k == "s", k == "H", k == "A"] + [k == str(n) for n in (1, 2, 3, 4)]
    return np.stack(ch, 0).astype(np.float32)  # (9, N)


class Env:
    """One game. Call decision() to see whose turn it is and what they see, then act(action)."""

    def __init__(self, map_id, n, seed=None, ultimate=True, roles=None, full=True):
        self._setup(engine.Game(map_id, n, seed=seed, ultimate=ultimate, roles=roles, full=full))

    @classmethod
    def wrap(cls, game):
        """An Env around a game that already exists (the teacher recordings replay one)."""
        e = cls.__new__(cls)
        e._setup(game)
        return e

    def _setup(self, g):
        self.g = g
        self.n = g.n
        self.board = g.board
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
        if g.phase in ("pre", "post"):
            m = np.zeros(self.board.n, bool)
            m[g.acts()] = True
            return m
        if g.phase == "target_cell":
            return self.board.kind != "x"
        if g.phase == "target_seat":
            m = np.zeros(self.board.n, bool)
            m[[self._slot_of(g.cur, j) for j in g.target_seats()]] = True
            return m
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
        elif g.phase in ("pre", "post"):
            g.step_act(int(action))
        elif g.phase == "target_cell":
            g.step_target_cell(int(action))
        elif g.phase == "target_seat":
            g.step_target_seat((me + 1 + int(action)) % self.n)   # the action is the slot: seats counted on from this one
        else:
            g.step_decoy(int(action))
        r = 0.0
        if d0 is not None and g.seats[me].over is None:  # a step nearer to a pod is rewarded, a step away is not (it adds up to nothing over a round trip)
            r += REWARD["progress"] * (d0 - self.pod_distance(g.seats[me].pos))
        new = g.log[before_log:]
        hit = any(e["kind"] == "attack" and e["seat"] == me for e in new)   # kills in this step are the actor's own attack
        mine = "alien" if g.seats[me].role0 == "alien" or g.seats[me].reborn else "human"
        for e in new:
            if e["kind"] == "out" and e["text"].startswith("killed|human") and e["seat"] != me and hit:
                r += REWARD["kill"] if mine == "alien" else REWARD["friendly"]
            elif e["kind"] == "out" and e["text"].startswith("killed|alien") and e["seat"] != me and hit:
                r += REWARD["friendly"] if mine == "alien" else REWARD["kill"]
            elif e["kind"] == "out" and e["text"].startswith("escaped") and e["seat"] == me:
                r += REWARD["escape"]
        return r

    def pod_distance(self, cell):
        """Steps a Human needs from `cell` to the nearest open pod (walls, start sectors and other pods are not walked through)."""
        return int(self._pod_dist_map()[cell])

    def _pod_dist_map(self):
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
        return d

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
        if g.phase in ("move", "decoy", "target_cell"):
            dyn[1, mask] = 1
        for n_, cell in b.pod_cell.items():
            if n_ in g.open_pods:
                dyn[2, cell] = 1
        slot_trace = np.zeros((SLOTS, N), np.float32)
        last = {}
        for age, e in self._events():
            if e["cell"] is not None and e["kind"] in ("noise", "attack") and age < AGES:
                dyn[3 + age if e["kind"] == "noise" else 11 + age, e["cell"]] += 1
            if e["kind"] == "reveal" and e["cell"] is not None and age < AGES:
                dyn[29 + age, e["cell"]] += 1
            if e["seat"] != me and e["cell"] is not None and e["kind"] in ("noise", "attack", "reveal"):
                sl = self._slot_of(me, e["seat"])
                slot_trace[sl, e["cell"]] = max(slot_trace[sl, e["cell"]], 0.75 ** age)
            if e["seat"] != me and e["kind"] in ("noise", "attack", "silence"):
                key = "silence-secure" if (e["kind"] == "silence" and e["text"] == "secure") else e["kind"]
                last[e["seat"]] = (age, key)
        dyn[3:19] = np.minimum(dyn[3:19], 1)
        dyn[29:37] = np.minimum(dyn[29:37], 1)
        dyn[19:19 + SLOTS] = slot_trace
        for k, (_, pos, _) in enumerate(reversed(s.path[-6:])):
            dyn[26, pos] = max(dyn[26, pos], 0.8 ** k)
        # distances: a 4-layer graph network sees only 4 steps around a sector, so the walk to the nearest open pod and the walk from me are given
        pd = self._pod_dist_map()
        dyn[27] = np.clip(1.0 - pd / 30.0, 0, 1) * (b.kind != "x")
        for cell, steps in b.reachable(s.pos, 99, s.role, g.open_pods).items():
            dyn[28, cell] = max(0.0, 1.0 - steps / 20.0)
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
        for k, name in enumerate(ITEMS):
            glob[96 + k] = s.items.count(name) / engine.ITEM_COUNTS[name]
        if s.ability in CHARS:
            glob[106 + CHARS.index(s.ability)] = 1
        glob[122] = float(s.ability in s.used or (s.ability == "Captain" and s.captain_used))
        glob[123], glob[124], glob[125] = float(s.adr), float(s.cat), g.decoys_left / 2
        known_role, known_char, played = {}, {}, {}
        for e in g.log:
            j, t = e["seat"], e["text"]
            if e["kind"] == "reveal" and t.startswith("Id|"):
                _, role, ch = t.split("|")
                known_role[j], known_char[j] = role, ch
            elif e["kind"] == "reveal" and t in ("Brute Alien", "Invisible Alien"):
                known_role[j], known_char[j] = "alien", t
            elif e["kind"] == "out":
                why, role, ch = t.split("|")
                known_role[j] = "alien" if why == "killed" and role == "human" else role
                if ch:
                    known_char[j] = ch
            elif e["kind"] == "item":
                played[j] = played.get(j, 0) + 1
        for j in range(self.n):
            if j == me:
                continue
            base = 127 + self._slot_of(me, j) * 19
            if known_role.get(j) == "human":
                glob[base] = 1
            elif known_role.get(j) == "alien" or g.seats[j].reborn:
                glob[base + 1] = 1
            glob[base + 2] = min(played.get(j, 0), 3) / 3
            if known_char.get(j) in CHARS:
                glob[base + 3 + CHARS.index(known_char[j])] = 1
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
