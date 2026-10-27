"""Writes tests/parity.json and tests/parity-net.json: a small random network and some real game states with the exact inputs (observation
vectors) and outputs (logits) of the Python code, so tests/parity.test.js can check that the app's JavaScript player gives the same numbers.
    python tests/make_parity.py"""
import json
import os
import sys

import numpy as np
import torch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, maps, model as M, scripted  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
torch.manual_seed(0)
net = M.Net(hid=16, layers=2).eval()
json.dump({"format": 1, "hid": 16, "layers": 2, "iteration": 0,
           "weights": {k: {"shape": list(v.shape), "data": [round(float(x), 7) for x in v.flatten().tolist()]} for k, v in net.state_dict().items()}},
          open(os.path.join(HERE, "parity-net.json"), "w"))

import random

cases = []
boards = M.BoardCache(torch.device("cpu"))
rng = random.Random(3)
want_phase = {k: 0 for k in range(7)}
for seed, (map_id, n) in enumerate([("galilei", 6), ("fermi", 4), ("volta", 8), ("socrates", 3), ("marconi", 7), ("galvani", 5), ("galilei", 8), ("fermi", 7)]):
    e = env_mod.Env(map_id, n, seed=seed)
    k = 0
    while not e.done and k < 600:
        seat, ob = e.decision()
        k += 1
        ph = ob["phase"]
        if (k % 131 == 1 and ph < 3) or (ph >= 3 and want_phase[ph] < 6 and rng.random() < 0.4):
            want_phase[ph] += 1
            g = e.g
            s = g.seats[seat]
            stat, adj = boards.get(map_id)
            dyn, glob, priv, phase, me, mask = M.pack([ob], torch.device("cpu"))
            with torch.no_grad():
                logits, _ = net(dyn, stat, adj, glob, priv, phase, me, mask)
            cases.append({
                "map": map_id, "n": n, "me": seat, "phase": ph, "turn": g.turn,
                "role": s.role, "pos": s.pos, "fed": s.fed, "reborn": s.reborn, "ability": s.ability,
                "items": list(s.items), "power_used": bool(s.ability in s.used or (s.ability == "Captain" and s.captain_used)), "adr": s.adr, "cat": s.cat, "decoys": g.decoys_left,
                "path": [[t, p] for t, p, _ in s.path], "open_pods": sorted(g.open_pods),
                "events": [[ev["turn"], ev["seat"], ev["kind"], ev["cell"], ev["text"]] for ev in g.log],
                "dyn": [[int(c), int(i), int(v)] for c in range(ob["dyn"].shape[0]) for i, v in enumerate(ob["dyn"][c]) if v],
                "glob": [round(float(x), 6) for x in ob["glob"]],
                "mask": [int(i) for i in np.flatnonzero(ob["mask"])],
                "logits": [round(float(x), 5) if x > -1e8 else None for x in logits[0].tolist()],
            })
        legal = np.flatnonzero(ob["mask"])
        a = int(rng.choice(legal[1:] if ph in (3, 4) and len(legal) > 1 and rng.random() < 0.7 else legal))
        e.act(a)
print("cases per phase", want_phase)
json.dump(cases, open(os.path.join(HERE, "parity.json"), "w"))
print("wrote", len(cases), "cases,", os.path.getsize(os.path.join(HERE, "parity.json")) // 1024, "KB")
