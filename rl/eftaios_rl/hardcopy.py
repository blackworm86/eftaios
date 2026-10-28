"""The Hard copy: the network distilled from the Hard bot (menu item 9). It is the fixed reference of the training that follows:
the network is pulled towards it, it plays as an opponent, and every checkpoint is measured against it.
Its weights come from the run (pool/teacher.pt, saved when the distillation finished) or, when that is gone, from data/hardcopy.json."""
import json
import os

import torch

FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "hardcopy.json")   # inside rl/: the trainer folder on your PC holds only rl/


def weights(run_dir):
    p = os.path.join(run_dir, "pool", "teacher.pt")
    if os.path.exists(p):
        return torch.load(p, map_location="cpu")
    blob = json.load(open(FILE, encoding="utf-8"))
    return {k: torch.tensor(v["data"], dtype=torch.float32).reshape(v["shape"]) for k, v in blob["weights"].items()}
