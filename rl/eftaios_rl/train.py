"""Autonomous training from the Hard copy (PPO with a centralised critic, kept close to the Hard copy by a KL penalty).

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

from . import hardcopy, report
from . import maps as maps_mod
from . import publish
from . import rollout
from .model import BoardCache, Net, pack

DEFAULT = dict(
    hid=64, layers=4, players=[3, 4, 5, 6, 7, 8], gamma=0.99, lam=0.95,
    workers=0,                # 0 = number of CPU cores - 1
    decisions_per_iter=24000, epochs=2, minibatch=256, lr=3e-5, clip=0.1, vf=0.5, ent=0.002, ent_end=0.002, ent_iters=400,
    p_pool=0.5, teacher_share=0.6, pool_every=10, pool_size=4, eval_every=20, eval_games=240, max_iters=0, publish_hours=3,
    kl=0.1, kl_end=0.02, kl_iters=500,   # the pull towards the Hard copy, and how fast it relaxes
    value_warmup=15,                     # iterations at the start in which only the critic learns
)


def log(run_dir, msg):
    line = time.strftime("%Y-%m-%d %H:%M:%S ") + msg
    print(line, flush=True)
    with open(os.path.join(run_dir, "train.log"), "a", encoding="utf-8") as f:
        f.write(line + "\n")


def cpu_weights(net):
    return {k: v.detach().cpu() for k, v in net.state_dict().items()}


def update(net, opt, data, boards, ids, device, cfg, ent_coef, ref=None, beta=0.0, value_only=False):
    adv = data["adv"].astype(np.float32)
    adv = (adv - adv.mean()) / (adv.std() + 1e-8)
    T = len(adv)
    stats = {"pol": 0.0, "val": 0.0, "ent": 0.0, "kl": 0.0, "n": 0}
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
            kl = kl_to(logits, ref, dyn, stat, adj, glob, priv, phase, me, mask) if ref is not None else torch.zeros((), device=device)
            loss = cfg["vf"] * val if value_only else pol + cfg["vf"] * val - ent_coef * ent + beta * kl
            opt.zero_grad()
            loss.backward()
            if value_only:   # only the critic's own layers learn: the shared layers (and so the policy) stay exactly as they are
                for name, p_ in net.named_parameters():
                    if not name.startswith("value_head"):
                        p_.grad = None
            torch.nn.utils.clip_grad_norm_([p_ for p_ in net.parameters() if p_.grad is not None], 0.5)
            opt.step()
            stats["pol"] += float(pol.detach())
            stats["val"] += float(val.detach())
            stats["ent"] += float(ent.detach())
            stats["kl"] += float(kl.detach())
            stats["n"] += 1
    n = max(1, stats["n"])
    return {k: stats[k] / n for k in ("pol", "val", "ent", "kl")}


def kl_to(logits, ref, dyn, stat, adj, glob, priv, phase, me, mask):
    """KL(current policy || the reference policy) on these positions, summed over the legal actions, averaged over the batch."""
    with torch.no_grad():
        ref_logits, _ = ref(dyn, stat, adj, glob, priv, phase, me, mask)
    lp, rp = torch.log_softmax(logits, 1), torch.log_softmax(ref_logits, 1)
    return torch.where(mask, lp.exp() * (lp - rp), torch.zeros_like(lp)).sum(1).mean()


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

    device = torch.device("cpu")
    if torch.cuda.is_available():
        try:  # a real calculation: some builds report a GPU they have no kernels for
            x = torch.ones(8, 8, device="cuda")
            float((x @ x).sum())
            device = torch.device("cuda")
        except Exception as e:
            log(run_dir, "The GPU cannot run this PyTorch build (%s). Training on the CPU instead; run setup_windows.bat again after updating, or send me this line." % str(e).splitlines()[0])
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
    fresh = not os.path.exists(ck)
    teacher_w = hardcopy.weights(run_dir)
    ref = Net(cfg["hid"], cfg["layers"]).to(device)   # the Hard copy, frozen: the network is pulled towards it, and checked against it
    ref.load_state_dict(teacher_w)
    ref.eval()
    for p_ in ref.parameters():
        p_.requires_grad_(False)
    if fresh:   # a new run always starts from the Hard copy
        net.load_state_dict(teacher_w)
        torch.save(teacher_w, os.path.join(run_dir, "pool", "teacher.pt"))
        torch.save({"net": teacher_w, "it": 0, "cfg": cfg}, os.path.join(run_dir, "best.pt"))
        json.dump({"avg": 0.0, "it": 0}, open(os.path.join(run_dir, "best.json"), "w"))
        fresh = False
        log(run_dir, "a new run, starting from the Hard copy (the pull towards it starts at %.2f, only the critic learns for %d iterations)" % (cfg["kl"], cfg["value_warmup"]))
    try:
        best = json.load(open(os.path.join(run_dir, "best.json")))
    except (OSError, ValueError):
        best = {"avg": 0.0, "it": 0}
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
            ckpts = sorted(f for f in os.listdir(os.path.join(run_dir, "pool")) if f.startswith("ckpt_"))
            pool_w = [torch.load(os.path.join(run_dir, "pool", f), map_location="cpu") for f in ckpts[-(cfg["pool_size"] - 1):]]
            per = max(1, cfg["decisions_per_iter"] // cfg["workers"])
            jobs = [(cfg, weights, pool_w, teacher_w, per, random.getrandbits(32)) for _ in range(cfg["workers"])]
            results = pool.map(rollout.collect, jobs)
            data = {k: np.concatenate([r[0][k] for r in results]) for k in results[0][0]}
            st = {k: sum(r[1][k] for r in results) for k in results[0][1]}
            t1 = time.time()
            frac = min(1.0, it / max(1, cfg["ent_iters"]))
            ent_coef = cfg["ent"] + (cfg["ent_end"] - cfg["ent"]) * frac
            net.train()
            beta = cfg["kl"] + (cfg["kl_end"] - cfg["kl"]) * min(1.0, it / max(1, cfg["kl_iters"]))
            ls = update(net, opt, data, boards, ids, device, cfg, ent_coef, ref=ref, beta=beta, value_only=it < cfg["value_warmup"])
            net.eval()
            it += 1
            torch.save({"net": net.state_dict(), "opt": opt.state_dict(), "it": it, "cfg": cfg}, ck + ".tmp")
            os.replace(ck + ".tmp", ck)
            if it % cfg["pool_every"] == 0:
                torch.save(cpu_weights(net), os.path.join(run_dir, "pool", "ckpt_%06d.pt" % it))
                for f in sorted(f for f in os.listdir(os.path.join(run_dir, "pool")) if f.startswith("ckpt_"))[:-(cfg["pool_size"] - 1)]:
                    os.remove(os.path.join(run_dir, "pool", f))
            log(run_dir, "it %d: %d decisions in %d games (%.0fs collect, %.0fs train), aliens won %.0f%%, loss pol %.3f val %.3f ent %.2f, kl to the Hard copy %.3f%s" % (
                it, len(data["adv"]), st["games"], t1 - t0, time.time() - t1, 100 * st["aliens_win"] / max(1, st["games"]), ls["pol"], ls["val"], ls["ent"], ls["kl"], " (critic only)" if it <= cfg["value_warmup"] else ""))
            if it % cfg["eval_every"] == 0:
                w = cpu_weights(net)
                per_w = max(1, cfg["eval_games"] // cfg["workers"])
                rs = pool.map(rollout.evaluate_net, [(cfg, w, teacher_w, per_w, random.getrandbits(32)) for _ in range(cfg["workers"])])
                tot = {k: [sum(r[k][0] for r in rs), sum(r[k][1] for r in rs)] for k in rs[0]}
                pct = lambda k: 100 * tot[k][1] / max(1, tot[k][0])
                with open(os.path.join(run_dir, "eval.csv"), "a") as f:
                    f.write("%d,%.1f,%.1f,%.1f,%.1f\n" % (it, pct("human"), pct("base_human"), pct("alien"), pct("base_alien")))
                rows = report.evals(run_dir)[-3:]
                avg = sum((r[1] - r[2]) + (r[3] - r[4]) for r in rows) / max(1, len(rows))
                log(run_dir, "EVAL it %d against the Hard copy: as Humans the team wins %.0f%% (the Hard copy: %.0f%%); as Aliens %.0f%% (the Hard copy: %.0f%%); gain over the last %d checks %+.1f points" % (
                    it, pct("human"), pct("base_human"), pct("alien"), pct("base_alien"), len(rows), avg))
                if len(rows) >= 3 and avg > best["avg"] + 1.0:   # three checks smooth the noise of 240 games
                    best = {"avg": avg, "it": it}
                    torch.save({"net": w, "it": it, "cfg": cfg}, os.path.join(run_dir, "best.pt.tmp"))
                    os.replace(os.path.join(run_dir, "best.pt.tmp"), os.path.join(run_dir, "best.pt"))
                    json.dump(best, open(os.path.join(run_dir, "best.json"), "w"))
                    log(run_dir, "new best network: iteration %d (gain %+.1f points over the Hard copy)" % (it, avg))
            try:
                for line in publish.maybe_publish(run_dir, cfg):
                    log(run_dir, "publish: " + line)
            except Exception as e:
                log(run_dir, "publish failed: %s" % e)
    finally:
        pool.terminate()
        try:
            for line in publish.maybe_publish(run_dir, cfg, final=True):
                log(run_dir, "publish: " + line)
        except Exception as e:
            log(run_dir, "publish failed: %s" % e)
    log(run_dir, "stopped after %d iterations (%.0f minutes this session)" % (it, (time.time() - t_start) / 60))
    return 0


if __name__ == "__main__":
    sys.exit(main())
