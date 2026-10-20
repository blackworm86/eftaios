'use strict';
/* Bots for pass and play and online tables.
   A bot knows only what a player at the table knows: its own role, route and items, the public seat list
   and the public announcements in the log. It is handed only a public view of the table (seat names, the log,
   the turn, the rules), so it cannot read another seat's private state.

   For every other player the bot keeps a probability map of where they are, once assuming a Human and once
   assuming an Alien, and how likely each assumption is. Every round the maps move (a Human 1 sector, an Alien 1-2,
   3 once fed; Humans lean towards the hatches) and are corrected by what the player announced: Noise in
   Sector X (true, or a bluff), Silence (a Dangerous sector), Silent Sector (a Secure sector), attacks, items,
   hatches and Spotlights. An announcement that a Human could not have made counts as evidence of an Alien, one that
   fits a Human heading for a hatch as evidence of a Human. All decisions are made from these maps. */
const Bot = (() => {
  const LEVELS = ['easy', 'normal', 'hard'];
  const rnd = () => deckRnd();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const PUBLIC_POS = ['noise', 'attack', 'reveal', 'hatch'];
  const ITEM_VALUE = { clone: 6, sensor: 3, cat: 2, mutation: 1, defense: 6, adrenaline: 4, spotlight: 4, attack: 3, sedatives: 3, teleport: 1 };
  /* what each level knows how to do */
  const SKILL = {
    // think: seconds of visible thinking; mistake: chance to take one of the next-best moves; decoy: 0 random, 1 believable, 2 simulated;
    // allyCost: what it costs to kill a possible Alien by mistake (attacks eliminate everybody in the sector)
    easy:   { mem: 1.0, smartBluff: false, temp: 0.5, beta: 0.2, hunt: false, huntW: 0, roleFromMoves: false, lw: 0.6, dw: 8,  camp: 6,  pot: 4.5, attackAt: 3.5, items: false, bluff: false, think: 1.4, mistake: 0.18, decoy: 0, allyCost: 8, humanCal: 0.6 },
    normal: { mem: 2.5, smartBluff: true, temp: 0.25, beta: 0.45, hunt: true,  huntW: 4, roleFromMoves: true,  lw: 2,   dw: 18, camp: 10, pot: 6,   attackAt: 2.2, items: true,  bluff: true,  think: 2.6, mistake: 0.06, decoy: 1, allyCost: 10, humanCal: 0.45 },
    hard:   { mem: 3.5, smartBluff: true, temp: 0, beta: 0.7, hunt: true,  huntW: 4, roleFromMoves: true,  lw: 3,   dw: 28, camp: 16, pot: 8,   attackAt: 0.8, items: true,  bluff: true,  think: 4.2, mistake: 0,    decoy: 2, allyCost: 11, humanCal: 0.35 }
  };

  const skill = lvl => Object.assign({}, SKILL[lvl] || SKILL.normal, window.__skill && window.__skill[lvl]);   // __skill: tuning hook for benchmarks

  /* ---------- the board as a graph (cached per map) ---------- */
  let G = null;
  function graph() {
    const map = T.map;
    if (G && G.map === map) return G;
    const ids = [], idx = new Map(), ty = [];
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) { const t = map.grid[r][c]; if (t === 'x') continue; idx.set(cid(c, r), ids.length); ids.push(cid(c, r)); ty.push(t); }
    const N = ids.length, nb = ids.map(id => { const [c, r] = parseId(id); return neighbors(map, c, r).map(([a, b]) => idx.get(cid(a, b))).filter(j => j !== undefined); });
    const isHatch = i => '1234'.includes(ty[i]), isStart = i => ty[i] === 'H' || ty[i] === 'A';
    const nbA = nb.map(l => l.filter(j => !isHatch(j) && !isStart(j)));       // where an Alien may step
    const nbH = nb.map(l => l.filter(j => !isHatch(j) && !isStart(j)));       // where a Human may step (hatches handled apart)
    const hatchNb = nb.map(l => l.filter(isHatch));
    // Alien distances over the Alien graph
    const dA = ids.map((_, s) => {
      const d = new Uint8Array(N).fill(255); d[s] = 0; const q = [s];
      for (let h = 0; h < q.length; h++) { const i = q[h]; for (const j of nbA[i]) if (d[j] === 255) { d[j] = d[i] + 1; q.push(j); } }
      return d;
    });
    const within = k => dA.map(d => { const out = []; for (let j = 0; j < N; j++) if (d[j] >= 1 && d[j] <= k) out.push(j); return out; });
    G = { map, ids, idx, ty, N, nb, nbA, nbH, hatchNb, dA, reach: { 1: within(1), 2: within(2), 3: within(3) }, isHatch, isStart,
      dang: ty.map(t => t === '.'), sec: ty.map(t => t === 's') };
    // sectors an Alien/Human could name with "noise in any sector": 2 to 5 steps away
    G.ringOf = dA.map((d, s) => { const out = []; for (let j = 0; j < N; j++) if (d[j] >= 2 && d[j] <= 5 && !isHatch(j)) out.push(j); return out; });
    return G;
  }
  const hatchCells = () => { const g = graph(); return mapHatches().filter(n => hatchOpen(n)).map(n => g.idx.get(find(T.map, String(n)))).filter(i => i !== undefined); };
  /* steps for a Human from every sector to the nearest of `from` (hatch cells), walls and other hatches excluded */
  function humanDist(from) {
    const g = graph(), d = new Float64Array(g.N).fill(99), q = [];
    from.forEach(h => { d[h] = 0; q.push(h); });
    for (let k = 0; k < q.length; k++) { const i = q[k]; const nxt = g.isHatch(i) ? g.nb[i].filter(j => !g.isHatch(j) && !g.isStart(j)) : g.nbH[i]; for (const j of nxt) if (d[j] === 99) { d[j] = d[i] + 1; q.push(j); } }
    return d;
  }

  /* ---------- what the bot believes about everyone else (public information only) ---------- */
  const EPS = 0.004;
  /* sim = { entry }: what the others would believe about me if I announced `entry` now (returns my tracked seat only) */
  function beliefs(H, me, lvl = 'normal', sim) {
    const g = graph(), sk = skill(lvl), N = g.N, seats = H.seats, myIdx = seats.findIndex(s => s.id === me.id);
    const others = seats.filter(s => s.id !== me.id), n = seats.length;
    const aliens = n - Math.floor(n / 2), alienLeft = aliens - (me.state.role === 'alien' ? 1 : 0);
    const prior = others.length ? Math.max(0.05, Math.min(0.95, alienLeft / others.length)) : 0.5;
    const hatches = hatchCells(), hd = humanDist(hatches), startH = g.idx.get(find(T.map, 'H')), startA = g.idx.get(find(T.map, 'A'));
    const log = (sim ? [sim.entry].concat(H.log) : H.log).slice().reverse();    // oldest first
    const byP = {};
    log.forEach((e, i) => { if (!e.by) return; (byP[e.by] = byP[e.by] || []).push({ e, i }); });
    // movement kernels
    const kH = (d, withDrift) => {
      const o = new Float64Array(N);
      for (let s = 0; s < N; s++) {
        if (d[s] < 1e-9) continue; const l = g.nbH[s]; if (!l.length) continue;
        let z = 0; const w = l.map(j => { const x = withDrift ? Math.exp(-sk.beta * Math.min(hd[j], 30)) : 1; z += x; return x; });
        for (let k = 0; k < l.length; k++) o[l[k]] += d[s] * w[k] / z;
      }
      return o;
    };
    // Aliens chase what they hear: the field F is high near where other players last announced themselves
    const kA = (d, speed, F) => {
      const o = new Float64Array(N), R = g.reach[speed];
      for (let s = 0; s < N; s++) {
        if (d[s] < 1e-9) continue; const l = R[s]; if (!l.length) continue;
        if (!F) { const w = d[s] / l.length; for (let k = 0; k < l.length; k++) o[l[k]] += w; continue; }
        let z = 0; for (let k = 0; k < l.length; k++) z += 1 + sk.huntW * F[l[k]];
        for (let k = 0; k < l.length; k++) o[l[k]] += d[s] * (1 + sk.huntW * F[l[k]]) / z;
      }
      return o;
    };
    const pubEv = {}; log.forEach(e => { if (e.by && PUBLIC_POS.includes(e.kind) && e.sector) (pubEv[e.turn] = pubEv[e.turn] || []).push({ id: e.by, cell: g.idx.get(e.sector), t: e.turn }); });
    const lastPub = [new Map()]; for (let r = 1; r <= H.turn + 1; r++) { const m = new Map(lastPub[r - 1]); (pubEv[r] || []).forEach(x => { if (x.cell !== undefined) m.set(x.id, x); }); lastPub.push(m); }
    // Aliens also guard the hatches: a standing pull towards the sectors around each open hatch
    const campF = new Float64Array(N);
    hatches.forEach(h => { const ring = g.nbH[h]; for (let j = 0; j < N; j++) { let best = 0; for (const a of ring) { const d = g.dA[a][j]; if (d !== 255) best = Math.max(best, Math.exp(-d / 1.2)); } campF[j] += 0.5 * best; } });
    const fieldCache = new Map();
    const field = (r, self) => {
      const key = r + '|' + self; if (fieldCache.has(key)) return fieldCache.get(key);
      const F = Float64Array.from(campF); let any = true;
      (lastPub[r - 1] || new Map()).forEach((x, id) => { if (id === self) return; const w = Math.pow(0.8, r - 1 - x.t), d = g.dA[x.cell]; any = true; for (let j = 0; j < N; j++) if (d[j] !== 255) F[j] += w * Math.exp(-d[j] / 1.5); });
      const out = any ? F : null; fieldCache.set(key, out); return out;
    };
    // likelihood of one announcement for each possible true sector
    const likCache = new Map();
    const lik = (kind, X, qs) => {
      const key = kind + X + (qs ? '*' : ''); if (!qs && likCache.has(key)) return likCache.get(key);
      const v = new Float64Array(N);
      if (kind === 'noise' && qs) {   // a bluff names a believable sector: as likely as the prior says the player could be there
        const xi = g.idx.get(X), bl = xi !== undefined ? 0.4 * qs[xi] : 0;
        for (let s = 0; s < N; s++) v[s] = g.dang[s] ? EPS + (s === xi ? 0.4 : 0) + bl : EPS;
        return v;
      } else if (kind === 'noise') {
        const xi = g.idx.get(X);
        for (let s = 0; s < N; s++) {
          if (!g.dang[s]) { v[s] = EPS; continue; }
          const ring = g.ringOf[s], bluff = xi !== undefined && g.dA[s][xi] >= 2 && g.dA[s][xi] <= 5 ? 0.4 / Math.max(1, ring.length) : 0;
          v[s] = EPS + (s === xi ? 0.4 : 0) + bluff;
        }
      } else if (kind === 'silence') for (let s = 0; s < N; s++) v[s] = EPS + (g.dang[s] ? 0.2 : 0);
      else if (kind === 'secure') for (let s = 0; s < N; s++) v[s] = EPS + (g.sec[s] ? 1 : 0);
      else { const xi = g.idx.get(X); for (let s = 0; s < N; s++) v[s] = 0.01 + (s === xi ? 1 : 0); }   // exact: attack, hatch, Spotlight
      likCache.set(key, v); return v;
    };
    // the picture the others have of a player before the announcement, spread over the neighbouring sectors (where a decoy would be named)
    const smooth = (nH, nA, wH, wA) => {
      const q = new Float64Array(N); for (let k = 0; k < N; k++) q[k] = wH * nH[k] + wA * nA[k];
      const o = new Float64Array(N); for (let k = 0; k < N; k++) { let sum = 0, c = 0; for (const j of g.nb[k]) { sum += q[j]; c++; } o[k] = 0.5 * q[k] + (c ? 0.5 * sum / c : 0); }
      return o;
    };
    const B = {};
    const trackSeat = (s, acted) => {
      const idx = seats.indexOf(s);
      const dH = new Float64Array(N), dA = new Float64Array(N); dH[startH] = 1; dA[startA] = 1;
      const b = { id: s.id, name: s.name, pA: prior, dH, dA, track: [], fed: false, out: false, acted };
      let wH = 1 - prior, wA = prior, cH = dH, cA = dA, fedFrom = 1e9;
      const ev = {};                                                           // round -> [entries]
      (byP[s.id] || []).forEach(({ e, i }) => { (ev[e.turn] = ev[e.turn] || []).push({ e, i }); });
      let over = false, known = false;
      for (let r = 1; r <= acted && !over; r++) {
        const items = (ev[r] || []).filter(x => x.e.kind === 'item').map(x => x.e.text);
        // predict
        let nH = items.includes('teleport') ? kH(Object.assign(new Float64Array(N), { [startH]: 1 }), true) : kH(cH, true);
        if (items.includes('adrenaline')) { const two = kH(nH, true); for (let k = 0; k < N; k++) nH[k] = 0.3 * nH[k] + 0.7 * two[k]; }
        let nA = kA(cA, r >= fedFrom ? 3 : 2, sk.hunt ? field(r, s.id) : null);
        // evidence
        const L = new Float64Array(N).fill(1); let mulH = 1, mulA = 1, any = false;
        (ev[r] || []).forEach(({ e, i }) => {
          if (e.kind === 'noise' && e.sector) { const v = lik('noise', e.sector, sk.smartBluff ? smooth(nH, nA, wH, wA) : null); for (let k = 0; k < N; k++) L[k] *= v[k]; any = true; b.track.push({ turn: r, sector: e.sector, kind: 'noise' }); }
          else if (e.kind === 'silence') { const v = lik(e.text === 'secure' ? 'secure' : 'silence'); for (let k = 0; k < N; k++) L[k] *= v[k]; any = true; }
          else if (['attack', 'hatch', 'reveal'].includes(e.kind) && e.sector) {
            const v = lik('exact', e.sector); for (let k = 0; k < N; k++) L[k] *= v[k]; any = true; b.track.push({ turn: r, sector: e.sector, kind: e.kind });
            if (e.kind === 'attack') {
              const armed = (ev[r] || []).some(x => x.e.kind === 'item' && x.e.text === 'attack');
              known = true;
              if (armed) mulA *= 0.02; else { mulH *= 0.02; if (log.some((y, j) => j > i && j < i + 8 && y.kind === 'out' && y.turn === r && String(y.text).startsWith('killed|human'))) fedFrom = r + 1; }
            }
            if (e.kind === 'hatch') { mulA *= 0.02; known = true; }
          } else if (e.kind === 'item') { mulA *= 0.02; known = true; }         // only Humans can play items
          else if (e.kind === 'out') {
            const [why, role] = String(e.text).split('|');
            known = true;
            if (why === 'killed' && role === 'human') { wA = 1; wH = 0; }
            else { b.out = true; over = true; wA = role === 'alien' ? 1 : 0; wH = role === 'alien' ? 0 : 1; }
          }
        });
        if (over) break;
        if (any) {
          let mH = 0, mA = 0; for (let k = 0; k < N; k++) { mH += nH[k] * L[k]; mA += nA[k] * L[k]; }
          if (mH > 0) for (let k = 0; k < N; k++) nH[k] = nH[k] * L[k] / mH;
          if (mA > 0) for (let k = 0; k < N; k++) nA[k] = nA[k] * L[k] / mA;
          if (sk.roleFromMoves) { wH *= Math.pow(Math.max(mH, 1e-6), 0.5); wA *= Math.pow(Math.max(mA, 1e-6), 0.5); }
        }
        wH *= mulH; wA *= mulA; const z = wH + wA; if (z > 0) { wH /= z; wA /= z; } else { wH = 1 - prior; wA = prior; }
        cH = nH; cA = nA;
      }
      b.dH = cH; b.dA = cA; b.fed = fedFrom <= acted + 1; b.speed = b.fed ? 3 : 2;
      b.pA = known ? Math.min(0.995, Math.max(0.005, wA)) : Math.min(0.9, Math.max(0.22, 0.3 * prior + 0.7 * wA));   // nobody is ever sure from behaviour alone
      return b;
    };
    if (sim) return trackSeat(seats[myIdx] || { id: me.id, name: me.name }, H.turn);
    others.forEach(s => { B[s.id] = trackSeat(s, Math.max(0, H.turn - 1 + (seats.indexOf(s) < myIdx ? 1 : 0))); });
    // how the others see me: the same tracker run on my own public announcements, before my move this turn
    const mine = trackSeat(seats[myIdx] || { id: me.id, name: me.name }, Math.max(0, H.turn - 1));
    { const h = kH(mine.dH, true), a = kA(mine.dA, 2, sk.hunt ? field(H.turn, me.id) : null); mine.next = h.map((x, k) => (1 - mine.pA) * x + mine.pA * a[k]); }
    Object.defineProperty(B, 'me', { value: mine, enumerable: false });
    return B;
  }

  /* ---------- derived maps ---------- */
  function world(B, H, myIdx, lvl, st) {
    const g = graph(), N = g.N, sk = skill(lvl), live = Object.values(B).filter(b => !b.out);
    const seatIdx = id => H.seats.findIndex(s => s.id === id);
    const hatches = hatchCells(), hd = humanDist(hatches);
    const mulOcc = (list, get) => { const miss = new Float64Array(N).fill(1); list.forEach(b => { const d = get(b); for (let k = 0; k < N; k++) if (d[k] > 1e-6) miss[k] *= 1 - Math.min(0.98, d[k]); }); return miss.map(x => 1 - x); };
    const humanOcc = mulOcc(live, b => b.dH.map(x => x * (1 - b.pA)));
    const alienOcc = mulOcc(live, b => b.dA.map(x => x * b.pA));
    // expected number of Humans / Aliens standing in each sector (what an attack there would hit)
    const humanCnt = new Float64Array(N), alienCnt = new Float64Array(N);
    live.forEach(b => { for (let k = 0; k < N; k++) { humanCnt[k] += (1 - b.pA) * b.dH[k]; alienCnt[k] += b.pA * b.dA[k]; } });
    // chance that Alien b stands within strike range of each sector right now
    const strike = {}; live.forEach(b => { const o = new Float64Array(N), R = g.reach[b.speed]; for (let c = 0; c < N; c++) { let s = 0; for (const j of R[c]) s += b.dA[j]; o[c] = s * b.pA; } strike[b.id] = o; });
    // how well the others can place me after I end my move in c: they hear "Silent Sector" or Noise / Silence and
    // narrow down their picture of me (B.me.next) accordingly
    const mine = B.me.next, mSec = new Float64Array(N), mDang = new Float64Array(N); let zs = 0, zd = 0;
    for (let c = 0; c < N; c++) { if (g.sec[c]) { mSec[c] = mine[c]; zs += mine[c]; } else if (g.dang[c]) { mDang[c] = mine[c]; zd += mine[c]; } }
    const leak = c => g.sec[c] ? Math.min(0.95, zs > 1e-9 ? mSec[c] / zs : 0.3) : 0.45 + 0.55 * Math.min(1, zd > 1e-9 ? mDang[c] / zd : 0);
    // every Alien threatens where I end: those after me this round, those before me at the start of the next
    const risk = c => { let miss = 1; live.forEach(b => { miss *= 1 - Math.min(0.95, strike[b.id][c] * leak(c)); }); return 1 - miss; };
    // other Humans standing in the same sector are killed by the same attack
    const crowd = new Float64Array(N); live.forEach(b => { const p = 1 - b.pA; if (p > 0.05) for (let k = 0; k < N; k++) crowd[k] += p * b.dH[k]; });
    const T1 = new Float64Array(N); for (let c = 0; c < N; c++) T1[c] = risk(c);
    return { g, sk, B, live, humanOcc, alienOcc, humanCnt, alienCnt, strike, hatches, hd, risk, T1, crowd, seatIdx, lvl, turn: H.turn };
  }
  /* cheapest way to a hatch from every sector, each step costing 1 plus the danger of the sector */
  function pathCosts(W) {
    const g = W.g, N = g.N, cost = new Float64Array(N).fill(1e6), done = new Uint8Array(N);
    W.hatches.forEach(h => { cost[h] = 0; });
    for (let it = 0; it < N; it++) {
      let u = -1, best = 1e9; for (let i = 0; i < N; i++) if (!done[i] && cost[i] < best) { best = cost[i]; u = i; }
      if (u < 0) break; done[u] = 1;
      const via = g.isHatch(u) ? g.nb[u].filter(j => !g.isHatch(j) && !g.isStart(j)) : g.nbH[u];
      for (const j of via) {
        const guard = W.hatches.some(h => g.nb[h].includes(j)) ? 0.05 : 0;
        const c = cost[u] + 1 + W.sk.lw * (W.T1[j] + guard); if (c < cost[j]) cost[j] = c;
      }
    }
    return cost;
  }
  /* where Humans will be after one more move (for hunting) */
  function humanNext(W) {
    const g = W.g, N = g.N, miss = new Float64Array(N).fill(1);
    W.live.forEach(b => {
      const p = 1 - b.pA; if (p < 0.02) return; const o = new Float64Array(N);
      for (let s = 0; s < N; s++) { if (b.dH[s] < 1e-6) continue; const l = g.nbH[s]; if (!l.length) continue; let z = 0; const w = l.map(j => { const x = Math.exp(-W.sk.beta * Math.min(W.hd[j], 30)); z += x; return x; }); l.forEach((j, k) => { o[j] += b.dH[s] * w[k] / z; }); }
      for (let k = 0; k < N; k++) if (o[k] > 1e-6) miss[k] *= 1 - Math.min(0.98, p * o[k]);
    });
    return miss.map(x => 1 - x);
  }

  /* ---------- choices ---------- */
  /* sample among the good moves instead of always taking the best one: players who all think alike must not walk in lockstep */
  function softPick(list, temp) {
    const top = Math.max(...list.map(x => x.score)); if (temp <= 0.05) return list.find(x => x.score === top);
    let z = 0; const w = list.map(x => { const v = Math.exp((x.score - top) / temp); z += v; return v; });
    let r = rnd() * z; for (let k = 0; k < list.length; k++) { r -= w[k]; if (r <= 0) return list[k]; } return list[0];
  }
  /* the best move, or now and then one of the next best (a slip); a free escape is never missed */
  function choose(list, sk) {
    list.sort((a, b) => b.score - a.score);
    if (list[0].score >= 1000) return list[0];
    if (sk.mistake && list.length > 1 && rnd() < sk.mistake) return list[1 + Math.floor(rnd() * Math.min(2, list.length - 1))];
    return softPick(list, sk.temp);
  }
  function humanMove(W, st, steps) {
    const g = W.g, opts = [...reachable(T.map, st.pos, steps, 'human').keys()];
    if (!opts.length) return null;
    const cost = pathCosts(W), list = [];
    // the clock: the longer the game runs, the less a detour is worth and the more a risk is worth taking
    const hurry = W.lvl === 'easy' ? 1 : 1 + Math.max(0, W.turn - 6) * 0.08, calm = W.lvl === 'easy' ? 1 : Math.max(0.35, (42 - W.turn) / 36);
    const recent = new Set(st.path.slice(-5).map(p => p.pos));   // humans do not return to where they were
    opts.forEach(id => {
      const c = g.idx.get(id);
      if (g.isHatch(c)) return list.push({ id, cell: c, score: 1000 });
      let s = -cost[c] * hurry - W.sk.dw * calm * W.risk(c) - (W.lvl === 'easy' ? 0 : 3 * W.crowd[c]) - (recent.has(id) ? W.sk.mem : 0);
      if (g.sec[c]) s += 0.4 + (W.lvl === 'easy' ? 0 : 0.4);                   // Secure sectors make no noise
      list.push({ id, cell: c, score: s });
    });
    return choose(list, W.sk);
  }
  function alienMove(ctx, W, st, B) {
    const g = W.g, sk = W.sk, speed = st.fed ? 3 : 2, opts = [...reachable(T.map, st.pos, speed, 'alien').keys()];
    if (!opts.length) return null;
    const next = humanNext(W), turn = ctx.H.turn, late = turn >= 14 ? 1.5 : 1, hs = W.hatches;
    const recentA = new Set(st.path.slice(-4).map(p => p.pos));
    // hatches that Humans are heading for matter most
    const wH = hs.map(h => { const dh = humanDist([h]); let w = 0.15; for (let s = 0; s < g.N; s++) if (W.humanOcc[s] > 1e-4) w += W.humanOcc[s] * Math.exp(-dh[s] / 2.5); return w; });
    const mineH = hs.length ? hs[hashId(ctx.me.id) % hs.length] : -1, wsum = wH.reduce((a, b) => a + b, 0) + (mineH >= 0 ? 0.6 : 0);
    const list = [];
    opts.forEach(id => {
      const c = g.idx.get(id);
      let s = Math.max(0, alienAttackValue(ctx, W, st, c) - sk.attackAt * 0.5);
      // strike range next turn: the most likely sectors where a Human will be
      let top = 0, sum = 0; for (const j of g.reach[speed][c]) { const v = next[j]; sum += v; if (v > top) top = v; }
      s += sk.pot * (0.6 * top + 0.25 * sum);
      // camp the approaches to the hatches, weighted by where Humans are heading
      let camp = 0; hs.forEach((h, k) => {
        const ring = g.nbH[h]; if (!ring.length) return; let cov = 0;
        ring.forEach(a => { const d = g.dA[c][a]; cov += d === 0 ? 1 : d === 1 ? 0.85 : d <= speed ? 0.5 : 0; });
        camp += (wH[k] + (h === mineH ? 0.6 : 0)) * cov / ring.length;
      });
      s += sk.camp * late * (wsum ? camp / wsum : 0);
      if (recentA.has(id)) s -= sk.mem;   // no back-and-forth: an Alien that stops moving is easy to find
      s += rnd() * 0.3;
      list.push({ id, score: s, cell: c });
    });
    return choose(list, sk);
  }
  const hashId = id => { let x = 7; for (const ch of String(id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };

  /* ---------- attacks: everybody in the sector is eliminated, Aliens too ---------- */
  const KILL_VALUE = 10, FEED_BONUS = 3, ALIEN_KILL_VALUE = 14, HUMAN_LOSS = 12;
  /* what an attack from sector c is worth to an Alien: Humans hit are a gain (and the first one feeds me), an Alien hit is a loss */
  function alienAttackValue(ctx, W, st, c) {
    const feed = !st.fed ? FEED_BONUS : 0;
    // measured: the Humans an attack finds are about a third of what the tracker expects (the best-looking sector is picked), and
    // Aliens hunt the same targets, so they are met about 2.5 times as often as expected
    return W.humanCnt[c] * W.sk.humanCal * (KILL_VALUE + feed) - Math.min(1, W.alienCnt[c] * 2.5) * W.sk.allyCost;
  }
  /* the same for a Human playing an Attack card: Aliens hit are a big gain, a Human hit is a loss */
  function humanAttackValue(W, c) { return W.alienCnt[c] * ALIEN_KILL_VALUE - W.humanCnt[c] * HUMAN_LOSS; }
  /* is an attack here worth giving the sector away? */
  function attackWorth(ctx, W, st, lvl) {
    const g = W.g, c = g.idx.get(st.pos);
    let need = W.sk.attackAt;
    if (lvl !== 'easy' && ctx.H.turn >= 8 && W.hatches.some(h => g.nb[h].includes(c))) need *= 0.7;   // Humans have to come through here
    return alienAttackValue(ctx, W, st, c) >= need;
  }

  /* ---------- "noise in any sector": a decoy ---------- */
  /* Easy picks any Dangerous sector not far away. Normal and Hard try each candidate on the same tracker the others use
     and see what it would make them believe about me:
     - a Human wants the Aliens to think it is somewhere else (or even an Alien: they will not attack one by mistake);
     - an Alien wants the Humans to think no Alien is near and that it is one of them. */
  function chooseDecoy(ctx, st, W, me, lvl) {
    const g = W.g, c0 = g.idx.get(st.pos), sk = W.sk, H = ctx.H, cands = [];
    for (let x = 0; x < g.N; x++) { const d = g.dA[c0][x]; if (g.dang[x] && !g.isHatch(x) && x !== c0 && d !== 255 && d >= 2 && d <= 6) cands.push(x); }
    if (!cands.length) { const any = g.ringOf[c0]; return any.length ? g.ids[pick(any)] : st.pos; }
    if (!sk.decoy) { const x = pick(cands.filter(x => g.dA[c0][x] <= 4).concat(cands).slice(0, 12)); return g.ids[x]; }
    const human = st.role === 'human', near = new Set([c0].concat(g.nb[c0])), strikeZone = new Set([c0].concat(g.reach[2][c0]));
    const list = cands.map(x => {
      const o = beliefs(H, me, lvl, { entry: { by: me.id, who: me.name, turn: H.turn, kind: 'noise', sector: g.ids[x], text: 'noise', at: 0 } });
      const hum = c => (1 - o.pA) * o.dH[c], ali = c => o.pA * o.dA[c];
      let score;
      if (human) {
        // what an attacking Alien would see: the value of hitting my real sector, and the bait of the decoy sector
        const worth = c => KILL_VALUE * hum(c) - sk.allyCost * ali(c);
        let real = -1e9; near.forEach(c => { real = Math.max(real, worth(c)); });
        score = (sk.decoy > 1 ? 0.5 * worth(x) : 0) - 2 * Math.max(0, real);
      } else {
        let threat = 0; strikeZone.forEach(c => { threat += ali(c); });
        score = -(threat * 8 + o.pA * 5);
      }
      return { x, score: score + rnd() * 0.15 };
    });
    list.sort((a, b) => b.score - a.score);
    const top = list.slice(0, sk.decoy > 1 ? 3 : 5), r = softPick(top.map(t => ({ id: t.x, score: t.score })), sk.decoy > 1 ? 0.35 : 0.8);
    return g.ids[r.id];
  }

  /* ---------- one full turn ---------- */
  async function turn(ctx) {
    const H = ctx.H, idx = ctx.idx, me = ctx.me, st = me.state, lvl = LEVELS.includes(me.bot) ? me.bot : 'normal', sk = skill(lvl);
    const adv = H.mode !== 'basic', human = st.role === 'human', g = graph();
    const say = e => ctx.log(Object.assign({ by: me.id, who: me.name }, e));
    const useItem = id => { const i = st.items.indexOf(id); if (i < 0) return false; st.items.splice(i, 1); ctx.discard(id); say({ kind: 'item', text: id }); return true; };
    st.adr = false;
    // a visible moment of thought before anything happens; the same length whatever the bot is about to do
    if (ctx.think) await ctx.think(sk.think * 1000 * (0.8 + rnd() * 0.4));
    if (human && !hatchCells().length) { st.over = 'trapped'; st.outSent = true; ctx.out(idx, 'trapped'); return; }
    const B = beliefs(H, me, lvl); let W = world(B, H, idx, lvl, st);
    const myCell = () => g.idx.get(st.pos);
    // before moving: Adrenaline when it gets me to a hatch, or clearly out of danger
    if (human && adv && st.items.includes('adrenaline')) {
      const one = humanMove(W, st, 1), two = humanMove(W, st, 2), hdHere = W.hd[myCell()];
      const gain = two && one ? two.score - one.score : 0;
      if (two && (g.isHatch(two.cell) || (sk.items && gain > (lvl === 'hard' ? 4 : 7))) && !(one && g.isHatch(one.cell))) { if (useItem('adrenaline')) st.adr = true; }
    }
    // Spotlight where an Alien is most likely to be close
    if (human && adv && sk.items && st.items.includes('spotlight') && (lvl === 'hard' || rnd() < 0.5)) {
      let best = null; for (let c = 0; c < g.N; c++) { if (g.isHatch(c) || g.isStart(c)) continue; let s = W.alienOcc[c]; g.nb[c].forEach(j => { s += W.alienOcc[j]; }); if (!best || s > best.s) best = { c, s }; }
      if (best && best.s >= 0.7) { useItem('spotlight'); await ctx.spotlight(g.ids[best.c]); W = world(beliefs(H, me, lvl), H, idx, lvl, st); }
    }
    // move
    const choice = human ? humanMove(W, st, st.adr ? 2 : 1) : alienMove(ctx, W, st, B);
    if (choice) { st.pos = choice.id; st.path.push({ turn: H.turn, pos: choice.id }); }
    st.adr = false;
    const ty = at(T.map, st.pos), here = myCell();
    // escape hatch
    if (human && '1234'.includes(ty) && choice && hatchOpen(+ty)) {   // a pod card is drawn only on entering an open pod
      const n = +ty;
      if (ctx.draw('hatch', adv && st.char === 'Engineer') === 'green') { ctx.closeHatch(n); say({ kind: 'hatch', sector: st.pos, n, ok: 1 }); st.over = 'escaped'; st.outSent = true; ctx.out(idx, 'escaped'); return; }
      ctx.closeHatch(n); say({ kind: 'hatch', sector: st.pos, n, ok: 0 });
      return;
    }
    // Alien attack
    const worth = !human && attackWorth(ctx, W, st, lvl);
    if (window.__trace && !human && window.Hot && Hot.dump) {   // benchmark hook: what the tracker believed here against who really stands here
      const c0 = g.idx.get(st.pos); let truth = 0, aliens = 0;
      Hot.dump().seats.forEach(x => { if (x.id === me.id || x.over) return; const p = (x.path || []).filter(q => q.note !== 'reborn'); if (p.length && p[p.length - 1].pos === st.pos) { if (x.role === 'human') truth++; else aliens++; } });
      window.__trace.push({ lvl, turn: H.turn, pred: +W.humanCnt[c0].toFixed(3), predA: +W.alienCnt[c0].toFixed(3), truth, aliens, attack: !!worth, sec: ty !== '.' ? 1 : 0 });
    }
    if (worth) { say({ kind: 'attack', sector: st.pos }); const hits = await ctx.attack(st.pos); if (hits.some(h => h.killed && h.role === 'human') && !st.fed) st.fed = true; return; }
    // Human with an Attack card on a likely Alien
    if (human && adv && sk.items && st.items.includes('attack') && humanAttackValue(W, here) >= (lvl === 'hard' ? 3 : 5)) { useItem('attack'); say({ kind: 'attack', sector: st.pos }); await ctx.attack(st.pos); return; }
    if (ty !== '.') { say({ kind: 'silence', text: 'secure' }); return; }  // Secure sector: declare "Silent Sector"
    if (human && adv && sk.items && st.items.includes('sedatives') && W.risk(here) > (lvl === 'hard' ? 0.12 : 0.2)) { useItem('sedatives'); return; }
    let card = ctx.draw('sector') || 'silence'; const item = card.startsWith('item:') && adv ? card.slice(5) : '';
    if (card.startsWith('item:')) card = 'silence';
    if (card.startsWith('noise-self')) say({ kind: 'noise', sector: st.pos });
    else if (card.startsWith('noise-any')) say({ kind: 'noise', sector: chooseDecoy(ctx, st, W, me, lvl) });
    else say({ kind: 'silence' });
    if (item) st.items.push(item);   // kept to look like a Human; only some can be used by a bot
  }
  /* a plain list of the sectors a player could be in, for tests and tools */
  function zoneOf(b) { const g = graph(), o = []; for (let k = 0; k < g.N; k++) { const p = (1 - b.pA) * b.dH[k] + b.pA * b.dA[k]; if (p > 0.01) o.push([g.ids[k], p]); } return o; }
  return { turn, beliefs, zoneOf, LEVELS };
})();
window.Bot = Bot;
