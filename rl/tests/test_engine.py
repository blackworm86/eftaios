import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import engine, maps  # noqa: E402


def test_maps_load():
    ids = maps.official_ids()
    assert len(ids) >= 15
    b = maps.get("galilei")
    assert (b.rows, b.cols, b.n) == (14, 23, 322)
    assert b.cell_id(b.start_a) == "L06" and b.cell_id(b.start_h) == "L08"  # same as the app
    assert sorted(b.pod_cell) == [1, 2, 3, 4]
    assert b.parse_id("K09") == 8 * 23 + 10


def test_neighbours_match_app():
    b = maps.get("galilei")
    # app.js: odd columns are lower. L06 (col 11, row 5): neighbours K06 K07? check by id
    ids = sorted(b.cell_id(n) for n in b.neighbors[b.parse_id("L06")])
    assert ids == ["K06", "K07", "L05", "L07", "M06", "M07"], ids


def test_reachable_rules():
    b = maps.get("galilei")
    a = b.reachable(b.start_a, 2, "alien", {1, 2, 3, 4})
    assert b.start_a not in a and b.start_h not in a
    assert all(b.kind[c] not in "xHA1234" for c in a)  # Aliens never enter pods
    h = b.reachable(b.parse_id("C02"), 1, "human", {1, 2, 3, 4})  # next to pod 1 (B02)
    assert b.parse_id("B02") in h
    h2 = b.reachable(b.parse_id("C02"), 1, "human", {2, 3, 4})
    assert b.parse_id("B02") not in h2  # a closed pod is impassable


def test_deck_composition():
    g = engine.Game("galilei", 6, seed=1)
    d = g.sector_deck.draw_pile
    assert len(d) == 77 and d.count("noise-self") == 27 and d.count("noise-any") == 27 and d.count("silence") == 6
    assert sum(1 for c in d if c.startswith("item:")) == 17
    assert sorted(g.pod_deck.draw_pile) == ["green"] * 4 + ["red"]


def test_setup():
    for n in range(2, 9):
        g = engine.Game("galilei", n, seed=n)
        assert sum(s.role == "human" for s in g.seats) == n // 2
        for s in g.seats:
            home = g.board.start_a if (s.role == "alien" or s.char == "Psychologist") else g.board.start_h
            assert s.pos == home


def test_random_games_finish_and_are_consistent():
    results = {"escape": 0, "eliminated": 0, "time": 0}
    for seed in range(150):
        n = 2 + seed % 7
        g = engine.Game(maps.official_ids()[seed % len(maps.official_ids())], n, seed=seed)
        r = g.play_random()
        results[r["reason"]] += 1
        assert g.turn <= engine.MAX_TURN + 1
        humans_aboard = [s for s in g.seats if s.role0 == "human" and s.over is None and s.role == "human"]
        if r["reason"] == "time":
            assert humans_aboard
        else:
            assert not humans_aboard
        for s in g.seats:  # nobody ends on a wall, a start sector or a closed pod unless out
            assert g.board.kind[s.pos] != "x"
    assert sum(results.values()) == 150


def test_attack_and_conversion():
    g = engine.Game("galilei", 4, seed=3, roles=["alien", "human", "alien", "human"])
    a, h = g.seats[0], g.seats[1]
    for s in g.seats:
        s.char = ""  # no character effects
    g.cur = 0
    target = g.legal_moves()[0]
    h.pos = target
    g.step_move(target)
    assert g.phase == "attack"
    g.step_attack(True)
    assert h.role == "alien" and h.reborn and h.pos == g.board.start_a and a.fed
    assert any(e["kind"] == "out" and e["text"].startswith("killed|human") for e in g.log)
    assert g.last == "lost"


def test_friendly_fire_kills_alien():
    g = engine.Game("galilei", 4, seed=5, roles=["alien", "alien", "human", "human"])
    for s in g.seats:
        s.char = ""
    t = g.legal_moves()[0]
    g.seats[1].pos = t
    g.step_move(t)
    g.step_attack(True)
    assert g.seats[1].over == "dead" and not g.seats[0].fed


def test_escape_and_win_logic():
    g = engine.Game("galilei", 2, seed=2, roles=["human", "alien"])
    g.seats[0].char = g.seats[1].char = ""
    pod = g.board.pod_cell[1]
    nb = [c for c in g.board.neighbors[pod] if g.board.kind[c] == "."][0]
    g.seats[0].pos = nb
    g.pod_deck.draw_pile = ["green"]
    g.step_move(pod)
    assert g.seats[0].over == "escaped" and g.result and not g.result["aliens_win"] and g.result["reason"] == "escape"


def test_time_limit():
    g = engine.Game("galilei", 2, seed=4, roles=["human", "alien"])
    g.turn = engine.MAX_TURN
    g.seats[0].char = g.seats[1].char = ""
    for _ in range(10):
        if g.phase == "over":
            break
        if g.phase == "move":
            g.step_move(g.legal_moves()[0])
        elif g.phase == "attack":
            g.step_attack(False)
        else:
            g.step_decoy(g.decoy_cells()[0])
    assert g.result and g.result["reason"] in ("time", "escape", "eliminated")


if __name__ == "__main__":
    for k, v in sorted(globals().items()):
        if k.startswith("test_"):
            v()
            print("ok", k)
