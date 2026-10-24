"""Write a trained network as plain JSON for the app (the JavaScript player reads it; no libraries needed).

    python -m eftaios_rl.export_js --run main            # uses runs/main/latest.pt
    python -m eftaios_rl.export_js --ckpt path.pt --out export/eftaios-net.json
"""
import argparse
import json
import os

import torch


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="main")
    ap.add_argument("--ckpt", default="")
    ap.add_argument("--out", default="")
    args = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    ck = args.ckpt or os.path.join(here, "..", "runs", args.run, "latest.pt")
    s = torch.load(ck, map_location="cpu")
    cfg = s["cfg"]
    state = s["net"] if "net" in s else s
    out = args.out or os.path.join(here, "..", "export", "eftaios-net-%s.json" % args.run)
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    blob = {"format": 1, "hid": cfg["hid"], "layers": cfg["layers"], "iteration": s.get("it", 0),
            "weights": {k: {"shape": list(v.shape), "data": [round(float(x), 6) for x in v.flatten().tolist()]} for k, v in state.items()}}
    json.dump(blob, open(out, "w"))
    print("wrote", os.path.abspath(out), "(%d KB)" % (os.path.getsize(out) // 1024))


if __name__ == "__main__":
    main()
