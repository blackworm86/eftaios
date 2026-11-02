"""node tools/obs-check.js  &&  python3 rl/tests/check_obs.py
The input the app builds for the network at every move (tools/obs-check.js) must equal the input the Python code builds from the recording of the same game."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, replay  # noqa: E402

recs = json.load(open("/tmp/chk.json"))
same = diff = 0
for r in recs:
    chk, rows, seen = r.pop("chk"), [], {}

    def on(g, phase, action, bel):
        e = seen.setdefault("e", env_mod.Env.wrap(g))
        e.bel = bel
        if phase != "move":
            return
        _, ob = e.decision()
        h = 0
        for v in ob["dyn"].reshape(-1):
            h = (h * 31 + int(v)) & 0xFFFFFFFF
        for v in ob["glob"][260:267]:
            h = (h * 31 + int(round(float(v) * 100))) & 0xFFFFFFFF
        rows.append(h)

    replay.play(r, on)
    same += sum(1 for a, b in zip(rows, chk) if a == b)
    diff += abs(len(rows) - len(chk)) + sum(1 for a, b in zip(rows, chk) if a != b)
print("identical inputs %d, different %d" % (same, diff))
sys.exit(0 if diff == 0 and same > 100 else 1)
