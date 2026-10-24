"""The Python rules must give exactly the same neighbours and reachable sets as the app (data from tools/export-rl-conformance.js)."""
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import maps  # noqa: E402

DATA = json.load(open(os.path.join(os.path.dirname(__file__), "conformance.json")))


def test_neighbours_and_reachable_equal_the_app():
    checked = 0
    for m in DATA:
        b = maps.get(m["id"])
        assert (b.rows, b.cols, b.odd) == (m["rows"], m["cols"], m["odd"])
        for i, nb in enumerate(m["nb"]):
            assert sorted(b.neighbors[i]) == sorted(nb), (m["id"], i)
        for s in m["samples"]:
            got = sorted([c, d] for c, d in b.reachable(s["from"], s["steps"], s["role"], set(s["open"])).items())
            assert got == s["reach"], (m["id"], s["from"], s["role"], s["steps"], s["open"])
            checked += 1
    assert checked > 500


if __name__ == "__main__":
    test_neighbours_and_reachable_equal_the_app()
    print("ok conformance")
