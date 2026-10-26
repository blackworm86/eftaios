"""Plays a few games with the current network at every seat and writes them for the game viewer in the app (Admin > Games).

File format (format 1): {"format": 1, "source": text, "made": date, "games": [{"map", "n", "turns", "result": {"aliens_win", "reason", "escaped": [seat]},
"seats": [{"role0", "role", "char", "over", "route": [[turn, cell, note]]}], "log": [[turn, seat, kind, cell, text]]}]} with cell = row * 23 + column.
"""
import json
import os
import random
import time

import torch

from . import env as env_mod
from . import maps as maps_mod
from . import report, rollout


def make(run_dir, games=12, seed=None):
    ck = torch.load(os.path.join(run_dir, "latest.pt"), map_location="cpu")
    rollout.init_worker()
    net = rollout._net(ck["cfg"], ck["net"])
    rng = random.Random(seed)
    ids = maps_mod.official_ids()
    out = []
    for k in range(games):
        n = [3, 4, 5, 6, 7, 8][k % 6]
        env = env_mod.Env(rng.choice(ids), n, seed=rng.getrandbits(32))
        while not env.done:
            _, ob = env.decision()
            env.act(rollout.net_act(net, ob)[0])
        g = env.g
        out.append({
            "map": g.board.id, "n": n, "turns": g.turn,
            "result": {"aliens_win": g.result["aliens_win"], "reason": g.result["reason"], "escaped": g.result["escaped"]},
            "seats": [{"role0": s.role0, "role": s.role, "char": s.char, "over": s.over, "route": [[t, p, note[:1]] for t, p, note in s.path]} for s in g.seats],
            "log": [[e["turn"], e["seat"], e["kind"], e["cell"], e["text"]] for e in g.log],
        })
    data = {"format": 1, "source": "network, iteration %d, every seat played by the network" % report.iteration(run_dir), "made": time.strftime("%Y-%m-%d %H:%M"), "games": out}
    path = os.path.join(run_dir, "samples.json")
    json.dump(data, open(path, "w"), separators=(",", ":"))
    return path, data
