"""The teacher recordings: decisions of the app's Hard bot (tools/sim.js --teach), stored in the network's input format.

A file is gzipped JSON lines, one decision each: seat, map, n, ph (0 move, 1 attack, 2 decoy), role (0 human, 1 alien), me (cell), a (action: a cell,
or 0/1 for an attack), t (turn), d (public channels 0-26 as flat [index, value] pairs), g (global vector), p (critic-only vector), ret (+1/-1 for the seat's side).
Channels 27 and 28 are distances and are rebuilt here, so the files stay small.
"""
import gzip
import json

import numpy as np

from . import env as env_mod
from . import maps as maps_mod

N_CELLS = 322


class Teacher:
    def __init__(self, paths, ids, log=None):
        self.ids = ids
        self.boards = {i: maps_mod.get(i) for i in ids}
        self.sp = []      # per decision: (flat indexes, values) of the public channels
        self.maps, self.me, self.game = [], [], []
        cols = {k: [] for k in ("ph", "role", "a", "ret", "g", "p")}
        for fi, path in enumerate([paths] if isinstance(paths, str) else paths):
            with gzip.open(path, "rt") as f:
                for line in f:
                    if not line.strip():
                        continue
                    r = json.loads(line)
                    d = r["d"]
                    self.sp.append((np.array(d[0::2], np.int32), np.array(d[1::2], np.uint8)))
                    self.maps.append(r["map"])
                    self.me.append(r["me"])
                    self.game.append(fi * 100000 + r.get("game", 0))   # decisions of one game share an id
                    for k in cols:
                        cols[k].append(r[k])
        n = len(self.sp)
        self.map = np.array([ids.index(m) for m in self.maps])
        self.me = np.array(self.me)
        self.game = np.array(self.game)
        self.phase, self.role, self.action = (np.array(cols[k]) for k in ("ph", "role", "a"))
        self.ret = np.array(cols["ret"], np.float32)
        self.glob = np.array(cols["g"], np.float32)
        self.priv = np.array(cols["p"], np.float32)
        self.extra = np.zeros((n, 2, N_CELLS), np.uint8)   # channels 27, 28
        for k in range(n):
            self.extra[k] = self._dist(k)
            if log and k and k % 50000 == 0:
                log("prepared %d of %d decisions" % (k, n))

    def __len__(self):
        return len(self.sp)

    def _sparse(self, k):
        dyn = np.zeros((env_mod.D_DYN, N_CELLS), np.uint8)
        i, v = self.sp[k]
        dyn.reshape(-1)[i] = v
        return dyn

    def _dist(self, k):
        b = self.boards[self.maps[k]]
        dyn = self._sparse(k)
        open_pods = {int(b.kind[c]) for c in np.flatnonzero(dyn[2])}
        pd = np.full(b.n, 40, np.int32)
        q = [b.pod_cell[n] for n in open_pods]
        for c in q:
            pd[c] = 0
        for c in q:
            for nb in b.neighbors[c]:
                if pd[nb] == 40 and b.kind[nb] not in "xHA1234":
                    pd[nb] = pd[c] + 1
                    q.append(nb)
        out = np.zeros((2, b.n), np.uint8)
        out[0] = (np.clip(1.0 - pd / 30.0, 0, 1) * (b.kind != "x") * 255).astype(np.uint8)
        for cell, steps in b.reachable(int(self.me[k]), 99, "human" if self.role[k] == 0 else "alien", open_pods).items():
            out[1, cell] = int(max(0.0, 1.0 - steps / 20.0) * 255)
        return out

    def dyn(self, k):
        d = self._sparse(k)
        d[27:29] = self.extra[k]
        return d

    def mask(self, k):
        m = np.zeros(N_CELLS, bool)
        if self.phase[k] == 1:
            m[:2] = True
        elif self.phase[k] == 2:
            m[:] = self.boards[self.maps[k]].kind != "x"
        else:
            m[self._sparse(k)[1] > 0] = True
        return m

    def batch(self, idx):
        """Arrays for the network, in the order bc_update reads them."""
        return {"dyn": np.stack([self.dyn(k) for k in idx]), "glob": self.glob[idx], "priv": self.priv[idx], "phase": self.phase[idx], "me": self.me[idx],
                "mask": np.stack([self.mask(k) for k in idx]), "action": self.action[idx], "ret": self.ret[idx], "map": self.map[idx]}
