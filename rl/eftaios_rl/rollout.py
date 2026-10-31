"""Self-play game collection (runs in worker processes, CPU only).

Each game is played by the current policy, the Hard copy and older checkpoints in a mix; only the decisions of seats played by the
current policy are kept for training. Advantages are worked out per seat at the end of each game (GAE).
"""
import random

import numpy as np
import torch
from torch.distributions import Categorical

from . import env as env_mod
from . import maps as maps_mod
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


def _choose_mode(rng, cfg, has_pool):   # has_pool: kept for the callers; the Hard copy is always there
    return "pool" if rng.random() < cfg["p_pool"] else "self"


def _close_killed(log, seen, segs, roles):
    """What the log says about a seat, from entry `seen` on; returns the new `seen`.
    A Human killed by the Aliens has lost, whatever the Aliens do next: its last Human decision gets the loss and the seat goes on as an Alien in a new list.
    A Human who escapes costs every Alien seat a little (REWARD escape_penalty): its latest decision, whatever the Aliens do later, so that they work to stop escapes
    and do not only aim at killing the last Human on board. roles: each seat's role now."""
    for e in log[seen:]:
        j = e["seat"]
        if e["kind"] == "out" and e["text"].startswith("killed|human") and j in segs and segs[j][-1]:
            segs[j][-1][-1]["r"] -= env_mod.REWARD["win"]
            segs[j].append([])
        elif e["kind"] == "out" and e["text"].startswith("escaped|human"):
            for i, ss in segs.items():
                if roles[i] == "alien" and ss[-1]:
                    ss[-1][-1]["r"] -= env_mod.REWARD["escape_penalty"]
    return len(log)


def collect(job):
    """job = (cfg, weights, pool_weights, teacher_weights, target_decisions, seed). Returns arrays for training and some statistics.
    Opponents in a game against others: the Hard copy (cfg teacher_share of the time) or one of the saved checkpoints."""
    cfg, weights, pool_w, teacher_w, target, seed = job
    rng = random.Random(seed)
    cur = _net(cfg, weights)
    pool = [_net(cfg, w) for w in pool_w]
    teacher = _net(cfg, teacher_w)
    ids = maps_mod.official_ids()
    rows = {k: [] for k in ("dyn", "glob", "priv", "phase", "me", "mask", "map", "action", "logp", "adv", "ret")}
    stats = {"games": 0, "aliens_win": 0, "decisions": 0, "escaped": 0, "players": 0}
    while stats["decisions"] < target:
        n = rng.choice(cfg["players"])
        mid = rng.choice(ids)
        env = env_mod.Env(mid, n, seed=rng.getrandbits(32))
        mode = _choose_mode(rng, cfg, bool(pool))
        who = []  # per seat: 'cur' | ('pool', net)
        for i in range(n):
            if mode == "self":
                who.append("cur")
            elif mode == "pool":
                who.append("cur" if rng.random() < 0.5 else ("pool", teacher if (not pool or rng.random() < cfg["teacher_share"]) else rng.choice(pool)))
        if "cur" not in who:
            who[0] = "cur"
        segs = {i: [[]] for i in range(n) if who[i] == "cur"}   # a seat's decisions; a Human killed by the Aliens starts a new list as an Alien
        seen = 0
        while not env.done:
            seat, ob = env.decision()
            c = who[seat]
            if c == "cur":
                a, lp, v = net_act(cur, ob)
                r = env.act(a)
                segs[seat][-1].append({"ob": ob, "a": a, "lp": lp, "v": v, "r": r})
            else:
                env.act(net_act(c[1], ob)[0])
            seen = _close_killed(env.g.log, seen, segs, [s_.role for s_ in env.g.seats])
        fr = env.final_rewards()
        stats["games"] += 1
        stats["aliens_win"] += int(env.g.result["aliens_win"])
        stats["escaped"] += len(env.g.result["escaped"])
        stats["players"] += n
        for seat, steps in ((s_, st_) for s_, ss in segs.items() for st_ in ss):
            if not steps:
                continue
            if steps is segs[seat][-1]:
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


def evaluate_net(job):
    """job = (cfg, weights, opponent_weights, n_games, seed). The learner plays one side against the opponent network on the other, and the opponent plays
    both sides on the same deals as a baseline. Returns {key: [games, wins]} for keys human, alien, base_human, base_alien ('wins' = that side's team won; for the Aliens: won, minus the share of Humans that escaped)."""
    cfg, weights, opp_w, n_games, seed = job
    rng = random.Random(seed)
    net, opp = _net(cfg, weights), _net(cfg, opp_w)
    ids = maps_mod.official_ids()
    res = {"human": [0, 0], "alien": [0, 0], "base_human": [0, 0], "base_alien": [0, 0]}
    for _ in range(n_games):
        n = rng.choice(cfg["players"])
        mid = rng.choice(ids)
        s = rng.getrandbits(32)
        for side in ("human", "alien"):
            for use_net, key in ((True, side), (False, "base_" + side)):
                env = env_mod.Env(mid, n, seed=s)
                while not env.done:
                    seat, ob = env.decision()
                    mine = use_net and env.g.seats[seat].role0 == side
                    env.act(net_act(net if mine else opp, ob)[0])
                aw = env.g.result["aliens_win"]
                res[key][0] += 1
                esc = len(env.g.result["escaped"]) / max(1, n // 2)
                res[key][1] += (int(aw) - esc) if side == "alien" else int(not aw)   # the Aliens' score: a win, minus the share of Humans that escaped
    return res
