"""Rules audit of game records (the format of nn/games.json and of Admin > Games "Download"): every game is checked against the rule book.
    python3 tools/rules_audit.py nn/games.json
Prints each broken rule with the game, turn and seat, then a summary. Checks: the deal (half Humans, odd tables one more Alien), how far each move goes
(Humans 1, Aliens 2, fed Aliens 3, Fast Alien 3 on its first move, +1 with Adrenaline), nobody walks into a start sector, only Aliens attack (or a Human
with an Attack card / the Soldier), nobody is harmed in a start sector or a pod, Escape Pods are used once, the noises match the sector one stands in,
and the end of the game. (The Psychic Alien is checked by tests/psychic.test.js: a record cannot tell a Silence card from an Item card.)"""
import collections
import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "rl"))
from eftaios_rl import maps  # noqa: E402


def audit(rec):
    g = rec["game"]
    b = maps.get(g["map"])
    seats, log, bad = g["seats"], g["log"], []
    n = len(seats)
    err = lambda t, i, msg: bad.append((t, i, msg))
    r0 = [s["role0"] for s in seats]
    if r0.count("human") != n // 2:
        err(0, -1, "deal: %d Humans of %d players (the rules: %d)" % (r0.count("human"), n, n // 2))
    route = [[(int(p.split(":")[0]), b.parse_id(p.split(":")[1]), (p.split(":") + [""])[2].replace("*", ""), "*" in p) for p in s["route"].split(",") if p] for s in seats]   # (turn, cell, note, a power was used)
    by = collections.defaultdict(list)
    for e in log:
        by[(e["t"], e["s"])].append(e)
    fed, used_pods = set(), set()
    killed_at = {}
    for k, e in enumerate(log):   # who fed: an attack that killed a Human
        if e["k"] == "attack":
            for o in log[k + 1:k + 9]:
                if o["t"] != e["t"] or o["k"] == "attack":
                    break
                if o["k"] == "out" and o["x"].startswith("killed|human"):
                    fed.add((e["s"], e["t"]))
    for i, s in enumerate(seats):
        pts = route[i]
        conv = None
        for a, c in zip(pts, pts[1:]):
            t, frm, to, note, star = c[0], a[1], c[1], c[2], c[3]
            if note in ("r", "c"):
                conv = t if note == "r" else conv
                continue
            if note == "t":       # Teleport: to the Human sector
                if b.kind[to] != "H":
                    err(t, i, "teleport not to the Human sector")
                continue
            role = "alien" if (s["role0"] == "alien" or (conv is not None and t >= conv) or any(p[2] == "m" and p[0] <= t for p in pts)) else "human"
            if note == "m":
                continue
            items = [e["x"] for e in by[(t, i)] if e["k"] == "item"]
            if to == frm:
                if note not in ("s", "l") and not star and not (role == "alien" and s["char"] == "Lurking Alien"):   # stay (Executive Officer) or lurk
                    err(t, i, "stood still without a power")
                continue
            if role == "human":
                k_ = 1 + ("adrenaline" in items)
            else:
                is_fed = any(f[0] == i and f[1] < t for f in fed)
                first = t == 1 and s["char"] == "Fast Alien"
                k_ = (3 if is_fed or first else 2) + ("adrenaline" in items)
            reach = b.reachable(frm, k_, role, {1, 2, 3, 4})
            if to not in reach:
                err(t, i, "%s moved %s -> %s, beyond %d sectors" % (role, b.cell_id(frm), b.cell_id(to), k_))
            if b.kind[to] in "HA":
                err(t, i, "walked into a start sector")
            if b.kind[to] in "1234":
                if role != "human":
                    err(t, i, "an Alien entered an Escape Pod")
                if to in used_pods:
                    err(t, i, "entered an Escape Pod already used")
                used_pods.add(to)
            # what was said must fit where one stands
            for e in by[(t, i)]:
                if e["k"] == "silence" and e["x"] == "secure" and b.kind[to] != "s":
                    err(t, i, "said 'silent sector' outside a Secure sector")
                if e["k"] == "noise" and b.kind[to] == "s" and e["c"] == b.cell_id(to):
                    err(t, i, "a noise in the Secure sector it stands in")
    for k, e in enumerate(log):
        if e["k"] == "attack":
            i, t = e["s"], e["t"]
            pts = route[i]
            human = seats[i]["role0"] == "human" and not any(p[2] in ("r", "m") and p[0] <= t for p in pts)
            if human and not any(o["k"] == "item" and o["x"] == "attack" for o in by[(t, i)]) and not any(o["k"] == "reveal" and o["x"] == "Id|human|Soldier" for o in by[(t, i)]):
                err(t, i, "a Human attacked without an Attack card or the Soldier")
        if e["k"] == "out" and e["x"].startswith("killed"):
            v, t = e["s"], e["t"]
            before = [p for p in route[v] if p[0] <= t and p[2] not in ("r", "c")]
            if before and b.kind[before[-1][1]] in "HA1234":
                err(t, v, "killed in a safe zone (%s)" % b.cell_id(before[-1][1]))
    res = g.get("result") or {}
    on_board = [i for i, s in enumerate(seats) if s["role"] == "human" and not s["over"]]
    if res.get("reason") in ("escape", "eliminated") and on_board:
        err(g["turns"], -1, "the game ended with Humans still on board")
    if res.get("reason") == "time" and g["turns"] <= 40:
        err(g["turns"], -1, "time up before turn 40")
    if g["turns"] > 41:
        err(g["turns"], -1, "more than 40 turns")
    return bad


def main(path):
    recs = json.load(open(path))
    total, kinds = 0, collections.Counter()
    for k, rec in enumerate(recs):
        for t, i, msg in audit(rec):
            total += 1
            kinds[msg.split(" (")[0].split(" -> ")[0]] += 1
            print("game %d (%s, %d players, %s), turn %d, seat %d: %s" % (k + 1, rec.get("label", ""), len(rec["game"]["seats"]), rec["game"]["map"], t, i + 1, msg))
    print("\n%d games checked, %d broken rules" % (len(recs), total))
    for m, c in kinds.most_common():
        print("  %4d  %s" % (c, m))
    return 0 if total == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1] if len(sys.argv) > 1 else "nn/games.json"))
