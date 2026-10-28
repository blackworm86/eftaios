"""Teaches the network to play like the app's Hard bot, from the teacher recordings in data/teacher/ (see teacher.py).

    python -m eftaios_rl.distill --run main         # starts a fresh run in runs/<run>; training can continue from it afterwards

Cross-entropy on the teacher's action at every decision (moves, Alien attacks, decoys) plus the critic on the final result. 5% of the games are kept
aside: the log shows how often the network picks the teacher's action on them, per decision type. Stops after --epochs, or when a file named STOP appears.
"""
import argparse
import glob
import json
import os
import random
import shutil
import sys
import time

import numpy as np
import torch

from . import maps as maps_mod
from . import teacher as teacher_mod
from .model import BoardCache, Net
from .train import DEFAULT, cpu_weights, log

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "teacher")


def tensors(batch, device):
    t = lambda k, dt=None: torch.from_numpy(batch[k]).to(device) if dt is None else torch.from_numpy(batch[k]).to(device).to(dt)
    return t("dyn").float() / 255.0, t("glob"), t("priv"), t("phase", torch.long), t("me", torch.long), t("mask"), t("action", torch.long), t("ret").float()


def run_batches(net, T, rows, boards, ids, device, mb, opt=None, shuffle=True):
    """One pass over `rows` (decision numbers), a map at a time. Returns cross-entropy, value loss and hits/total per decision type."""
    batches = []
    for m in np.unique(T.map[rows]):
        r = rows[T.map[rows] == m]
        if shuffle:
            np.random.shuffle(r)
        batches += [(int(m), r[i:i + mb]) for i in range(0, len(r), mb)]
    if shuffle:
        random.shuffle(batches)
    ce_sum = v_sum = n = 0
    hits, tot = np.zeros(7), np.zeros(7)
    for m, idx in batches:
        stat, adj = boards.get(ids[m])
        dyn, glob, priv, phase, me, mask, act, ret = tensors(T.batch(idx), device)
        with torch.set_grad_enabled(opt is not None):
            logits, value = net(dyn, stat, adj, glob, priv, phase, me, mask)
            ce = torch.nn.functional.cross_entropy(logits, act)
            vl = ((value - ret) ** 2).mean()
            if opt is not None:
                opt.zero_grad()
                (ce + 0.5 * vl).backward()
                torch.nn.utils.clip_grad_norm_(net.parameters(), 1.0)
                opt.step()
        ok = (logits.argmax(1) == act).cpu().numpy()
        for k in range(7):
            sel = T.phase[idx] == k
            hits[k] += ok[sel].sum()
            tot[k] += sel.sum()
        ce_sum += float(ce.detach()) * len(idx)
        v_sum += float(vl.detach()) * len(idx)
        n += len(idx)
    return ce_sum / max(1, n), v_sum / max(1, n), hits, tot


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="main")
    ap.add_argument("--runs-dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "runs"))
    ap.add_argument("--data", default=DATA)
    ap.add_argument("--epochs", type=int, default=20)
    ap.add_argument("--batch", type=int, default=256)
    ap.add_argument("--lr", type=float, default=1e-3)
    args = ap.parse_args(argv)
    run_dir = os.path.abspath(os.path.join(args.runs_dir, args.run))
    if os.path.exists(os.path.join(run_dir, "latest.pt")):  # a distillation always starts from nothing; the old run is kept aside
        shutil.move(run_dir, run_dir + "-before-distil-" + time.strftime("%Y%m%d-%H%M"))
    os.makedirs(os.path.join(run_dir, "pool"), exist_ok=True)
    if os.path.exists(os.path.join(run_dir, "STOP")):   # left over from an earlier stop
        os.remove(os.path.join(run_dir, "STOP"))
    cfg = dict(DEFAULT)
    json.dump(cfg, open(os.path.join(run_dir, "config.json"), "w"), indent=1)
    files = sorted(glob.glob(os.path.join(args.data, "*.jsonl.gz")))
    if not files:
        log(run_dir, "No teacher recordings found in %s" % args.data)
        return 1
    device = torch.device("cpu")
    if torch.cuda.is_available():
        try:
            x = torch.ones(8, 8, device="cuda")
            float((x @ x).sum())
            device = torch.device("cuda")
        except Exception as e:
            log(run_dir, "The GPU cannot run this PyTorch build (%s). Using the CPU." % str(e).splitlines()[0])
    ids = maps_mod.official_ids()
    log(run_dir, "reading %d teacher file(s)" % len(files))
    t0 = time.time()
    T = teacher_mod.Teacher(files, ids, log=lambda s: log(run_dir, s), cache=os.path.join(os.path.dirname(run_dir), "teacher-cache.pkl"))
    games = np.unique(T.game)
    rng = np.random.RandomState(7)
    held = set(rng.choice(games, max(1, len(games) // 20), replace=False).tolist())
    is_held = np.array([g in held for g in T.game])
    train_rows, test_rows = np.flatnonzero(~is_held), np.flatnonzero(is_held)
    log(run_dir, "%d decisions from %d games (%.0fs); %d games kept aside to check" % (len(T), len(games), time.time() - t0, len(held)))
    boards = BoardCache(device)
    net = Net(cfg["hid"], cfg["layers"]).to(device)
    opt = torch.optim.Adam(net.parameters(), lr=args.lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=args.epochs, eta_min=args.lr / 10)
    torch.manual_seed(1)
    np.random.seed(1)
    random.seed(1)
    for ep in range(1, args.epochs + 1):
        if os.path.exists(os.path.join(run_dir, "STOP")):
            log(run_dir, "STOP file found: finishing")
            break
        t1 = time.time()
        net.train()
        ce, vl, h, n = run_batches(net, T, train_rows, boards, ids, device, args.batch, opt)
        sched.step()
        net.eval()
        tce, tvl, th, tn = run_batches(net, T, test_rows, boards, ids, device, args.batch, None, False)
        acc = th / np.maximum(tn, 1)
        both = lambda a, b: (th[a] + th[b]) / max(1, tn[a] + tn[b])   # Item / power decisions before and after the move; targets of Spotlight, Sensor, Medic
        log(run_dir, "epoch %d/%d: cross-entropy %.3f (check games %.3f); same action as the Hard bot on unseen games: moves %.0f%%, attacks %.0f%%, decoys %.0f%%, Items and powers %.0f%%, their targets %.0f%% (%.0fs)" % (
            ep, args.epochs, ce, tce, 100 * acc[0], 100 * acc[1], 100 * acc[2], 100 * both(3, 4), 100 * both(5, 6), time.time() - t1))
        torch.save({"net": net.state_dict(), "opt": opt.state_dict(), "it": 0, "cfg": cfg}, os.path.join(run_dir, "latest.pt.tmp"))
        os.replace(os.path.join(run_dir, "latest.pt.tmp"), os.path.join(run_dir, "latest.pt"))
    torch.save(cpu_weights(net), os.path.join(run_dir, "pool", "teacher.pt"))   # stays among the sparring partners of the training that follows
    log(run_dir, "distillation finished")
    return 0


if __name__ == "__main__":
    sys.exit(main())
