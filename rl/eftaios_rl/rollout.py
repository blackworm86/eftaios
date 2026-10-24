"""Self-play game collection (runs in worker processes, CPU only).

Each game is played by the current policy, older checkpoints and rule-based players in a mix; only the decisions of seats played by the
current policy are kept for training. Advantages are worked out per seat at the end of each game (GAE).
"""
import random

import numpy as np
import torch
from torch.distributions import Categorical

from . import env as env_mod
from . import maps as maps_mod
from . import scripted
from .model import BoardCache, Net, pack

_W = {}
N_CELLS = 322


def init_worker():
    torch.set_num_threads(1)
    _W["boards"] = BoardCache(torch.device("cpu"))


def _net(cfg, weights):
    net = Net(cfg["hid"], cfg["layers"])
    net.load_state_dict(weights)
    net.eval()
    return net


@torch.no_grad()
def net_act(net, ob, sample=True):
    stat, adj = _W["boards"].get(ob["map"])
    dyn, glob, priv, phase, me, mask = pack([ob], torch.device("cpu"))
    logits, value = net(dyn, stat, adj, glob, priv, phase, me, mask)
    d = Categorical(logits=logits)
    a = d.sample() if sample else logits.argmax(1)
    return int(a.item()), float(d.log_prob(a).item()), float(value.item())


def _choose_mode(rng, cfg, has_pool):
    r = rng.random()
    if r < cfg["p_scripted"]:
        return "scripted"
    if has_pool and r < cfg["p_scripted"] + cfg["p_pool"]:
        return "pool"
    return "self"


def collect(job):
    """job = (cfg, weights, pool_weights, target_decisions, seed). Returns arrays for training and some statistics."""
    cfg, weights, pool_w, target, seed = job
    rng = random.Random(seed)
    cur = _net(cfg, weights)
    pool = [_net(cfg, w) for w in pool_w]
    ids = maps_mod.official_ids()
    rows = {k: [] for k in ("dyn", "glob", "priv", "phase", "me", "mask", "map", "action", "logp", "adv", "ret")}
    stats = {"games": 0, "aliens_win": 0, "decisions": 0, "escaped": 0, "players": 0}
    while stats["decisions"] < target:
        n = rng.choice(cfg["players"])
        mid = rng.choice(ids)
        env = env_mod.Env(mid, n, seed=rng.getrandbits(32))
        mode = _choose_mode(rng, cfg, bool(pool))
        who = []  # per seat: 'cur' | ('pool', net) | 'script'
        for i in range(n):
            if mode == "self":
                who.append("cur")
            elif mode == "pool":
                who.append("cur" if rng.random() < 0.5 else ("pool", rng.choice(pool)))
            else:
                who.append("cur" if rng.random() < 0.5 else "script")
        if "cur" not in who:
            who[0] = "cur"
        scr = {i: scripted.Scripted(rng.getrandbits(32)) for i in range(n) if who[i] == "script"}
        traj = {i: [] for i in range(n) if who[i] == "cur"}
        while not env.done:
            seat, ob = env.decision()
            c = who[seat]
            if c == "cur":
                a, lp, v = net_act(cur, ob)
                r = env.act(a)
                traj[seat].append({"ob": ob, "a": a, "lp": lp, "v": v, "r": r})
            elif c == "script":
                env.act(scr[seat].act(env))
            else:
                env.act(net_act(c[1], ob)[0])
        fr = env.final_rewards()
        stats["games"] += 1
        stats["aliens_win"] += int(env.g.result["aliens_win"])
        stats["escaped"] += len(env.g.result["escaped"])
        stats["players"] += n
        for seat, steps in traj.items():
            if not steps:
                continue
            steps[-1]["r"] += fr[seat]
            adv, last = [0.0] * len(steps), 0.0
            for k in range(len(steps) - 1, -1, -1):  # GAE over this seat's own decisions
                nxt_v = steps[k + 1]["v"] if k + 1 < len(steps) else 0.0
                delta = steps[k]["r"] + cfg["gamma"] * nxt_v - steps[k]["v"]
                last = delta + cfg["gamma"] * cfg["lam"] * last
                adv[k] = last
            for k, st in enumerate(steps):
                ob = st["ob"]
                m = np.zeros(N_CELLS, bool)
                m[:len(ob["mask"])] = ob["mask"]
                rows["dyn"].append(ob["dyn"])
                rows["glob"].append(ob["glob"])
                rows["priv"].append(ob["priv"])
                rows["phase"].append(ob["phase"])
                rows["me"].append(ob["me"])
                rows["mask"].append(m)
                rows["map"].append(ids.index(mid))
                rows["action"].append(st["a"])
                rows["logp"].append(st["lp"])
                rows["adv"].append(adv[k])
                rows["ret"].append(adv[k] + st["v"])
            stats["decisions"] += len(steps)
    out = {k: (np.stack(v) if k in ("dyn", "glob", "priv", "mask") else np.asarray(v)) for k, v in rows.items()}
    return out, stats


def evaluate(job):
    """job = (cfg, weights, n_games, seed). The learner plays one side against rule-based players on the other, and the same games are
    played by rule-based players only. Returns {key: [games, wins]} for keys human, alien, base_human, base_alien ('wins' = that side won)."""
    cfg, weights, n_games, seed = job
    rng = random.Random(seed)
    net = _net(cfg, weights)
    ids = maps_mod.official_ids()
    res = {"human": [0, 0], "alien": [0, 0], "base_human": [0, 0], "base_alien": [0, 0]}
    for _ in range(n_games):
        n = rng.choice(cfg["players"])
        mid = rng.choice(ids)
        s = rng.getrandbits(32)
        for side in ("human", "alien"):
            for use_net, key in ((True, side), (False, "base_" + side)):
                env = env_mod.Env(mid, n, seed=s)
                scr = {i: scripted.Scripted(rng.getrandbits(32)) for i in range(n)}
                while not env.done:
                    seat, ob = env.decision()
                    if use_net and env.g.seats[seat].role0 == side:
                        env.act(net_act(net, ob)[0])
                    else:
                        env.act(scr[seat].act(env))
                aw = env.g.result["aliens_win"]
                res[key][0] += 1
                res[key][1] += int(aw if side == "alien" else not aw)
    return res
