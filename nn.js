'use strict';
/* The neural-network player (trained with rl/): runs the exported network in plain JavaScript.
   It decides three things for a seat: where to move, whether an Alien attacks, and which sector to name for "noise in any sector".
   Its inputs are exactly what rl/eftaios_rl/env.py builds (public announcements and the seat's own state); rl/tests/parity.test.js checks both
   the inputs and the outputs against Python. Everything else (Items, Character powers) stays with bot.js. */
const NN = (() => {
  const D_DYN = 29, D_STAT = 9, G_DIM = 96, SLOTS = 7, AGES = 8, N_CELLS = 322, PHASE = { move: 0, attack: 1, decoy: 2 };
  let net = null, loading = null;
  const boards = new Map();

  /* ---------- the network ---------- */
  function parse(blob) {
    const w = {};
    for (const [k, v] of Object.entries(blob.weights)) w[k] = Float32Array.from(v.data);
    return { hid: blob.hid, layers: blob.layers, w, it: blob.iteration || 0 };
  }
  async function load(url = 'nn/net.json') {
    if (net) return true;
    if (!loading) loading = fetch(url, { cache: 'no-cache' }).then(r => (r.ok ? r.json() : Promise.reject(new Error('no network file')))).then(b => { net = parse(b); return true; }).catch(e => { loading = null; console.warn('NN not loaded', e.message); return false; });
    return loading;
  }
  const use = blob => { net = parse(blob); boards.clear(); };   // tests hand the network in directly
  const ready = () => !!net;

  // y[i][o] = sum_k x[i][k] * W[o][k] + b[o]   (PyTorch Linear: W is (out, in))
  function linear(x, n, din, W, b, dout) {
    const y = new Float32Array(n * dout);
    for (let i = 0; i < n; i++) { const xo = i * din; for (let o = 0; o < dout; o++) { let s = b[o]; const wo = o * din; for (let k = 0; k < din; k++) s += x[xo + k] * W[wo + k]; y[i * dout + o] = s; } }
    return y;
  }
  function layerNorm(x, n, d, w, b) {   // in place, eps as PyTorch
    for (let i = 0; i < n; i++) {
      let m = 0, v = 0; const o = i * d;
      for (let k = 0; k < d; k++) m += x[o + k]; m /= d;
      for (let k = 0; k < d; k++) { const t = x[o + k] - m; v += t * t; } v /= d;
      const inv = 1 / Math.sqrt(v + 1e-5);
      for (let k = 0; k < d; k++) x[o + k] = (x[o + k] - m) * inv * w[k] + b[k];
    }
    return x;
  }
  /* graph layer: for each sector the normalised sum over itself and its walkable neighbours */
  function propagate(h, bd, hid) {
    const out = new Float32Array(h.length);
    for (const i of bd.walk) {
      const o = i * hid;
      for (const [j, a] of bd.adj[i]) { const jo = j * hid; for (let k = 0; k < hid; k++) out[o + k] += a * h[jo + k]; }
    }
    return out;
  }
  /* multi-head self attention over the walkable sectors only (walls are masked in the Python model) */
  function attention(h, bd, hid, p) {
    const idx = bd.walk, n = idx.length, H = 4, hd = hid / H;
    const x = new Float32Array(n * hid);
    idx.forEach((i, r) => x.set(h.subarray(i * hid, i * hid + hid), r * hid));
    const W = p.in_w, B = p.in_b;
    const q = linear(x, n, hid, W.subarray(0, hid * hid), B.subarray(0, hid), hid);
    const k = linear(x, n, hid, W.subarray(hid * hid, 2 * hid * hid), B.subarray(hid, 2 * hid), hid);
    const v = linear(x, n, hid, W.subarray(2 * hid * hid, 3 * hid * hid), B.subarray(2 * hid, 3 * hid), hid);
    const ctx = new Float32Array(n * hid), sc = new Float32Array(n), scale = 1 / Math.sqrt(hd);
    for (let hh = 0; hh < H; hh++) {
      for (let i = 0; i < n; i++) {
        let mx = -1e30;
        for (let j = 0; j < n; j++) { let s = 0; for (let d = 0; d < hd; d++) s += q[i * hid + hh * hd + d] * k[j * hid + hh * hd + d]; s *= scale; sc[j] = s; if (s > mx) mx = s; }
        let z = 0; for (let j = 0; j < n; j++) { sc[j] = Math.exp(sc[j] - mx); z += sc[j]; }
        for (let j = 0; j < n; j++) { const a = sc[j] / z, jo = j * hid + hh * hd, io = i * hid + hh * hd; for (let d = 0; d < hd; d++) ctx[io + d] += a * v[jo + d]; }
      }
    }
    const o = linear(ctx, n, hid, p.out_w, p.out_b, hid), full = new Float32Array(h.length);
    idx.forEach((i, r) => full.set(o.subarray(r * hid, r * hid + hid), i * hid));
    return full;
  }
  /* obs = { dyn: Uint8Array(D_DYN * N), glob, phase, me, mask: Uint8Array(N) } -> logits (Float32Array N, -Infinity where not allowed) */
  function forward(obs, bd) {
    const { hid, layers, w } = net, N = bd.N;
    const x = new Float32Array(N * (D_DYN + D_STAT));
    for (let i = 0; i < N; i++) { const o = i * (D_DYN + D_STAT); for (let c = 0; c < D_DYN; c++) x[o + c] = obs.dyn[c * N + i] / 255; for (let c = 0; c < D_STAT; c++) x[o + D_DYN + c] = bd.stat[c * N + i]; }
    const g = linear(obs.glob, 1, G_DIM, w['gproj.weight'], w['gproj.bias'], hid);
    for (let k = 0; k < hid; k++) g[k] += w['phase_emb.weight'][obs.phase * hid + k];
    let h = linear(x, N, D_DYN + D_STAT, w['inp.weight'], w['inp.bias'], hid);
    for (let i = 0; i < N; i++) for (let k = 0; k < hid; k++) h[i * hid + k] = Math.max(0, h[i * hid + k] + g[k]);
    for (let l = 0; l < layers; l++) {
      const m = layerNorm(propagate(linear(h, N, hid, w['lins.' + l + '.weight'], w['lins.' + l + '.bias'], hid), bd, hid), N, hid, w['norms.' + l + '.weight'], w['norms.' + l + '.bias']);
      for (const i of bd.walk) for (let k = 0; k < hid; k++) h[i * hid + k] += Math.max(0, m[i * hid + k]);
      if (l === (layers >> 1) - 1 || l === layers - 1) {
        const a = l < layers - 1 ? 0 : 1;
        const at = attention(h, bd, hid, { in_w: w['attn.' + a + '.in_proj_weight'], in_b: w['attn.' + a + '.in_proj_bias'], out_w: w['attn.' + a + '.out_proj.weight'], out_b: w['attn.' + a + '.out_proj.bias'] });
        const t = layerNorm(at, N, hid, w['attn_norm.' + a + '.weight'], w['attn_norm.' + a + '.bias']);
        for (const i of bd.walk) for (let k = 0; k < hid; k++) h[i * hid + k] += t[i * hid + k];
      }
    }
    const pooled = new Float32Array(hid), hmax = new Float32Array(hid).fill(-1e4);
    for (const i of bd.walk) for (let k = 0; k < hid; k++) { const v = h[i * hid + k]; pooled[k] += v / bd.walk.length; if (v > hmax[k]) hmax[k] = v; }
    const pin = new Float32Array(2 * hid); pin.set(pooled); pin.set(hmax, hid);
    const gemb = linear(pin, 1, 2 * hid, w['pool.weight'], w['pool.bias'], hid).map(v => Math.max(0, v));
    const logits = new Float32Array(N).fill(-Infinity);
    if (obs.phase === PHASE.attack) {
      const inp = new Float32Array(3 * hid); inp.set(gemb); inp.set(h.subarray(obs.me * hid, obs.me * hid + hid), hid); inp.set(g, 2 * hid);
      const a1 = linear(inp, 1, 3 * hid, w['attack_head.0.weight'], w['attack_head.0.bias'], hid).map(v => Math.max(0, v));
      const a2 = linear(a1, 1, hid, w['attack_head.2.weight'], w['attack_head.2.bias'], 2);
      logits[0] = a2[0]; logits[1] = a2[1];
      return logits;
    }
    const W = obs.phase === PHASE.decoy ? w['decoy_head.weight'] : w['move_head.weight'], b = (obs.phase === PHASE.decoy ? w['decoy_head.bias'] : w['move_head.bias'])[0];
    for (const i of bd.walk) { if (!obs.mask[i]) continue; let s = b; for (let k = 0; k < hid; k++) s += h[i * hid + k] * W[k] + gemb[k] * W[hid + k]; logits[i] = s; }
    return logits;
  }

  /* ---------- the board, as rl/eftaios_rl/maps.py ---------- */
  function boardOf(map) {
    if (map.cols !== 23 || map.rows !== 14) return null;
    let bd = boards.get(map.id);
    if (bd && bd.map === map) return bd;
    const N = map.cols * map.rows, kind = new Array(N), nb = new Array(N), pods = {};
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
      const i = r * map.cols + c; kind[i] = map.grid[r][c];
      nb[i] = neighbors(map, c, r).map(([a, b]) => b * map.cols + a);
      if ('1234'.includes(kind[i])) pods[kind[i]] = i;
    }
    const walk = [], adj = new Array(N).fill(null).map(() => []), deg = new Array(N).fill(0);
    for (let i = 0; i < N; i++) if (kind[i] !== 'x') { walk.push(i); deg[i] = 1 + nb[i].filter(j => kind[j] !== 'x').length; }
    for (const i of walk) { adj[i].push([i, 1 / deg[i]]); for (const j of nb[i]) if (kind[j] !== 'x') adj[i].push([j, 1 / Math.sqrt(deg[i] * deg[j])]); }
    const stat = new Float32Array(D_STAT * N), KIND = ['x', '.', 's', 'H', 'A', '1', '2', '3', '4'];
    for (let i = 0; i < N; i++) KIND.forEach((ch, c) => { stat[c * N + i] = kind[i] === ch ? 1 : 0; });
    bd = { map, N, kind, nb, pods, walk, adj, stat, cols: map.cols };
    boards.set(map.id, bd);
    return bd;
  }
  const cellOf = (bd, id) => { const q = parseId(id); return q ? q[1] * bd.cols + q[0] : -1; };
  const idOf = (bd, i) => cid(i % bd.cols, Math.floor(i / bd.cols));

  /* ---------- the observation, as env.py decision() ---------- */
  /* ev: public events [{turn, seat, kind, cell|null, text}] (newest last); me: {seat, n, role, pos(cell), fed, reborn, ability, path[[turn, cell]]};
     openPods: array of pod numbers; moves: reachable cells for a move; turn */
  function observe(bd, ev, me, openPods, turn, phase, legal) {
    const N = bd.N, dyn = new Float32Array(D_DYN * N), glob = new Float32Array(G_DIM), mask = new Uint8Array(N);
    const at = (c, i) => c * N + i;
    dyn[at(0, me.pos)] = 1;
    if (phase === 'attack') { mask[0] = mask[1] = 1; } else for (const c of legal) { mask[c] = 1; dyn[at(1, c)] = 1; }
    for (const n of openPods) if (bd.pods[n] !== undefined) dyn[at(2, bd.pods[n])] = 1;
    const slotOf = j => ((j - me.seat - 1) % me.n + me.n) % me.n, last = {}, count = {}, attacked = {};
    for (const e of ev) {
      const age = turn - e.turn;
      if (e.cell !== null && (e.kind === 'noise' || e.kind === 'attack') && age < AGES && age >= 0) dyn[at((e.kind === 'noise' ? 3 : 11) + age, e.cell)] += 1;
      if (e.seat !== me.seat && e.cell !== null && (e.kind === 'noise' || e.kind === 'attack')) { const ch = 19 + slotOf(e.seat); dyn[at(ch, e.cell)] = Math.max(dyn[at(ch, e.cell)], Math.pow(0.75, age)); }
      if (e.seat !== me.seat && (e.kind === 'noise' || e.kind === 'attack' || e.kind === 'silence')) last[e.seat] = [age, e.kind === 'silence' && e.text === 'secure' ? 2 : e.kind === 'noise' ? 0 : e.kind === 'attack' ? 1 : 3];
      if (e.kind === 'attack') attacked[e.seat] = true;
      if (e.cell !== null) count[e.seat] = (count[e.seat] || 0) + 1;
    }
    for (let i = 3 * N; i < 19 * N; i++) if (dyn[i] > 1) dyn[i] = 1;
    me.path.slice(-6).reverse().forEach(([, pos], k) => { dyn[at(26, pos)] = Math.max(dyn[at(26, pos)], Math.pow(0.8, k)); });
    // distances: to the nearest open pod (a Human's walk), and from me (by my own rules)
    const pd = new Int32Array(N).fill(40), q = [];
    for (const n of openPods) if (bd.pods[n] !== undefined) { pd[bd.pods[n]] = 0; q.push(bd.pods[n]); }
    for (let h = 0; h < q.length; h++) for (const j of bd.nb[q[h]]) if (pd[j] === 40 && !'xHA1234'.includes(bd.kind[j])) { pd[j] = pd[q[h]] + 1; q.push(j); }
    for (let i = 0; i < N; i++) dyn[at(27, i)] = bd.kind[i] === 'x' ? 0 : Math.min(1, Math.max(0, 1 - pd[i] / 30));
    for (const [c, steps] of me.reach) dyn[at(28, c)] = Math.max(0, 1 - steps / 20);
    // global features
    glob[me.role === 'human' ? 0 : 1] = 1;
    glob[2] = me.fed ? 1 : 0; glob[3] = me.reborn ? 1 : 0; glob[4] = turn / 40; glob[5 + PHASE[phase]] = 1;
    const out = {}, escaped = {}, dead = {}, reborn = {};
    for (const e of ev) {
      if (e.kind === 'out') { const [why, role] = e.text.split('|'); if (why === 'killed' && role === 'human') reborn[e.seat] = true; else { out[e.seat] = true; if (why === 'escaped') escaped[e.seat] = true; if (why === 'killed') dead[e.seat] = true; } }
      if (e.kind === 'item' && /^mutation$/i.test(e.text)) reborn[e.seat] = true;
    }
    glob[8] = Object.keys(out).length / me.n; glob[9] = openPods.length / 4; glob[10] = Object.keys(reborn).length / me.n; glob[11] = Object.keys(escaped).length / me.n;
    ['Fast Alien', 'Psychic Alien', 'Captain', 'Engineer', 'Brute Alien'].forEach((a, k) => { glob[12 + k] = me.ability === a ? 1 : 0; });
    for (let j = 0; j < me.n; j++) {
      if (j === me.seat) continue;
      const base = 17 + slotOf(j) * 11;
      glob[base] = out[j] ? 0 : 1; glob[base + 1] = escaped[j] ? 1 : 0; glob[base + 2] = dead[j] ? 1 : 0; glob[base + 3] = reborn[j] ? 1 : 0;
      if (last[j]) { glob[base + 4 + last[j][1]] = 1; glob[base + 8] = Math.min(last[j][0], 8) / 8; } else glob[base + 8] = 1;
      glob[base + 9] = attacked[j] ? 1 : 0; glob[base + 10] = (count[j] || 0) / 10;
    }
    const u8 = new Uint8Array(D_DYN * N); for (let i = 0; i < u8.length; i++) u8[i] = Math.floor(dyn[i] * 255);
    return { dyn: u8, glob, phase: PHASE[phase], me: me.pos, mask };
  }

  /* ---------- from the app's state ---------- */
  function fromApp(H, idx, st, phase, role) {
    const map = T.map, bd = boardOf(map); if (!bd) return null;
    const seatIdx = {}; H.seats.forEach((s, i) => { seatIdx[s.id] = i; });
    const ev = H.log.slice().reverse().filter(e => e.by in seatIdx).map(e => ({ turn: e.turn, seat: seatIdx[e.by], kind: e.kind, cell: e.sector ? cellOf(bd, e.sector) : null, text: String(e.text || '') }));
    const open = [1, 2, 3, 4].filter(n => bd.pods[n] !== undefined && hatchOpen(n));
    const pos = cellOf(bd, st.pos), steps = role === 'alien' ? ((st.fed || (abilOf(st, H.mode) === 'Fast Alien' && st.path.length <= 1)) ? 3 : 2) : 1;
    const reach = new Map([...reachable(map, st.pos, 99, role)].map(([id, d]) => [cellOf(bd, id), d]));
    const legal = phase === 'move' ? [...reachable(map, st.pos, steps + (st.adr ? 1 : 0), role).keys()].map(id => cellOf(bd, id)) : phase === 'decoy' ? bd.walk.slice() : [];
    const me = { seat: idx, n: H.seats.length, role, pos, fed: !!st.fed, reborn: !!st.reborn, ability: abilOf(st, H.mode), path: st.path.map(p => [p.turn, cellOf(bd, p.pos)]), reach };
    return { bd, obs: observe(bd, ev, me, open, H.turn, phase, legal) };
  }
  function pick(logits, temp) {   // sample from softmax(logits / temp); temp 0 = the best
    let best = 0; for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i;
    if (!(temp > 0)) return best;
    let z = 0; const p = new Float64Array(logits.length);
    for (let i = 0; i < logits.length; i++) if (logits[i] > -Infinity) { p[i] = Math.exp((logits[i] - logits[best]) / temp); z += p[i]; }
    let r = (typeof deckRnd === 'function' ? deckRnd() : Math.random()) * z;
    for (let i = 0; i < p.length; i++) { r -= p[i]; if (r <= 0 && p[i] > 0) return i; }
    return best;
  }
  const decide = (H, idx, st, phase, role, temp = 1) => {
    if (!net) return null;
    const x = fromApp(H, idx, st, phase, role); if (!x) return null;
    return pick(forward(x.obs, x.bd), temp) | 0;
  };
  /* each returns null when the network cannot play this position (the caller then uses the rules) */
  const move = (H, idx, st, role, temp) => { const a = decide(H, idx, st, 'move', role, temp); return a === null ? null : idOf(boardOf(T.map), a); };
  const attack = (H, idx, st, role, temp) => { const a = decide(H, idx, st, 'attack', role, temp); return a === null ? null : a === 1; };
  const decoy = (H, idx, st, role, temp) => { const a = decide(H, idx, st, 'decoy', role, temp); return a === null ? null : idOf(boardOf(T.map), a); };
  return { load, use, ready, boardOf, cellOf: id => cellOf(boardOf(T.map), id), observe, forward, move, attack, decoy, fromApp };
})();
if (typeof window !== 'undefined') window.NN = NN;
if (typeof module !== 'undefined') module.exports = NN;
