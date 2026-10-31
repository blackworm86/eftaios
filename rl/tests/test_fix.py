"""The training that stays close to the Hard copy: the pull (KL) is exact, the critic-only start leaves the policy alone, the check against the Hard copy runs,
and a small run from the Hard copy works from start to finish."""
import copy
import os
import random
import sys
import tempfile

import numpy as np
import torch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from eftaios_rl import env as env_mod, hardcopy, maps, rollout, train  # noqa: E402
from eftaios_rl.model import BoardCache, Net  # noqa: E402


def _batch(cfg, w):
    rollout.init_worker()
    data, _ = rollout.collect((cfg, w, [], w, 400, 3))
    return data


def _cfg():
    cfg = dict(train.DEFAULT)
    cfg.update(players=[3, 4], epochs=1, minibatch=64, workers=1)
    return cfg


def test_the_hard_copy_file_is_inside_the_trainer_folder():
    assert os.path.exists(hardcopy.FILE) and os.path.abspath(hardcopy.FILE).startswith(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))   # the PC holds only rl/


def test_final_rewards_follow_the_rules():
    from eftaios_rl import env as env_mod
    e = env_mod.Env("galilei", 4, seed=1, roles=["human", "human", "alien", "human"])
    s = e.g.seats
    s[0].over = "escaped"                                   # escaped: a winner, even if the Aliens win
    s[1].role, s[1].reborn = "alien", True                  # killed and now an Alien: plays on with the Aliens (its Human part lost, see rollout.py)
    e.g.result = {"aliens_win": True, "reason": "eliminated", "escaped": [0]}
    assert e.final_rewards() == [1.0, 1.0, 1.0, -1.0], e.final_rewards()   # seat 3: a Human still on board at the end has lost
    e.g.result = {"aliens_win": False, "reason": "escape", "escaped": [0, 3]}
    s[3].over = "escaped"
    assert e.final_rewards() == [1.0, -1.0, -1.0, 1.0], e.final_rewards()


def test_a_killed_human_is_closed_with_a_loss():
    segs = {1: [[{"r": 0.1}, {"r": 0.2}]], 2: [[{"r": 0.3}]]}
    roles = ["alien", "human", "human", "alien"]
    log = [{"kind": "out", "seat": 1, "text": "killed|human|Medic"}, {"kind": "out", "seat": 2, "text": "killed|alien|Fast Alien"}, {"kind": "noise", "seat": 1, "text": ""}]
    assert rollout._close_killed(log, 0, segs, roles) == 3
    assert [x["r"] for x in segs[1][0]] == [0.1, 0.2 - 1.0] and segs[1][1] == [], segs[1]   # the loss lands on the last Human decision; an Alien list follows
    assert segs[2] == [[{"r": 0.3}]]   # an Alien killed by another Alien is not a Human's death
    assert rollout._close_killed(log, 3, segs, roles) == 3 and len(segs[1]) == 2   # nothing is counted twice


def test_an_escape_costs_every_alien_seat():
    segs = {0: [[{"r": 0.0}]], 1: [[{"r": 0.0}]], 3: [[]]}
    roles = ["alien", "human", "human", "alien"]
    rollout._close_killed([{"kind": "out", "seat": 1, "text": "escaped|human|Pilot"}], 0, segs, roles)
    pen = env_mod.REWARD["escape_penalty"]
    assert segs[0][0][0]["r"] == -pen and segs[1][0][0]["r"] == 0.0 and segs[3] == [[]], segs   # the Alien loses; the Human and a seat with no decision yet do not


def test_games_with_kills_train_without_error():
    cfg, w = _cfg(), hardcopy.weights("/nonexistent")
    rollout.init_worker()
    data, st = rollout.collect((cfg, w, [], w, 600, 11))
    assert st["games"] > 0 and len(data["adv"]) > 0 and np.isfinite(data["adv"]).all() and np.isfinite(data["ret"]).all()


def test_pull_is_zero_for_the_same_network_and_positive_for_another():
    w = hardcopy.weights("/nonexistent")
    net, ref = Net(64, 4), Net(64, 4)
    net.load_state_dict(w)
    ref.load_state_dict(w)
    cfg, boards, ids = _cfg(), BoardCache(torch.device("cpu")), maps.official_ids()
    data = _batch(cfg, w)
    k = np.flatnonzero(data["map"] == data["map"][0])[:32]
    stat, adj = boards.get(ids[int(data["map"][0])])
    t = lambda key, dt=None: (torch.from_numpy(data[key][k]).float() if dt is None else torch.from_numpy(data[key][k]).to(dt))
    args = (t("dyn") / 255.0, stat, adj, t("glob"), t("priv"), t("phase", torch.long), t("me", torch.long), t("mask", torch.bool))
    ref.eval()
    with torch.no_grad():
        logits, _ = net(*args)
        same = float(train.kl_to(logits, ref, *args))
        other = Net(64, 4)
        lo, _ = other(*args)
        diff = float(train.kl_to(lo, ref, *args))
    assert abs(same) < 1e-6 and diff > 0.01, (same, diff)


def test_critic_only_start_leaves_the_policy_alone():
    w = hardcopy.weights("/nonexistent")
    net = Net(64, 4)
    net.load_state_dict(w)
    ref = copy.deepcopy(net).eval()
    cfg, boards, ids = _cfg(), BoardCache(torch.device("cpu")), maps.official_ids()
    data = _batch(cfg, w)
    before = {k: v.clone() for k, v in net.state_dict().items()}
    opt = torch.optim.Adam(net.parameters(), lr=1e-3)
    train.update(net, opt, data, boards, ids, torch.device("cpu"), cfg, 0.002, ref=ref, beta=0.1, value_only=True)
    after = net.state_dict()
    policy_same = all(torch.equal(before[k], after[k]) for k in before if not k.startswith("value_head"))
    value_moved = any(not torch.equal(before[k], after[k]) for k in before if k.startswith("value_head"))
    assert policy_same and value_moved, (policy_same, value_moved)


def test_the_check_against_the_hard_copy_runs():
    w = hardcopy.weights("/nonexistent")
    rollout.init_worker()
    r = rollout.evaluate_net((_cfg(), w, w, 1, 5))
    assert set(r) == {"human", "alien", "base_human", "base_alien"} and all(v[0] == 1 for v in r.values())


def test_a_small_run_from_the_hard_copy():
    d = tempfile.mkdtemp()
    rc = train.main(["--run", "t", "--runs-dir", d, "--smoke", "--max-iters", "3"])
    run = os.path.join(d, "t")
    log = open(os.path.join(run, "train.log")).read()
    assert rc == 0 and os.path.exists(os.path.join(run, "best.pt")) and "starting from the Hard copy" in log and "kl to the Hard copy" in log and "EVAL it" in log, log[-600:]


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
