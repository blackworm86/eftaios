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


def _choose_mode(rng, cfg, has_pool):   # has_pool: kept for the callers; the Hard copy is always there
    r = rng.random()
    if r < cfg["p_scripted"]:
        return "scripted"
    if r < cfg["p_scripted"] + cfg["p_pool"]:
        return "pool"
    return "self"


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
        who = []  # per seat: 'cur' | ('pool', net) | 'script'
        for i in range(n):
            if mode == "self":
                who.append("cur")
            elif mode == "pool":
                who.append("cur" if rng.random() < 0.5 else ("pool", teacher if (not pool or rng.random() < cfg["teacher_share"]) else rng.choice(pool)))
            else:
                who.append("cur" if rng.random() < 0.5 else "script")
        if "cur" not in who:
            who[0] = "cur"
        scr = {i: scripted.Scripted(rng.getrandbits(32)) for i in range(n) if who[i] == "script"}
        segs = {i: [[]] for i in range(n) if who[i] == "cur"}   # a seat's decisions; a Human killed by the Aliens starts a new list as an Alien
        seen = 0
        while not env.done:
            seat, ob = env.decision()
            c = who[seat]
            if c == "cur":
                a, lp, v = net_act(cur, ob)
                r = env.act(a)
                segs[seat][-1].append({"ob": ob, "a": a, "lp": lp, "v": v, "r": r})
            elif c == "script":
                env.act(scr[seat].act(env))
            else:
                env.act(net_act(c[1], ob)[0])
            for e in env.g.log[seen:]:
                j = e["seat"]
                if e["kind"] == "out" and e["text"].startswith("killed|human") and j in segs and segs[j][-1]:
                    segs[j][-1][-1]["r"] -= env_mod.REWARD["win"]   # killed by the Aliens: this Human has lost, whatever the Aliens do next
                    segs[j].append([])
            seen = len(env.g.log)
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


def collect_bc(job):
    """job = (cfg, target_decisions, seed). Rule-based players play every seat; every decision is kept (observation, action taken, final result),
    to teach the network the rule-based style before self-play starts."""
    cfg, target, seed = job
    rng = random.Random(seed)
    ids = maps_mod.official_ids()
    rows = {k: [] for k in ("dyn", "glob", "priv", "phase", "me", "mask", "map", "action", "ret")}
    done = 0
    while done < target:
        n = rng.choice(cfg["players"])
        mid = rng.choice(ids)
        env = env_mod.Env(mid, n, seed=rng.getrandbits(32))
        scr = [scripted.Scripted(rng.getrandbits(32)) for _ in range(n)]
        steps = []
        while not env.done:
            seat, ob = env.decision()
            a = scr[seat].act(env)
            env.act(a)
            steps.append((seat, ob, a))
        fr = env.final_rewards()
        for seat, ob, a in steps:
            m = np.zeros(N_CELLS, bool)
            m[:len(ob["mask"])] = ob["mask"]
            for k, v in (("dyn", ob["dyn"]), ("glob", ob["glob"]), ("priv", ob["priv"]), ("phase", ob["phase"]), ("me", ob["me"]), ("mask", m),
                         ("map", ids.index(mid)), ("action", a), ("ret", fr[seat])):
                rows[k].append(v)
        done += len(steps)
    return {k: (np.stack(v) if k in ("dyn", "glob", "priv", "mask") else np.asarray(v)) for k, v in rows.items()}


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


def evaluate_net(job):
    """job = (cfg, weights, opponent_weights, n_games, seed). The learner plays one side against the opponent network on the other, and the opponent plays
    both sides on the same deals as a baseline. Returns {key: [games, wins]} for keys human, alien, base_human, base_alien ('wins' = that side's team won)."""
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
                res[key][1] += int(aw if side == "alien" else not aw)
    return res
