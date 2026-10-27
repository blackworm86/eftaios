"""The full-rules environment: random legal play through every phase, and the network's output for each phase."""
import os
import random
import sys

import numpy as np
import torch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, maps, model as M  # noqa: E402


def test_random_play_reaches_every_phase_and_the_network_answers():
    rng = random.Random(5)
    net = M.Net(hid=16, layers=2).eval()
    boards = M.BoardCache(torch.device("cpu"))
    seen = set()
    ids = maps.official_ids()
    for seed in range(40):
        e = env_mod.Env(ids[seed % len(ids)], 2 + seed % 7, seed=seed)
        keep = []
        while not e.done:
            seat, ob = e.decision()
            seen.add(ob["phase"])
            m = ob["mask"]
            assert m.any(), (ob["phase"],)
            if len(keep) < 3 and ob["phase"] in (3, 4, 5, 6):
                keep.append(ob)
            legal = np.flatnonzero(m)
            # item-happy random play: take an action rather than NONE most of the time
            a = int(rng.choice(legal[1:] if ob["phase"] in (3, 4) and len(legal) > 1 and rng.random() < 0.8 else legal))
            e.act(a)
        for ob in keep:
            stat, adj = boards.get(ob["map"])
            dyn, glob, priv, phase, me, mask = M.pack([ob], torch.device("cpu"))
            with torch.no_grad():
                logits, v = net(dyn, stat, adj, glob, priv, phase, me, mask)
            assert torch.isfinite(v).all() and (logits[0][mask[0]] > -1e8).all() and (logits[0][~mask[0]] < -1e8).all()
    assert seen == {0, 1, 2, 3, 4, 5, 6}, seen


if __name__ == "__main__":
    test_random_play_reaches_every_phase_and_the_network_answers()
    print("ok full env")
