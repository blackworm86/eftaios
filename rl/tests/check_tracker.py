"""The Python tracker (eftaios_rl/tracker.py) against the Hard bot's own pictures recorded in the teacher games (hard-d): at the first decision after each
recorded picture, the picture made from the engine's log must be the same (maps in steps of 8 of 255, chances to 2 decimals).
    python3 tests/check_tracker.py [games]"""
import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import replay, tracker  # noqa: E402

GAMES = int(sys.argv[1]) if len(sys.argv) > 1 else 30
recs = replay.read(os.path.join(os.path.dirname(__file__), "..", "data", "teacher", "hard-d.jsonl.gz"))[::max(1, 4536 // GAMES)][:GAMES]
tot = {"pics": 0, "maps_equal": 0, "p_equal": 0, "max_diff": 0, "cells_off": 0, "cells": 0}
t_pic = 0.0
for rec in recs:
    checked, seen = {}, {}

    def on(g, phase, action, bel):
        global t_pic
        s = g.cur
        b = bel.get(s)
        if b is None or checked.get(s) is b:
            return
        checked[s] = b
        t0 = time.time()
        pic = tracker.pictures(g.board, [dict(e) for e in g.log], g.n, s, g.seats[s].role, g.turn, g.open_pods)
        t_pic += time.time() - t0
        tot["pics"] += 1
        ok = True
        for name, key in (("h", "h"), ("a", "a")):
            mine = tracker.quantise(pic[key])
            theirs = b[name]
            diff = max([abs(mine.get(c, 0) - theirs.get(c, 0)) for c in set(mine) | set(theirs)] or [0])
            tot["max_diff"] = max(tot["max_diff"], diff)
            tot["cells"] += len(set(mine) | set(theirs))
            tot["cells_off"] += sum(1 for c in set(mine) | set(theirs) if mine.get(c, 0) != theirs.get(c, 0))
            ok = ok and diff == 0
        tot["maps_equal"] += ok
        pe = all(abs(round(pic["p"][j], 2) - b["p"][j]) < 0.011 for j in range(g.n) if j != s)
        tot["p_equal"] += pe

    replay.play(rec, on)
print("pictures checked %(pics)d: maps identical %(maps_equal)d, chances equal %(p_equal)d; cells that differ %(cells_off)d of %(cells)d, largest step difference %(max_diff)d" % tot)
print("time per picture %.1f ms" % (1000 * t_pic / max(1, tot["pics"])))
sys.exit(0 if tot["maps_equal"] >= 0.98 * tot["pics"] and tot["p_equal"] >= 0.98 * tot["pics"] else 1)
