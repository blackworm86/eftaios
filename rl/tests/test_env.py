import os
import sys
import time

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, maps, scripted  # noqa: E402


def play(env, pols):
    steps = 0
    while not env.done:
        seat, ob = env.decision()
        assert ob["mask"].any()
        a = pols[seat].act(env)
        if ob["phase"] != 1:
            assert ob["mask"][a], "policy chose an illegal action"
        env.act(a)
        steps += 1
    return steps


def test_observation_shapes_and_privacy():
    e = env_mod.Env("galilei", 6, seed=1)
    seat, ob = e.decision()
    assert ob["dyn"].shape == (env_mod.D_DYN, 322) and ob["dyn"].dtype == np.uint8
    assert ob["glob"].shape == (env_mod.G_DIM,) and ob["priv"].shape == (env_mod.P_DIM,)
    # the policy input must not change when the hidden roles of the others change
    roles = [s.role for s in e.g.seats]
    e2 = env_mod.Env("galilei", 6, seed=1)
    for j, s in enumerate(e2.g.seats):
        if j != seat:
            s.role = "human" if roles[j] == "alien" else "alien"
    _, ob2 = e2.decision()
    assert np.array_equal(ob["dyn"], ob2["dyn"]) and np.array_equal(ob["glob"], ob2["glob"])
    assert not np.array_equal(ob["priv"], ob2["priv"])  # only the critic's vector reveals them


def test_scripted_games_finish_and_balance():
    wins = {"alien": 0, "human": 0}
    t0 = time.time()
    total = 0
    for seed in range(60):
        n = 2 + seed % 7
        e = env_mod.Env(maps.official_ids()[seed % 17], n, seed=seed)
        pols = [scripted.Scripted(seed * 10 + i) for i in range(n)]
        total += play(e, pols)
        wins["alien" if e.g.result["aliens_win"] else "human"] += 1
        fr = e.final_rewards()
        assert len(fr) == n and all(abs(x) == 1 for x in fr)
    rate = total / (time.time() - t0)
    print("scripted wins", wins, "decisions/s %.0f" % rate)
    assert wins["alien"] > 3 and wins["human"] > 3  # neither side always wins


def test_progress_reward_is_zero_sum_on_a_round_trip():
    e = env_mod.Env("galilei", 4, seed=7, roles=["human", "alien", "human", "alien"])
    for s in e.g.seats:
        s.char = ""
    seat = 0
    assert e.seat == seat
    start = e.g.seats[0].pos
    moves = e.g.legal_moves()
    d0 = e.pod_distance(start)
    nearer = [m for m in moves if e.pod_distance(m) < d0]
    farther = [m for m in moves if e.pod_distance(m) > d0]
    assert nearer or farther
    if nearer:
        assert abs(e.act(nearer[0]) - env_mod.REWARD["progress"] * (d0 - e.pod_distance(nearer[0]))) < 1e-9
    else:
        assert e.act(farther[0]) < 0


if __name__ == "__main__":
    test_progress_reward_is_zero_sum_on_a_round_trip()
    print("ok progress")
    test_observation_shapes_and_privacy()
    print("ok privacy")
    test_scripted_games_finish_and_balance()
    print("ok scripted")
