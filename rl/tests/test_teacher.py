"""The teacher recordings rebuild exactly the inputs the app's network code computed (the sample file also carries the full inputs, 'full')."""
import gzip
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import maps, teacher  # noqa: E402

PATH = os.path.join(os.path.dirname(__file__), "teacher-sample.jsonl.gz")


def test_rebuilt_inputs_match_the_app():
    ids = maps.official_ids()
    t = teacher.Teacher(PATH, ids)
    full = [json.loads(l)["full"] for l in gzip.open(PATH, "rt") if l.strip()]
    bad = 0
    for k, f in enumerate(full):
        want = np.array(f, np.uint8).reshape(29, 322)
        got = t.dyn(k)
        # the distance channels are rounded differently by 1 level at most (int vs floor of a float)
        bad += int(np.abs(got.astype(int) - want.astype(int)).max() > 1)
    assert bad == 0, "%d of %d decisions differ" % (bad, len(full))
    b = t.batch(np.arange(8))
    assert b["dyn"].shape == (8, 29, 322) and b["mask"].any(1).all()
    assert (b["mask"][np.arange(8), b["action"]] | (b["phase"] == 1)).all()  # the teacher's move was a legal one


if __name__ == "__main__":
    test_rebuilt_inputs_match_the_app()
    print("ok")
