"""The Python rules, with Items and Character powers, give the same announcements and results as the app on recorded Hard-bot games."""
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import replay  # noqa: E402

PATH = os.path.join(os.path.dirname(__file__), "replay-sample.jsonl.gz")


def test_replays_equal_the_app():
    recs = replay.read(PATH)
    used = {e["k"] for r in recs for e in r["tr"]}
    assert {"tele", "adr", "spot", "sens", "med", "mut", "stay", "lurk", "hatk", "sed", "cat"} <= used, used
    for n, r in enumerate(recs):
        diff = replay.compare(r, replay.play(r))
        assert not diff, (n, r["map"], diff)


if __name__ == "__main__":
    test_replays_equal_the_app()
    print("ok replay")
