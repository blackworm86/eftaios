"""Autonomous self-play training (PPO with a centralised critic).

    python -m eftaios_rl.train --run main            # start or resume (runs until a file named STOP appears in runs/main/)
    python -m eftaios_rl.train --run test --smoke    # a tiny end-to-end check (a few minutes at most)

Everything needed to resume is saved after every iteration, so the process can be killed and restarted at any time.
"""
import argparse
import json
import multiprocessing as mp
import os
import random
import sys
import time

import numpy as np
import torch
from torch.distributions import Categorical

from . import maps as maps_mod
from . import rollout
from .model import BoardCache, Net, pack

DEFAULT = dict(
    hid=64, layers=4, players=[3, 4, 5, 6, 7, 8], gamma=0.99, lam=0.95,
    workers=0,                # 0 = number of CPU cores - 1
    decisions_per_iter=24000, epochs=3, minibatch=256, lr=3e-4, clip=0.2, vf=0.5, ent=0.01, ent_end=0.003, ent_iters=400,
    p_scripted=0.20, p_pool=0.25, pool_every=10, pool_size=8, eval_every=10, eval_games=24, max_iters=0,
)


def log(run_dir, msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    print(line, flush=True)
    with open(os.path.join(run_dir, "train.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def cpu_weights(net):
    return {k: v.detach().cpu() for k, v in net.state_dict().items()}


def update(net, opt, data, boards, ids, device, cfg, ent_coef):
    adv = data["adv"].astype(np.float32)
    adv = (adv - adv.mean()) / (adv.std() + 1e-8)
    T = len(adv)
    stats = {"pol": 0.0, "val": 0.0, "ent": 0.0, "n": 0}
    for _ in range(cfg["epochs"]):
        batches = []
        for m in np.unique(data["map"]):
            idx = np.flatnonzero(data["map"] == m)
            np.random.shuffle(idx)
            batches += [(int(m), idx[i:i + cfg["minibatch"]]) for i in range(0, len(idx), cfg["minibatch"])]
        random.shuffle(batches)
        for m, idx in batches:
            stat, adj = boards.get(ids[m])
            dyn = torch.from_numpy(data["dyn"][idx]).to(device).float() / 255.0
            glob = torch.from_numpy(data["glob"][idx]).to(device)
            priv = torch.from_numpy(data["priv"][idx]).to(device)
            phase = torch.from_numpy(data["phase"][idx]).long().to(device)
            me = torch.from_numpy(data["me"][idx]).long().to(device)
            mask = torch.from_numpy(data["mask"][idx]).to(device)
            act = torch.from_numpy(data["action"][idx]).long().to(device)
            old = torch.from_numpy(data["logp"][idx]).float().to(device)
            a = torch.from_numpy(adv[idx]).to(device)
            ret = torch.from_numpy(data["ret"][idx]).float().to(device)
            logits, value = net(dyn, stat, adj, glob, priv, phase, me, mask)
            dist = Categorical(logits=logits)
            logp = dist.log_prob(act)
            ratio = torch.exp(logp - old)
            pol = -torch.min(ratio * a, torch.clamp(ratio, 1 - cfg["clip"], 1 + cfg["clip"]) * a).mean()
            val = 0.5 * ((value - ret) ** 2).mean()
            ent = dist.entropy().mean()
            loss = pol + cfg["vf"] * val - ent_coef * ent
            opt.zero_grad()
            loss.backward()
            torch.nn.utils.clip_grad_norm_(net.parameters(), 0.5)
            opt.step()
            stats["pol"] += float(pol.detach())
            stats["val"] += float(val.detach())
            stats["ent"] += float(ent.detach())
            stats["n"] += 1
    n = max(1, stats["n"])
    return {k: stats[k] / n for k in ("pol", "val", "ent")}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--run", default="main")
    ap.add_argument("--runs-dir", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "runs"))
    ap.add_argument("--smoke", action="store_true", help="tiny settings, to check that everything works")
    ap.add_argument("--workers", type=int, default=0)
    ap.add_argument("--max-iters", type=int, default=0)
    args = ap.parse_args(argv)

    run_dir = os.path.abspath(os.path.join(args.runs_dir, args.run))
    os.makedirs(os.path.join(run_dir, "pool"), exist_ok=True)
    cfg = dict(DEFAULT)
    if args.smoke:
        cfg.update(decisions_per_iter=600, epochs=1, minibatch=64, eval_every=2, eval_games=2, max_iters=2, pool_every=1, players=[3, 4])
    cfg_path = os.path.join(run_dir, "config.json")
    if os.path.exists(cfg_path):  # a resumed run keeps its own settings
        cfg.update(json.load(open(cfg_path)))
    if args.workers:
        cfg["workers"] = args.workers
    if args.max_iters:
        cfg["max_iters"] = args.max_iters
    cfg["workers"] = cfg["workers"] or max(1, (os.cpu_count() or 2) - 1)
    if args.smoke:
        cfg["workers"] = min(cfg["workers"], 2)
    json.dump(cfg, open(cfg_path, "w"), indent=1)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    torch.manual_seed(int(time.time()) % 100000)
    ids = maps_mod.official_ids()
    boards = BoardCache(device)
    net = Net(cfg["hid"], cfg["layers"]).to(device)
    opt = torch.optim.Adam(net.parameters(), lr=cfg["lr"])
    it = 0
    ck = os.path.join(run_dir, "latest.pt")
    if os.path.exists(ck):
        s = torch.load(ck, map_location=device)
        net.load_state_dict(s["net"])
        opt.load_state_dict(s["opt"])
        it = s["it"]
        log(run_dir, "resumed from iteration %d" % it)
    log(run_dir, "device %s, %d workers, %d parameters" % (device, cfg["workers"], sum(p.numel() for p in net.parameters())))

    ctx = mp.get_context("spawn")
    pool = ctx.Pool(cfg["workers"], initializer=rollout.init_worker)
    t_start = time.time()
    try:
        while True:
            if os.path.exists(os.path.join(run_dir, "STOP")):
                log(run_dir, "STOP file found: finishing")
                break
            if cfg["max_iters"] and it >= cfg["max_iters"]:
                break
            t0 = time.time()
            weights = cpu_weights(net)
            pool_w = []
            for f in sorted(os.listdir(os.path.join(run_dir, "pool")))[-cfg["pool_size"]:]:
                pool_w.append(torch.load(os.path.join(run_dir, "pool", f), map_location="cpu"))
            per = max(1, cfg["decisions_per_iter"] // cfg["workers"])
            jobs = [(cfg, weights, pool_w, per, random.getrandbits(32)) for _ in range(cfg["workers"])]
            results = pool.map(rollout.collect, jobs)
            data = {k: np.concatenate([r[0][k] for r in results]) for k in results[0][0]}
            st = {k: sum(r[1][k] for r in results) for k in results[0][1]}
            t1 = time.time()
            frac = min(1.0, it / max(1, cfg["ent_iters"]))
            ent_coef = cfg["ent"] + (cfg["ent_end"] - cfg["ent"]) * frac
            net.train()
            ls = update(net, opt, data, boards, ids, device, cfg, ent_coef)
            net.eval()
            it += 1
            torch.save({"net": net.state_dict(), "opt": opt.state_dict(), "it": it, "cfg": cfg}, ck + ".tmp")
            os.replace(ck + ".tmp", ck)
            if it % cfg["pool_every"] == 0:
                torch.save(cpu_weights(net), os.path.join(run_dir, "pool", "ckpt_%06d.pt" % it))
                for f in sorted(os.listdir(os.path.join(run_dir, "pool")))[:-cfg["pool_size"]]:
                    os.remove(os.path.join(run_dir, "pool", f))
            log(run_dir, "it %d: %d decisions in %d games (%.0fs collect, %.0fs train), aliens won %.0f%%, loss pol %.3f val %.3f ent %.2f" % (
                it, len(data["adv"]), st["games"], t1 - t0, time.time() - t1, 100 * st["aliens_win"] / max(1, st["games"]), ls["pol"], ls["val"], ls["ent"]))
            if it % cfg["eval_every"] == 0:
                w = cpu_weights(net)
                per_w = max(1, cfg["eval_games"] // cfg["workers"])
                rs = pool.map(rollout.evaluate, [(cfg, w, per_w, random.getrandbits(32)) for _ in range(cfg["workers"])])
                tot = {k: [sum(r[k][0] for r in rs), sum(r[k][1] for r in rs)] for k in rs[0]}
                pct = lambda k: 100 * tot[k][1] / max(1, tot[k][0])
                log(run_dir, "EVAL it %d vs rule-based players: as Humans the team wins %.0f%% (rule-based Humans: %.0f%%); as Aliens %.0f%% (rule-based Aliens: %.0f%%)" % (
                    it, pct("human"), pct("base_human"), pct("alien"), pct("base_alien")))
                with open(os.path.join(run_dir, "eval.csv"), "a") as f:
                    f.write("%d,%.1f,%.1f,%.1f,%.1f\n" % (it, pct("human"), pct("base_human"), pct("alien"), pct("base_alien")))
    finally:
        pool.terminate()
    log(run_dir, "stopped after %d iterations (%.0f minutes this session)" % (it, (time.time() - t_start) / 60))
    return 0


if __name__ == "__main__":
    sys.exit(main())
