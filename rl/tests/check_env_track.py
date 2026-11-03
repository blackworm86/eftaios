"""The training game's own pictures (Env with track=True: made at the start of a turn and after a Spotlight, Sensor or Medic) against the pictures of the
teacher recordings, in the network input of every decision: channels 37-38 and the chances (glob 260+) must be equal.
    python3 tests/check_env_track.py [games]"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, replay  # noqa: E402

GAMES = int(sys.argv[1]) if len(sys.argv) > 1 else 40
recs = replay.read(os.path.join(os.path.dirname(__file__), "..", "data", "teacher", "hard-d.jsonl.gz"))[::max(1, 4536 // GAMES)][:GAMES]
same = diff = 0
for rec in recs:
    box = {}

    def on(g, phase, action, bel):
        e = box.get("e") or box.setdefault("e", env_mod.Env.wrap(g))
        seat = g.cur
        if box.pop("pop", False):   # the step before was a card or power, or the target of one: the picture is made again
            e._pic.pop(seat, None)
        e.bel, e.track = bel, False
        _, a = e.decision()
        e.bel, e.track = {}, True
        _, b = e.decision()
        e.bel = {}
        ok = np.array_equal(a["dyn"][37:39], b["dyn"][37:39]) and np.allclose(a["glob"][260:267], b["glob"][260:267], atol=1e-6)
        same, diff = box.get("n", (0, 0))
        box["n"] = (same + ok, diff + (not ok))
        box["pop"] = (phase == "pre" and action != 0) or phase in ("target_seat", "target_cell")

    replay.play(rec, on)
    s, d = box.get("n", (0, 0))
    same, diff = same + s, diff + d
print("decisions with the same picture %d, different %d" % (same, diff))
sys.exit(0 if diff == 0 else 1)
