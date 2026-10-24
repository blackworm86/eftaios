"""Plain rule-based players: sparring partners for training and a yardstick for the learner. Public information only."""
import math
import random

import numpy as np


class Scripted:
    def __init__(self, seed=None, temp=0.35):
        self.rng = random.Random(seed)
        self.temp = temp

    def act(self, env):
        g, b = env.g, env.board
        me = g.cur
        s = g.seats[me]
        if g.phase == "attack":
            return int(self._attack(env))
        if g.phase == "decoy":
            return self._decoy(env)
        moves = g.legal_moves()
        scores = [self._score_human(env, c) if s.role == "human" else self._score_alien(env, c) for c in moves]
        top = max(scores)
        w = [math.exp((x - top) / self.temp) for x in scores]
        return self.rng.choices(moves, weights=w)[0]

    # -------------------------------------------------------------- helpers
    def _recent(self, env, kinds, ages=2):
        g = env.g
        return [e for e in g.log if e["cell"] is not None and e["kind"] in kinds and g.turn - e["turn"] < ages and e["seat"] != g.cur]

    def _dist(self, env, c):
        cache = getattr(env, "_dcache", None)
        if cache is None:
            cache = env._dcache = {}
        if c not in cache:
            cache[c] = env._dist_from(c)
        return cache[c]

    def _pod_dist(self, env, c):
        best = 99
        for n, cell in env.board.pod_cell.items():
            if n in env.g.open_pods:
                best = min(best, self._dist(env, cell)[c])
        return best

    def _score_human(self, env, c):
        b = env.board
        if b.kind[c] in "1234":
            return 100.0
        danger = 0.0
        for e in self._recent(env, ("noise", "attack"), 2):
            d = self._dist(env, e["cell"])[c]
            danger += (2.0 if e["kind"] == "attack" else 1.0) * math.exp(-d / 2.0)
        return -1.0 * self._pod_dist(env, c) - 2.0 * danger + (0.3 if b.kind[c] == "s" else 0.0)

    def _score_alien(self, env, c):
        near = 0.0
        for e in self._recent(env, ("noise",), 3):
            d = self._dist(env, e["cell"])[c]
            near += math.exp(-d / 2.5) * (1.0 if env.g.turn - e["turn"] == 0 else 0.7)
        camp = 0.0
        for n, cell in env.board.pod_cell.items():
            if n in env.g.open_pods:
                camp += 0.15 * math.exp(-self._dist(env, cell)[c] / 3.0)
        return 3.0 * near + camp + self.rng.random() * 0.2

    def _attack(self, env):
        g = env.g
        pos = g.seats[g.cur].pos
        for e in self._recent(env, ("noise",), 2):
            if e["cell"] == pos or e["cell"] in env.board.neighbors[pos]:
                return self.rng.random() < 0.55
        return self.rng.random() < 0.08

    def _decoy(self, env):
        g, b = env.g, env.board
        d = self._dist(env, g.seats[g.cur].pos)
        cands = [c for c in range(b.n) if b.kind[c] == "." and 2 <= d[c] <= 5]
        return self.rng.choice(cands) if cands else self.rng.choice([c for c in range(b.n) if b.kind[c] != "x"])
