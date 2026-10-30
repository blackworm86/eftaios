"""The teacher recordings: decisions of the app's Hard bot (tools/sim.js --teach), turned into training rows by replaying every game in the Python rules.

Each row is what the seat could see at one decision (observation), the action the Hard bot took there, and the final result for the seat's side.
Moves, Alien attacks, decoys, and the new decisions of the full rules: playing an Item or a power before the move or after it, and its targets.
The big distance channels (27, 28) are not stored; they are rebuilt per batch.
"""
import glob as globmod
import gzip
import json
import os

import pickle

import numpy as np

from . import engine, replay
from . import env as env_mod
from . import maps as maps_mod

N_CELLS = 322
KEEP = [c for c in range(env_mod.D_DYN) if c not in (27, 28)]


def code_version():
    """The rules and the observation layout, so a cache made by older code is not trusted."""
    return (env_mod.D_DYN, env_mod.G_DIM, os.path.getsize(replay.__file__), os.path.getsize(env_mod.__file__), os.path.getsize(engine.__file__))


class Teacher:
    def __init__(self, paths, ids, log=None, cache=None):
        """cache: a file where the replayed rows are kept (replaying takes minutes), valid while the recordings are unchanged."""
        paths = [paths] if isinstance(paths, str) else list(paths)
        stamp = [(os.path.basename(p), os.path.getsize(p)) for p in paths] + [code_version()]
        if cache and os.path.exists(cache):
            try:
                with open(cache, "rb") as f:
                    saved = pickle.load(f)
                if saved["stamp"] == stamp and saved["ids"] == ids:
                    self.__dict__.update(saved["state"])
                    return
            except Exception:
                pass
        self._build(paths, ids, log)
        if cache:
            with open(cache + ".tmp", "wb") as f:
                pickle.dump({"stamp": stamp, "ids": ids, "state": self.__dict__}, f, protocol=4)
            os.replace(cache + ".tmp", cache)

    def _build(self, paths, ids, log):
        self.ids = ids
        self.sp, self.extra, self.mask_bits = [], [], []
        cols = {k: [] for k in ("map", "phase", "me", "role", "action", "game", "glob", "priv", "seat", "ret")}
        for fi, path in enumerate(paths):
            for gi, rec in enumerate(replay.read(path)):
                n0 = len(self.sp)
                try:
                    self._add(rec, fi * 100000 + gi, cols, ids)
                except AssertionError:   # a game the rules cannot follow (the bot once used a Medic on a player already out): left out whole
                    for lst in (self.sp, self.extra, self.mask_bits, *cols.values()):
                        del lst[n0:]
                    self.skipped = getattr(self, "skipped", 0) + 1
                if log and gi and gi % 500 == 0:
                    log("replayed %d games (%d decisions)" % (gi, len(self.sp)))
        for k, v in cols.items():
            setattr(self, k, np.array(v, np.float32 if k in ("ret",) else (np.float16 if k in ("glob", "priv") else np.int64)))
        self.ret = self.ret.astype(np.float32)

    def _add(self, rec, game_id, cols, ids):
        first = len(self.sp)
        seen = {}

        def on(g, phase, action):
            e = seen.get("env")
            if e is None:
                e = seen["env"] = env_mod.Env.wrap(g)
            seat, ob = e.decision()
            dyn = ob["dyn"]
            flat = dyn[KEEP].reshape(-1)
            idx = np.flatnonzero(flat)
            self.sp.append((idx.astype(np.int32), flat[idx]))
            self.extra.append(dyn[27:29].copy())
            m = np.zeros(N_CELLS, bool)
            m[:len(ob["mask"])] = ob["mask"]
            self.mask_bits.append(np.packbits(m))
            if phase == "target_seat":
                action = (action - seat - 1) % g.n    # slot, as the environment counts them
            cols["map"].append(ids.index(rec["map"]))
            cols["phase"].append(ob["phase"])
            cols["me"].append(ob["me"])
            cols["role"].append(ob["role"])
            cols["action"].append(int(action))
            cols["game"].append(game_id)
            cols["glob"].append(ob["glob"])
            cols["priv"].append(ob["priv"])
            cols["seat"].append(seat)

        g = replay.play(rec, on)
        aw = g.result["aliens_win"]
        for k in range(first, len(self.sp)):   # the result by the rules, for the side the seat was on at that decision (a killed Human has lost)
            s = g.seats[cols["seat"][k]]
            cols["ret"].append((1.0 if aw else -1.0) if cols["role"][k] == 1 else (1.0 if s.over == "escaped" else -1.0))

    def __len__(self):
        return len(self.sp)

    def dyn(self, k):
        d = np.zeros((env_mod.D_DYN, N_CELLS), np.uint8)
        i, v = self.sp[k]
        part = np.zeros(len(KEEP) * N_CELLS, np.uint8)
        part[i] = v
        d[KEEP] = part.reshape(len(KEEP), N_CELLS)
        d[27:29] = self.extra[k]
        return d

    def mask(self, k):
        return np.unpackbits(self.mask_bits[k])[:N_CELLS].astype(bool)

    def batch(self, idx):
        """Arrays for the network, in the order bc_update reads them."""
        return {"dyn": np.stack([self.dyn(k) for k in idx]), "glob": self.glob[idx].astype(np.float32), "priv": self.priv[idx].astype(np.float32),
                "phase": self.phase[idx], "me": self.me[idx], "mask": np.stack([self.mask(k) for k in idx]), "action": self.action[idx],
                "ret": self.ret[idx], "map": self.map[idx]}
