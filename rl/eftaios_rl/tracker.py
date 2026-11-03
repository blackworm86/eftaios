"""The Hard bot's picture of the table, in Python: a port of beliefs() and world() in bot.js (level hard).

From the public announcements only, for one seat (the observer) it works out for every other seat how likely it is an Alien and where it probably is
if it is a Human and if it is an Alien. From these: the expected number of Humans and of Aliens in each sector. The network takes those two maps and the
chances as input (env.py); the teacher recordings hold the same numbers made by the app (tests/check_tracker.py compares the two).

Cells are board cells (row * cols + col); the graph inside is the app's: walkable sectors only, in board order.
"""
import math

import numpy as np

EPS = 0.004
PUBLIC_POS = ("noise", "attack", "reveal", "hatch")
HARD = dict(beta=0.7, hunt_w=4.0)   # skill 'hard': drift of Humans towards a pod, pull of Aliens towards what they hear; smartBluff, roleFromMoves, table on
_GRAPHS = {}


class Graph:
    def __init__(self, board):
        self.board = board
        kind = board.kind
        self.cells = [c for c in range(board.n) if kind[c] != "x"]
        self.N = N = len(self.cells)
        self.idx = {c: i for i, c in enumerate(self.cells)}
        ty = [kind[c] for c in self.cells]
        self.ty = ty
        hatch = np.array([t in "1234" for t in ty])
        start = np.array([t in "HA" for t in ty])
        self.hatch, self.start = hatch, start
        nb = [[self.idx[j] for j in board.neighbors[c] if j in self.idx] for c in self.cells]
        self.nb = nb
        nbh = [[j for j in l if not hatch[j] and not start[j]] for l in nb]
        self.nbh = nbh
        self.M = np.zeros((N, N))        # average over all neighbours (smoothing of a believed position)
        for k, l in enumerate(nb):
            for j in l:
                self.M[k, j] = 1.0 / len(l)
        self.has_nb = np.array([len(l) > 0 for l in nb])
        self.Ah = np.zeros((N, N))       # where a Human or an Alien may step
        for s, l in enumerate(nbh):
            for j in l:
                self.Ah[s, j] = 1.0
        d = np.full((N, N), 255, np.int32)
        for s in range(N):
            d[s, s] = 0
            q = [s]
            for i in q:
                for j in nbh[i]:
                    if d[s, j] == 255:
                        d[s, j] = d[s, i] + 1
                        q.append(j)
        self.dA = d
        self.R = {k: ((d >= 1) & (d <= k)).astype(np.float64) for k in (1, 2, 3)}
        self.dang = np.array([t == "." for t in ty])
        self.sec = np.array([t == "s" for t in ty])
        self.ring = ((d >= 2) & (d <= 5) & ~hatch[None, :]).astype(np.float64)   # sectors a player could name with "noise in any sector"
        self.ring_n = np.maximum(1, self.ring.sum(1))
        self.start_h = self.idx[board.start_h]
        self.start_a = self.idx[board.start_a]
        e = lambda k: np.where(d == 255, 0.0, np.exp(-np.minimum(d, 254) / k))
        self.E15, self.E12 = e(1.5), e(1.2)   # exp(-d / k); 0 where there is no way


def graph(board):
    g = _GRAPHS.get(board.id)
    if g is None:
        g = _GRAPHS[board.id] = Graph(board)
    return g


def _human_dist(g, hatches):
    d = np.full(g.N, 99.0)
    q = list(hatches)
    for h in q:
        d[h] = 0
    for i in q:
        nxt = [j for j in g.nb[i] if not g.hatch[j] and not g.start[j]] if g.hatch[i] else g.nbh[i]
        for j in nxt:
            if d[j] == 99:
                d[j] = d[i] + 1
                q.append(j)
    return d


def pictures(board, log, n, me, me_role, turn, open_pods):
    """The picture of seat `me` (playing `me_role`, at game turn `turn`; `open_pods`: the pods still open) from the engine's public log
    (dicts: turn, seat, kind, cell, text). Returns {'p': [chance each seat is an Alien, -1 for me], 'h': expected Humans per board cell, 'a': expected Aliens per board cell}
    as float64 arrays over the board's cells."""
    g = graph(board)
    N, sk = g.N, HARD
    others = [j for j in range(n) if j != me]
    aliens = n - n // 2
    alien_left = aliens - (1 if me_role == "alien" else 0)
    prior = max(0.05, min(0.95, alien_left / len(others))) if others else 0.5
    hatches = [g.idx[board.pod_cell[k]] for k in sorted(open_pods) if board.pod_cell.get(k) in g.idx]
    hd = _human_dist(g, hatches)
    w_h = np.exp(-sk["beta"] * np.minimum(hd, 30))
    Wh = g.Ah * w_h[None, :]
    z = Wh.sum(1)
    Ph = np.where(z[:, None] > 0, Wh / np.where(z > 0, z, 1)[:, None], 0.0)   # a Human's step: towards the pods
    log = [e for e in log]   # oldest first
    sector = lambda e: g.idx.get(e["cell"]) if e["cell"] is not None else None
    by_p = {}
    for i, e in enumerate(log):
        by_p.setdefault(e["seat"], []).append((e, i))

    def kH(d):
        d = np.where(d < 1e-9, 0.0, d)
        return Ph.T @ d

    def kA(d, speed, F):
        d = np.where(d < 1e-9, 0.0, d)
        R = g.R[speed]
        if F is None:
            cnt = R.sum(1)
            return R.T @ np.where(cnt > 0, d / np.where(cnt > 0, cnt, 1), 0.0)
        w = 1 + sk["hunt_w"] * F
        zz = R @ w
        return (R.T @ np.where(zz > 0, d / np.where(zz > 0, zz, 1), 0.0)) * w

    pub_ev = {}
    for e in log:
        if e["kind"] in PUBLIC_POS and e["cell"] is not None and e["cell"] in g.idx:
            pub_ev.setdefault(e["turn"], []).append((e["seat"], g.idx[e["cell"]], e["turn"]))
    last_pub = [{}]
    for r in range(1, turn + 2):
        m = dict(last_pub[r - 1])
        for sid, cell, t in pub_ev.get(r, []):
            m[sid] = (cell, t)
        last_pub.append(m)
    camp = np.zeros(N)
    for h in hatches:
        ring = g.nbh[h]
        if ring:
            camp += 0.5 * g.E12[ring, :].max(0)
    field_cache = {}

    def field(r, self_):
        key = (r, self_)
        if key not in field_cache:
            F = camp.copy()
            for sid, (cell, t) in (last_pub[r - 1] if r - 1 < len(last_pub) else {}).items():
                if sid == self_:
                    continue
                F += 0.8 ** (r - 1 - t) * g.E15[cell]
            field_cache[key] = F
        return field_cache[key]

    lik_cache = {}

    def lik(kind, X, qs=None):
        xi = g.idx.get(X) if X is not None else None
        key = (kind, X, qs is not None)
        if qs is None and key in lik_cache:
            return lik_cache[key]
        v = np.full(N, EPS)
        if kind == "noise" and qs is not None:   # a bluff names a believable sector
            bl = 0.4 * qs[xi] if xi is not None else 0.0
            v = np.where(g.dang, EPS + bl, EPS)
            if xi is not None and g.dang[xi]:
                v[xi] += 0.4
            return v
        if kind == "noise":
            bluff = np.zeros(N)
            if xi is not None:
                bluff = np.where((g.dA[:, xi] >= 2) & (g.dA[:, xi] <= 5), 0.4 / g.ring_n, 0.0)
            v = np.where(g.dang, EPS + bluff, EPS)
            if xi is not None:
                v[xi] += 0.4 if g.dang[xi] else 0.0
        elif kind == "silence":
            v = EPS + np.where(g.dang, 0.2, 0.0)
        elif kind == "secure":
            v = EPS + np.where(g.sec, 1.0, 0.0)
        else:   # exact: an attack, a pod, a Spotlight
            v = np.full(N, 0.01)
            if xi is not None:
                v[xi] += 1.0
        if qs is None:
            lik_cache[key] = v
        return v

    def smooth(nH, nA, wH, wA):
        q = wH * nH + wA * nA
        return 0.5 * q + np.where(g.has_nb, 0.5 * (g.M @ q), 0.0)

    ord_ = list(range(n))
    hits = []
    for i, e in enumerate(log):
        if e["kind"] != "attack" or e["cell"] is None or e["cell"] not in g.idx or g.hatch[g.idx[e["cell"]]]:
            continue
        ex = set()
        j = i + 1
        while j < len(log) and j < i + 14 and log[j]["turn"] == e["turn"]:
            y = log[j]
            if y["kind"] == "out" or (y["kind"] == "item" and y["text"] in ("defense", "clone")) or (y["kind"] == "reveal" and y["text"] == "Brute Alien"):
                ex.add(y["seat"])
            j += 1
        hits.append((e["seat"], e["turn"], g.idx[e["cell"]], ex))

    def track(s, acted):
        dH = np.zeros(N)
        dA = np.zeros(N)
        dH[g.start_h] = 1
        dA[g.start_a] = 1
        wH, wA = 1 - prior, prior
        cH, cA = dH, dA
        fed_from = 1e9
        ev = {}
        for e, i in by_p.get(s, []):
            ev.setdefault(e["turn"], []).append((e, i))
        over = known = out = False

        def no_show(dh, da, r, after):
            nonlocal wH, wA
            for by, hr, x, ex in hits:
                if hr != r or by == s or s in ex or (ord_[s] < ord_[by]) != after:
                    continue
                wH *= (1 - min(0.98, dh[x])) ** 0.5
                wA *= (1 - min(0.98, da[x])) ** 0.5
                dh[x] *= 0.02
                da[x] *= 0.02
                zh, za = dh.sum(), da.sum()
                if zh > 0:
                    dh /= zh
                if za > 0:
                    da /= za

        for r in range(1, acted + 1):
            if over:
                break
            conv = mut = False
            cH, cA = cH.copy(), cA.copy()
            no_show(cH, cA, r, False)
            items = [x[0]["text"] for x in ev.get(r, []) if x[0]["kind"] == "item"]
            if "teleport" in items:
                u = np.zeros(N)
                u[g.start_h] = 1
                nH = kH(u)
            else:
                nH = kH(cH)
            if "adrenaline" in items:
                two = kH(nH)
                nH = 0.3 * nH + 0.7 * two
            nA = kA(cA, 3 if r >= fed_from else 2, field(r, s))
            L = np.ones(N)
            mulH = mulA = 1.0
            anyev = False
            for e, i in ev.get(r, []):
                k, text, cell = e["kind"], e["text"], sector(e)
                if k == "noise" and cell is not None:
                    L = L * lik("noise", e["cell"], smooth(nH, nA, wH, wA))
                    anyev = True
                elif k == "silence":
                    L = L * lik("secure" if text == "secure" else "silence", None)
                    anyev = True
                elif k in ("attack", "hatch", "reveal") and cell is not None:
                    L = L * lik("exact", e["cell"])
                    anyev = True
                    if k == "attack":
                        armed = any(x[0]["kind"] == "item" and x[0]["text"] == "attack" for x in ev.get(r, []))
                        known = True
                        if armed:
                            mulA *= 0.02
                        else:
                            mulH *= 0.02
                            if any(y["kind"] == "out" and y["turn"] == r and y["text"].startswith("killed|human") for y in log[i + 1:i + 8]):
                                fed_from = r + 1
                    if k == "hatch":
                        mulA *= 0.02
                        known = True
                elif k == "item" and text.lower() == "mutation":
                    wA, wH, known, mut = 1.0, 0.0, True, True
                elif k == "item":
                    mulA *= 0.08 if text in ("teleport", "adrenaline", "sedatives") else 0.02
                    known = True
                elif k == "reveal" and text.startswith("Id|"):
                    known = True
                    wA = 1.0 if text.split("|")[1] == "alien" else 0.0
                    wH = 1 - wA
                elif k == "out":
                    why, role = text.split("|")[:2]
                    known = True
                    if why == "killed" and role == "human":
                        wA, wH, conv = 1.0, 0.0, True
                    else:
                        out = over = True
                        wA = 1.0 if role == "alien" else 0.0
                        wH = 1 - wA
            if over:
                break
            if anyev:
                mH, mA = float(nH @ L), float(nA @ L)
                if mH > 0:
                    nH = nH * L / mH
                if mA > 0:
                    nA = nA * L / mA
                wH *= max(mH, 1e-6) ** 0.5
                wA *= max(mA, 1e-6) ** 0.5
            no_show(nH, nA, r, True)
            wH *= mulH
            wA *= mulA
            zz = wH + wA
            if zz > 0:
                wH, wA = wH / zz, wA / zz
            else:
                wH, wA = 1 - prior, prior
            cH, cA = nH, nA
            if mut:
                cA = nH.copy()
            if conv:
                cA = np.zeros(N)
                cA[g.start_a] = 1
                fed_from = 1e9
        pA = min(0.995, max(0.005, wA)) if known else min(0.9, max(0.22, 0.3 * prior + 0.7 * wA))
        return {"pA": pA, "dH": cH, "dA": cA, "out": out}

    B = {j: track(j, max(0, turn - 1 + (1 if j < me else 0))) for j in others}
    # the number of Aliens at the table is known: scale the doubts so that they add up to it
    live = [j for j in others if not B[j]["out"]]
    conv = mutc = dead = 0
    for e in log:
        if e["kind"] == "out":
            why, role = e["text"].split("|")[:2]
            if why == "killed" and role == "human":
                conv += 1
            elif why == "killed" and role == "alien":
                dead += 1
        elif e["kind"] == "item" and e["text"].lower() == "mutation":
            mutc += 1
    target = aliens + conv + mutc - dead - (1 if me_role == "alien" else 0)
    if live and 0 < target < len(live):
        lg = lambda p: math.log(p / (1 - p))
        sg = lambda x: 1 / (1 + math.exp(-x))
        total = lambda l: sum(sg(lg(B[j]["pA"]) + l) for j in live)
        lo, hi = -6.0, 6.0
        for _ in range(30):
            m = (lo + hi) / 2
            if total(m) < target:
                lo = m
            else:
                hi = m
        shift = 0.7 * (lo + hi) / 2
        for j in live:
            B[j]["pA"] = min(0.995, max(0.005, sg(lg(B[j]["pA"]) + shift)))
    hc, ac = np.zeros(N), np.zeros(N)
    for j in live:
        hc += (1 - B[j]["pA"]) * B[j]["dH"]
        ac += B[j]["pA"] * B[j]["dA"]
    h_board, a_board = np.zeros(board.n), np.zeros(board.n)
    h_board[g.cells] = hc
    a_board[g.cells] = ac
    p = [(-1.0 if j == me else B[j]["pA"]) for j in range(n)]
    return {"p": p, "h": h_board, "a": a_board}


def quantise(v):
    """A map as the network gets it: 0-255 in steps of 8 (like nn.js packBel); returns {cell: value} for values of 8 and more."""
    q = (np.floor(np.float32(np.minimum(1.0, np.maximum(0.0, v))) * 255).astype(np.int64) // 8) * 8
    return {int(c): int(q[c]) for c in np.flatnonzero(q >= 8)}


def chance(v):
    """A chance as the network gets it: two decimals, rounded half up like Math.round in nn.js; -1 stays."""
    return -1.0 if v < 0 else math.floor(v * 100 + 0.5) / 100


def belief(board, log, n, me, me_role, turn, open_pods):
    """The picture for the network, in the form of the teacher recordings: {'h': {cell: 8-255}, 'a': {...}, 'p': {seat: chance}}."""
    pic = pictures(board, log, n, me, me_role, turn, open_pods)
    return {"h": quantise(pic["h"]), "a": quantise(pic["a"]), "p": {j: chance(v) for j, v in enumerate(pic["p"])}}
