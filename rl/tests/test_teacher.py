"""Training rows from the teacher recordings: every action is legal, and the stored observation rebuilds exactly."""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, maps, replay, teacher  # noqa: E402

PATH = os.path.join(os.path.dirname(__file__), "replay-sample.jsonl.gz")


def test_rows():
    ids = maps.official_ids()
    T = teacher.Teacher(PATH, ids)
    assert len(T) > 1000 and set(T.phase.tolist()) == {0, 1, 2, 3, 4, 5, 6}
    assert all(T.mask(k)[T.action[k]] for k in range(len(T)))
    # the first game again, decision by decision, against the rows
    rec = replay.read(PATH)[0]
    seen, rows = {}, []

    def on(g, phase, action):
        e = seen.setdefault("e", env_mod.Env.wrap(g))
        _, ob = e.decision()
        rows.append(ob)

    replay.play(rec, on)
    for k, ob in enumerate(rows):
        assert np.array_equal(T.dyn(k), ob["dyn"]), k
        assert np.allclose(T.glob[k].astype(np.float32), ob["glob"], atol=1e-3), k


if __name__ == "__main__":
    test_rows()
    print("ok teacher")
