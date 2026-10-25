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

cases = []
boards = M.BoardCache(torch.device("cpu"))
for seed, (map_id, n) in enumerate([("galilei", 6), ("fermi", 4), ("volta", 8), ("socrates", 3), ("marconi", 7), ("galvani", 5)]):
    e = env_mod.Env(map_id, n, seed=seed)
    pols = [scripted.Scripted(seed * 10 + i) for i in range(n)]
    k = 0
    while not e.done and len(cases) < 8 * (seed + 1) // 1 and k < 400:
        seat, ob = e.decision()
        k += 1
        if k % 23 == 1 or ob["phase"] != 0 and k % 7 == 0:
            g = e.g
            s = g.seats[seat]
            stat, adj = boards.get(map_id)
            dyn, glob, priv, phase, me, mask = M.pack([ob], torch.device("cpu"))
            with torch.no_grad():
                logits, _ = net(dyn, stat, adj, glob, priv, phase, me, mask)
            cases.append({
                "map": map_id, "n": n, "me": seat, "phase": ob["phase"], "turn": g.turn,
                "role": s.role, "pos": s.pos, "fed": s.fed, "reborn": s.reborn, "ability": s.ability,
                "path": [[t, p] for t, p, _ in s.path], "open_pods": sorted(g.open_pods),
                "events": [[ev["turn"], ev["seat"], ev["kind"], ev["cell"], ev["text"]] for ev in g.log],
                "dyn": [[int(c), int(i), int(v)] for c in range(ob["dyn"].shape[0]) for i, v in enumerate(ob["dyn"][c]) if v],
                "glob": [round(float(x), 6) for x in ob["glob"]],
                "mask": [int(i) for i in np.flatnonzero(ob["mask"])],
                "logits": [round(float(x), 5) if x > -1e8 else None for x in logits[0].tolist()],
            })
        e.act(pols[seat].act(e))
cases = cases[::3][:16]
json.dump(cases, open(os.path.join(HERE, "parity.json"), "w"))
print("wrote", len(cases), "cases,", os.path.getsize(os.path.join(HERE, "parity.json")) // 1024, "KB")
