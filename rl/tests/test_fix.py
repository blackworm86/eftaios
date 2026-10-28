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
from eftaios_rl import hardcopy, maps, rollout, train  # noqa: E402
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
    rc = train.main(["--run", "t", "--runs-dir", d, "--smoke", "--init-hardcopy", "--max-iters", "3"])
    run = os.path.join(d, "t")
    log = open(os.path.join(run, "train.log")).read()
    assert rc == 0 and os.path.exists(os.path.join(run, "best.pt")) and "starting from the Hard copy" in log and "kl to the Hard copy" in log and "EVAL it" in log, log[-600:]


if __name__ == "__main__":
    for name, fn in sorted(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok", name)
