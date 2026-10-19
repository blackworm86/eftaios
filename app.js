'use strict';
/* EFTAIOS Companion — tracks a player's secret route for the physical board game.
   No cards, no hidden-information resolution: the app only records what the player tells it. */

const MAX_TURN = 39;
const SVGNS = 'http://www.w3.org/2000/svg';
const HEX = 20; // hex radius in map units
const STORE = 'eftaios.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* one icon family: 24px grid, 2px round strokes */
const ICONS = { close: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7', up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6', next: 'M9 5l7 7-7 7', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', pencil: 'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4', turn: 'M8 5l10 7-10 7z', cross: 'M7 7l10 10M17 7L7 17' };
const ico = (n, s = 20) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="${n === 'turn' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
const colL = c => String.fromCharCode(65 + c);
const cid = (c, r) => colL(c) + String(r + 1).padStart(2, '0');
const parseId = s => { const m = /^([A-Za-z])\s*0?(\d{1,2})$/.exec(String(s).trim()); return m ? [m[1].toUpperCase().charCodeAt(0) - 65, +m[2] - 1] : null; };

/* ---------------- state ---------------- */
const fresh = () => ({
  stage: 'welcome', myRole: null, ready: false, items: [], undo: null, sus: {}, shapes: {}, mkAll: false, track: 'auto', marks: [], notes: [], char: '', online: false, outSent: false, revealed: false, routeSent: false, room: null, mapId: null, mode: 'advanced', role: null, name: '', turn: 1, pos: null, fed: false, adr: false,
  phase: 'move', res: null, over: null, path: [], log: [],
  hatches: { 1: 0, 2: 0, 3: 0, 4: 0 }, tab: 'play', customMaps: []
});
let S = fresh();
try { Object.assign(S, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* ignore */ }
S.tab = { play: 'play', table: 'table', notes: 'table', rules: 'more', menu: 'more', more: 'more' }[S.tab] || 'play';
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } };

/* transient (not persisted) */
const T = { maps: [], map: null, sel: null, pick: null, editor: null, inspect: null, noteType: 'noise', noteWho: '' };

/* ---------------- maps ---------------- */
function parseMap(m) {
  const rows = m.rows_data;
  if (!Array.isArray(rows) || !rows.length || rows.some(r => typeof r !== 'string' || r.length !== rows[0].length)) throw new Error('Invalid map rows');
  if (!rows.every(r => /^[.sxHA1-4]+$/.test(r))) throw new Error('Unknown symbol in map (allowed: . s x H A 1 2 3 4)');
  return { id: m.id || 'map-' + Date.now(), name: m.name || 'Custom map', description: m.description || '', pack: m.pack || '', author: m.author || '', official: !!m.official, cols: rows[0].length, rows: rows.length, odd: m.oddColumnsLower !== false, grid: rows.map(r => r.split('')) };
}
async function loadMaps() {
  let list = [];
  try { const r = await fetch('maps/maps.json'); list = (await r.json()).maps || []; } catch (e) { /* offline/file: fall through */ }
  list = list.concat(S.customMaps || []);
  T.maps = [];
  for (const m of list) { try { T.maps.push(parseMap(m)); } catch (e) { console.warn('Skipped map', m && m.id, e.message); } }
  if (!T.maps.length) T.maps.push(parseMap({ id: 'blank', name: 'Blank map (use the editor)', rows_data: Array.from({ length: 14 }, () => '.'.repeat(23)) }));
}
const lower = (map, c) => map.odd ? c % 2 === 1 : c % 2 === 0;
function neighbors(map, c, r) {
  const d = lower(map, c) ? [[0, -1], [0, 1], [-1, 0], [-1, 1], [1, 0], [1, 1]] : [[0, -1], [0, 1], [-1, -1], [-1, 0], [1, -1], [1, 0]];
  return d.map(([a, b]) => [c + a, r + b]).filter(([a, b]) => a >= 0 && b >= 0 && a < map.cols && b < map.rows);
}
const at = (map, id) => { const p = parseId(id); return p && p[0] < map.cols && p[1] < map.rows ? map.grid[p[1]][p[0]] : null; };
function find(map, ch) { for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) if (map.grid[r][c] === ch) return cid(c, r); return null; }
const hatchOpen = n => !S.hatches[n];
/* the escape hatches that exist on a map (some maps have fewer than four) */
const mapHatches = (map = T.map) => [1, 2, 3, 4].filter(n => map && map.grid.some(r => r.includes(String(n))));
/* small picture of a map for the selection screens */
function mapPreview(map) {
  if (!map) return '';
  const W = HEX * 2 + 1.5 * HEX * (map.cols - 1), H = Math.sqrt(3) * HEX * (map.rows + 0.5), col = { '.': '#59627a', s: '#ece6d3', H: '#1c5d93', A: '#a53312' };
  let g = '';
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const ty = map.grid[r][c]; if (ty === 'x') continue;
    const { x, y } = hexPos(map, c, r);
    g += `<polygon points="${hexPts(x, y, HEX - 1)}" fill="${col[ty] || '#1e8a4f'}"/>`;
    if ('1234'.includes(ty)) g += `<text x="${x}" y="${y}" class="pvn">${ty}</text>`;
  }
  return `<svg class="mapprev" viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" role="img" aria-label="${esc(map.name)}">${g}</svg>`;
}
const label = id => { const ty = at(T.map, id); return ty === 'H' ? t('Human start') : ty === 'A' ? t('Alien start') : '1234'.includes(ty) ? t('Escape Hatch {n}', { n: ty }) : id; };
const basic = () => S.mode === 'basic', infection = () => S.mode === 'infection';

/* movement: start sectors are never enterable; pods stop movement; aliens cannot enter pods; closed pods impassable */
function reachable(map, from, steps, role) {
  const dist = new Map([[from, 0]]), q = [from], out = new Map();
  while (q.length) {
    const id = q.shift(), d = dist.get(id);
    if (d === steps) continue;
    const [c, r] = parseId(id);
    for (const [a, b] of neighbors(map, c, r)) {
      const n = cid(a, b), t = map.grid[b][a];
      if (dist.has(n) || t === 'x' || t === 'H' || t === 'A') continue;
      if ('1234'.includes(t)) { if (role === 'human' && hatchOpen(+t)) { dist.set(n, d + 1); out.set(n, d + 1); } continue; }
      dist.set(n, d + 1); out.set(n, d + 1); q.push(n);
    }
  }
  return out;
}
const allowance = () => S.role === 'alien' ? (S.fed ? 3 : 2) : (S.adr ? 2 : 1);
const typeName = ty => ({ '.': t('Dangerous sector'), s: t('Secure sector'), x: t('Empty space'), H: t('Human start'), A: t('Alien start') }[ty] || t('Escape Hatch {n}', { n: ty }));

/* ---------------- map rendering ---------------- */
const view = { k: 1, x: 0, y: 0 }; let fitK = 1, mapW = 0, mapH = 0;
const svg = $('#map');
const hexPos = (map, c, r) => ({ x: HEX + 1.5 * HEX * c, y: Math.sqrt(3) / 2 * HEX + Math.sqrt(3) * HEX * r + (lower(map, c) ? Math.sqrt(3) / 2 * HEX : 0) });
function el(tag, attrs = {}, parent) { const e = document.createElementNS(SVGNS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
const hexPts = (x, y, s) => [0, 1, 2, 3, 4, 5].map(i => { const a = Math.PI / 3 * i; return (x + s * Math.cos(a)).toFixed(1) + ',' + (y + s * Math.sin(a)).toFixed(1); }).join(' ');

/* map style: 'dark' (app) or 'classic' (drawn like the printed sheets); per device */
let MAP_STYLE = (() => { try { return localStorage.getItem('eftaios.mapstyle') || 'dark'; } catch (e) { return 'dark'; } })();
function applyMapStyle() { svg.classList.toggle('classic', MAP_STYLE === 'classic'); const st = $('#stage'); if (st) st.classList.toggle('classic', MAP_STYLE === 'classic'); }
function setMapStyle(v) { MAP_STYLE = v === 'classic' ? 'classic' : 'dark'; try { localStorage.setItem('eftaios.mapstyle', MAP_STYLE); } catch (e) {} applyMapStyle(); }
function buildMap() {
  applyMapStyle();
  const map = T.map; svg.textContent = '';
  mapW = HEX * 2 + 1.5 * HEX * (map.cols - 1); mapH = Math.sqrt(3) * HEX * (map.rows + 0.5);
  // the svg is the size of the map and moves as one GPU layer (applyView); nothing inside it is re-laid out while panning
  svg.setAttribute('viewBox', `0 0 ${mapW.toFixed(0)} ${mapH.toFixed(0)}`); svg.setAttribute('width', mapW.toFixed(0)); svg.setAttribute('height', mapH.toFixed(0));
  // classic hatching: one pre-rotated tile, painted once on the background (empty sectors are left transparent)
  const defs = el('defs', {}, svg), pat = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse' }, defs);
  el('path', { d: 'M-1 1L1 -1M0 6L6 0M5 7L7 5', class: 'hatchln' }, pat);
  const vp = el('g', { id: 'vp' }, svg);
  el('rect', { x: -HEX, y: -HEX, width: mapW + 2 * HEX, height: mapH + 2 * HEX, class: 'paper' }, vp);
  const cells = el('g', { id: 'cells' }, vp);
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const { x, y } = hexPos(map, c, r), id = cid(c, r);
    const g = el('g', { 'data-id': id }, cells);
    el('polygon', { points: hexPts(x, y, HEX - 0.6), class: 'hex' }, g);
    const t = el('text', { x, y: y + 12, class: 'lbl' }, g); t.textContent = id;
    el('g', { class: 'sicon', transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})` }, g);
    el('text', { x, y, class: 'sym' }, g);
  }
  el('g', { id: 'zone' }, vp); el('g', { id: 'trail', class: 'trail' }, vp);
  el('g', { id: 'marks' }, vp); el('g', { id: 'me' }, vp); el('g', { id: 'notes' }, vp);
  paintCells(); fit();
}
/* start sectors and escape hatches: the white line art of the printed maps, traced from the original sectors */
const SECTOR_ART = {
  H: 'M-5.9 -13.6L-11.0 -10.7L-11.0 8.0L-0.9 13.9L0.6 14.2L11.3 8.0L11.3 -10.7L5.9 -13.6L4.7 -11.9L8.9 -9.2L8.9 -5.0L1.2 -0.3L-0.3 0.0L-8.6 -5.0L-8.6 -9.2L-4.4 -11.6L-5.3 -13.6zM-8.6 -1.8L-7.7 -1.8L0.3 3.0L8.6 -1.8L8.9 6.5L0.0 11.6L-8.6 6.5z',
  A: 'M-8.7 -13.1L-9.9 -11.0L-3.1 -7.2L-2.5 -6.3L-10.7 -1.6L-10.7 12.5L0.4 6.0L11.3 12.2L11.3 -2.2L3.1 -6.6L10.7 -11.0L9.6 -13.1L0.4 -7.8zM-8.4 -0.1L0.4 -5.1L9.0 -0.4L9.0 7.8L8.7 8.1L0.1 3.4L-8.1 8.1z',
  P: 'M14.3 2.5L12.8 1.6L11.9 1.9L6.3 11.6L-5.1 11.6L-5.1 14.0L7.8 14.0zM5.1 -14.0L-7.8 -14.0L-14.3 -2.5L-12.8 -1.6L-11.9 -1.9L-6.3 -11.6L5.1 -11.6z'
};
function sectorIcon(k) {
  const pod = '1234'.includes(k);
  return `<path class="sig" fill-rule="evenodd" d="${SECTOR_ART[pod ? 'P' : k]}"/>` + (pod ? `<text class="podn">${k}</text>` : '');
}
const tr = s => window.t ? window.t(s) : s; // map symbols are painted before/after language changes
function paintCells() {
  svg.classList.toggle('editing', !!T.editor);
  const map = T.map, reach = T.reach || new Map();
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const id = cid(c, r), g = svg.querySelector(`[data-id="${id}"]`), poly = g.firstChild, sym = g.lastChild, t = map.grid[r][c];
    let cls = 'hex ' + ('1234'.includes(t) ? 'P' : t === '.' ? 'd' : t);
    if ('1234'.includes(t) && !hatchOpen(+t)) cls += ' closed';
    if (reach.has(id)) cls += ' reach';
    if (T.sel === id) cls += ' sel';
    if (T.pick) cls += ' pick';
    if (T.inspect === id) cls += ' inspected';
    poly.setAttribute('class', cls);
    const kind = t === 'H' || t === 'A' || '1234'.includes(t) ? t : '';
    g.children[1].textContent = kind ? '' : id; sym.textContent = '';
    const ic = g.children[2]; if (ic.dataset.k !== kind) { ic.dataset.k = kind; ic.innerHTML = kind ? sectorIcon(kind) : ''; }
  }
  paintOverlay();
}
/* ---- player markers ----
   fill = the player (you are always white), border = your guess about them:
   black = me, yellow = not decided, blue = suspected Human, red = suspected Alien.
   My own steps: full = heard (noise in the sector I reached), faded = silent or noise elsewhere,
   dashed border = a bluff, joined to where I really was by a dashed line. */
const MK_RECENT = 5; // turns of other players' markers shown unless "All turns"
const ME_COLOR = ['#f5f5f5', '#101010'];
const PALETTE = [['#E69F00', '#1a1200'], ['#56B4E9', '#06202e'], ['#009E73', '#ffffff'], ['#F0E442', '#2a2600'],
  ['#CC79A7', '#2b0619'], ['#A6763C', '#ffffff'], ['#A99BF0', '#14102e'], ['#2EC4B6', '#06201d']];
const BORDER = { me: '#000000', '': '#ffd23f', human: '#2f7dff', alien: '#ff3b30' };
/* every player is a hexagon with slightly rounded corners, drawn at unit radius */
const roundedHex = (r, k) => {
  const v = [0, 1, 2, 3, 4, 5].map(i => [r * Math.cos(Math.PI / 3 * i), r * Math.sin(Math.PI / 3 * i)]);
  let d = '';
  v.forEach((p, i) => {
    const a = v[(i + 5) % 6], c = v[(i + 1) % 6], m = (q) => { const dx = q[0] - p[0], dy = q[1] - p[1], l = Math.hypot(dx, dy); return [p[0] + dx / l * k, p[1] + dy / l * k]; }, s0 = m(a), e0 = m(c);
    d += (i ? 'L' : 'M') + s0[0].toFixed(3) + ' ' + s0[1].toFixed(3) + 'Q' + p[0].toFixed(3) + ' ' + p[1].toFixed(3) + ' ' + e0[0].toFixed(3) + ' ' + e0[1].toFixed(3);
  });
  return d + 'z';
};
const HEX_MARK = { d: roundedHex(1.12, 0.3), ty: 0 };
/* who is at the table: Firebase players (table), local seats (pass and play) */
const myId = () => (S.hot && window.Hot ? Hot.curId() : (window.Sync && Sync.code ? Sync.uid : null));
const tableOrder = () => (S.hot && window.Hot ? Hot.order() : ((window.Sync && Sync.settings && Sync.settings.order) || []));
const tablePlayers = () => (S.hot && window.Hot ? Hot.publicPlayers() : ((window.Sync && Sync.players) || {}));
/* a stable key per player: table players by id, hand-written notes by name */
function playerKey(e) {
  if (e.by && e.by === myId()) return 'me';
  if (e.mine && !S.hot) return 'me';
  if (e.by) return 'u:' + e.by;
  const name = String(e.who || '?').trim().toLowerCase(), ps = tablePlayers();
  for (const u in ps) if ((ps[u].name || '').toLowerCase() === name) return 'u:' + u;
  return 'n:' + name;
}
/* colour index of a player: their seat in the turn order, so every device agrees (-1 = me, always white) */
function colorOf(key) {
  if (key === 'me') return -1;
  const ord = tableOrder();
  if (key.startsWith('u:')) { const i = ord.indexOf(key.slice(2)); if (i >= 0) return i % PALETTE.length; }
  S.shapes = S.shapes || {};
  if (!(key in S.shapes)) S.shapes[key] = (ord.length + Object.keys(S.shapes).length) % PALETTE.length;
  return S.shapes[key];
}
const pal = key => key === 'me' ? ME_COLOR : PALETTE[colorOf(key)];
const shapeOf = () => HEX_MARK;
const suspicion = key => (key !== 'me' && S.sus && S.sus[key]) || '';
const borderOf = key => key === 'me' ? BORDER.me : BORDER[suspicion(key)] || BORDER[''];
/* one marker body (outline + fill + border) at the origin of `g`: a rounded hexagon */
function markBody(g, key, r, o = {}) {
  const sh = shapeOf(key), sw = r * 0.32, [fill] = pal(key), common = { 'vector-effect': 'non-scaling-stroke' };
  const draw = (rr, attrs) => sh ? el('path', Object.assign({ d: sh.d, transform: `scale(${rr.toFixed(2)})` }, common, attrs), g) : el('circle', Object.assign({ r: rr.toFixed(2) }, attrs), g);
  draw(r + sw / 2 + 0.6, { class: key === 'me' ? 'mko me' : 'mko' });   // outline ring: white around my black border, dark around the others
  if (o.faded) draw(r, { class: 'mkshade' });   // dark tint under a faded marker so it reads as faded on light sectors too
  const body = draw(r, { fill, 'fill-opacity': o.faded ? 0.35 : 1, stroke: o.border || borderOf(key), 'stroke-width': sw.toFixed(2), 'stroke-linejoin': 'round' });
  if (o.dashed) body.setAttribute('stroke-dasharray', `${(r * 0.55).toFixed(1)} ${(r * 0.38).toFixed(1)}`);
  return sh ? sh.ty * r : 0;
}
const dotIcon = (key, asMe) => {
  const k = asMe ? 'me' : key, sh = shapeOf(k), [f] = pal(k), b = borderOf(k), me = k === 'me';
  const shape = (rr, attrs) => sh ? `<path d="${sh.d}" transform="scale(${rr})" vector-effect="non-scaling-stroke" ${attrs}/>` : `<circle r="${rr}" ${attrs}/>`;
  return `<svg class="dot" viewBox="-10 -10 20 20" aria-hidden="true">${shape(9.2, `fill="${me ? '#fff' : '#0b1222'}"`)}${shape(7, `fill="${f}" stroke="${b}" stroke-width="3" stroke-linejoin="round"`)}</svg>`;
};
/* layout of the markers inside one hex: a ring of evenly spaced slots, never overlapping */
function slots(n) {
  if (n === 1) return { size: 8, pts: [[0, 0]] };
  const R = n <= 4 ? 10.5 : n <= 6 ? 12.5 : 13.5, size = Math.min(n <= 3 ? 7 : 5.8, (R * Math.sin(Math.PI / n) - 0.8) / 1.25);  // room for the border, outline and shape corners
  return { size, pts: Array.from({ length: n }, (_, i) => { const a = -Math.PI / 2 + i * 2 * Math.PI / n; return [R * Math.cos(a), R * Math.sin(a)]; }) };
}
/* my own route, turn by turn: where I really was, which steps the others heard, and my bluffs */
function ownSteps() {
  const realAt = {}; S.path.forEach(p => { realAt[p.turn] = p.pos; });
  const whereAt = n => { for (let k = n; k >= 0; k--) if (realAt[k]) return realAt[k]; return null; };
  const heard = new Set([0]), bluffs = [];
  for (const e of S.log) {
    if (!e.sector || playerKey(e) !== 'me' || !['noise', 'attack', 'reveal', 'hatch'].includes(e.kind)) continue;
    const real = whereAt(e.turn);
    if (e.sector === real) heard.add(e.turn); else if (e.kind === 'noise') bluffs.push({ turn: e.turn, sector: e.sector, from: real });
  }
  return { whereAt, heard, bluffs };
}
/* what I know about another player: their announced positions in turn order */
function trackOf(key) {
  const out = [];
  if (S.track === 'manual') (S.marks || []).forEach(m => { if (m.key === key) out.push({ turn: m.turn, sector: m.sector, kind: 'noise' }); });
  else S.log.forEach(e => { if (e.sector && ['noise', 'attack', 'reveal', 'hatch'].includes(e.kind) && playerKey(e) === key) out.push({ turn: e.turn, sector: e.sector, kind: e.kind }); });
  return out.sort((a, b) => a.turn - b.turn);
}
/* follow mode: where a player could be now, from their last known sector and the moves since then */
function followZone(key) {
  const tr = trackOf(key); if (!tr.length) return null;
  const last = tr[tr.length - 1], guess = suspicion(key), human = guess === 'human';
  const elapsed = Math.max(0, S.turn - last.turn), steps = Math.min(elapsed * (human ? 1 : 2), 40);
  const zone = steps ? reachable(T.map, last.sector, steps, human ? 'human' : 'alien') : new Map();
  zone.set(last.sector, 0);
  return { last, zone, human, guess };
}
/* a route as arrows: one segment per move, an arrowhead on its middle pointing the way I went */
function arrowRoute(parent, pts, color, cls) {
  const g = el('g', { class: cls }, parent);
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i - 1], [x2, y2] = pts[i], dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy); if (!len) continue;
    const ux = dx / len, uy = dy / len, mx = (x1 + x2) / 2, my = (y1 + y2) / 2, L = 6.5, W = 4.6;
    const ln = el('line', { x1: x1.toFixed(1), y1: y1.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1) }, g);
    const hd = el('path', { class: 'ah', d: `M${(mx + ux * L * 0.6).toFixed(1)} ${(my + uy * L * 0.6).toFixed(1)}L${(mx - ux * L * 0.4 - uy * W).toFixed(1)} ${(my - uy * L * 0.4 + ux * W).toFixed(1)}L${(mx - ux * L * 0.4 + uy * W).toFixed(1)} ${(my - uy * L * 0.4 - ux * W).toFixed(1)}z` }, g);
    if (color) { ln.setAttribute('stroke', color); hd.setAttribute('fill', color); hd.setAttribute('stroke', color); }
  }
  return g;
}
function paintOverlay() {
  const map = T.map, inPlay = S.role && !T.editor;
  const trail = $('#trail'), marks = $('#marks'), me = $('#me'), zoneG = $('#zone');
  marks.textContent = ''; me.textContent = ''; if (zoneG) zoneG.textContent = ''; paintNotes();
  const focus = T.focus || null;
  const hp = sec => { const q = parseId(sec); return q ? hexPos(map, q[0], q[1]) : null; };
  const routes = inPlay ? finalRoutes() : null;
  trail.textContent = '';
  const pts = inPlay && !routes ? S.path.map(p => { const h = hp(p.pos); return [h.x, h.y]; }) : [];
  if (pts.length > 1) arrowRoute(trail, pts, null, 'trailg');
  trail.setAttribute('class', 'trail' + (focus && focus !== 'me' ? ' dim' : ''));
  renderMkBar(); followBar();
  if (!inPlay) return;
  if (routes) { paintRoutes(routes, focus, hp, marks); return; }
  const own = ownSteps();
  // follow mode: shade the sectors the followed player could have reached since they were last heard
  if (focus && focus !== 'me' && zoneG) {
    const fz = followZone(focus), [col] = pal(focus);
    if (fz) fz.zone.forEach((_, id) => { const q = parseId(id), h = hexPos(map, q[0], q[1]); el('polygon', { points: hexPts(h.x, h.y, HEX - 2.2), class: 'fzone', fill: col, stroke: col }, zoneG); });
  }
  // bluffs: a dashed line from where I really was to the sector I announced
  own.bluffs.forEach(b => { const p = hp(b.from), q = hp(b.sector); if (p && q) el('line', { x1: p.x, y1: p.y, x2: q.x, y2: q.y, class: 'bluffline' + (focus && focus !== 'me' ? ' dim' : '') }, marks); });
  // collect every visit: my own route + my bluffs + other players' public positions
  const visits = [];
  S.path.forEach(p => visits.push({ key: 'me', sector: p.pos, turn: p.turn, kind: 'route' }));
  S.log.forEach(e => { if (e.kind === 'attack' && e.sector && playerKey(e) === 'me') visits.push({ key: 'me', sector: e.sector, turn: e.turn, kind: 'attack', armed: S.role === 'human' }); });
  own.bluffs.forEach(b => visits.push({ key: 'bluff', sector: b.sector, turn: b.turn, kind: 'noise' }));
  for (const e of S.log) {
    if (!e.sector || !['noise', 'attack', 'reveal', 'spot'].includes(e.kind)) continue;
    const key = e.kind === 'spot' ? 'spot' : playerKey(e);
    if (key === 'me') continue;                                   // my own steps come from my route
    if (S.track === 'manual' && key !== 'spot') continue;         // by hand: other players are only what I marked
    const armed = e.kind === 'attack' && S.log.some(x => x.kind === 'item' && x.text === 'attack' && x.turn === e.turn && playerKey(x) === key);
    visits.push({ key, sector: e.sector, turn: e.turn, kind: e.kind, armed });
  }
  if (S.track === 'manual') (S.marks || []).forEach(m => visits.push({ key: m.key, sector: m.sector, turn: m.turn, kind: 'noise' }));
  const mine = k => k === 'me' || k === 'bluff';
  const recent = v => S.mkAll || v.key === focus || mine(v.key) || S.turn - v.turn < MK_RECENT;
  // group: sector -> player -> turns
  const bySector = new Map();
  for (const v of visits) {
    if (!recent(v)) continue;
    if (!bySector.has(v.sector)) bySector.set(v.sector, new Map());
    const m = bySector.get(v.sector);
    if (!m.has(v.key)) m.set(v.key, { key: v.key, turns: [], kind: v.kind, armed: false });
    const it = m.get(v.key); if (!it.turns.includes(v.turn)) it.turns.push(v.turn);
    if (v.kind === 'attack') it.armed = !!v.armed;
    const rank = { route: 0, noise: 1, attack: 2, reveal: 3, spot: 0 };
    if (rank[v.kind] > rank[it.kind]) it.kind = v.kind;
  }
  const order = k => k === 'me' ? -2 : k === 'bluff' ? -1 : k === 'spot' ? 99 : colorOf(k);
  bySector.forEach((m, sec) => {
    const h = hp(sec); if (!h) return;
    const items = [...m.values()].sort((x, y) => order(x.key) - order(y.key));
    const spot = items.find(x => x.key === 'spot'), list = items.filter(x => x.key !== 'spot');
    if (spot) { el('circle', { cx: h.x, cy: h.y, r: 17, class: 'mk spot' + (focus ? ' dim' : '') }, marks); el('use', { href: '#gi-spotlight', x: (h.x - 7.5).toFixed(1), y: (h.y - 21).toFixed(1), width: 15, height: 13.8, class: 'mk' + (focus ? ' dim' : '') }, marks); }
    if (!list.length) return;
    const hit = list.filter(x => x.kind === 'attack');
    if (hit.length) {   // starburst behind the markers: somebody attacked in this sector
      const pts_ = []; for (let i = 0; i < 24; i++) { const a = Math.PI * i / 12, q = i % 2 ? 15.5 : 20; pts_.push((h.x + q * Math.cos(a)).toFixed(1) + ',' + (h.y + q * Math.sin(a)).toFixed(1)); }
      el('polygon', { points: pts_.join(' '), class: 'burst' + (focus && !hit.some(x => x.key === focus || (focus === 'me' && mine(x.key))) ? ' dim' : '') }, marks);
    }
    const { size, pts: sp } = slots(list.length);
    list.forEach((it, i) => {
      const [dx, dy] = sp[i], turns = it.turns.sort((x, y) => y - x), last = turns[0];
      const label = turns.slice(0, 2).map(n => n || 'S').join(',') + (turns.length > 2 ? '…' : '');
      const ownM = mine(it.key), ck = ownM ? 'me' : it.key, ink = pal(ck)[1], bluff = it.key === 'bluff';
      const faded = it.key === 'me' && !own.heard.has(last);
      const dim = focus && !(it.key === focus || (focus === 'me' && ownM)), old = !focus && !ownM && S.turn - last >= 2;
      const g = el('g', { class: `mk pm ${it.kind}${ownM ? ' mine' : ''}${bluff ? ' bluff' : ''}${faded ? ' faded' : ''}${old ? ' old' : ''}${dim ? ' dim' : ''}`, transform: `translate(${(h.x + dx).toFixed(1)} ${(h.y + dy).toFixed(1)})` }, marks);
      const ty = markBody(g, ck, size, { faded, dashed: bluff });
      if (it.key === 'me' && sec === S.pos) { const cls = focus && focus !== 'me' ? ' dim' : '', at_ = { cx: (h.x + dx).toFixed(1), cy: (h.y + dy).toFixed(1) }; const ringAt = (rr, c) => el('path', { d: roundedHex(rr, rr * 0.27), class: c, transform: `translate(${at_.cx} ${at_.cy})` }, me); ringAt((size + 3) * 1.12, 'me-ring pulse' + cls); ringAt((size + 1.8) * 1.12, 'me-ring' + cls); }
      const tx = el('text', { fill: ink, y: ty.toFixed(1), 'font-size': (label.length > 2 ? size * 0.72 : size * 0.98).toFixed(1) }, g); tx.textContent = label;
      if (it.kind === 'attack' && it.armed) {   // a Human played an Attack card: its printed icon
        const w = size * 1.75; el('use', { href: '#gi-attack', x: (size * 0.85 - w / 2).toFixed(1), y: (-size * 0.85 - w * 0.46).toFixed(1), width: w.toFixed(1), height: (w * 0.92).toFixed(1) }, g);
      } else if (it.kind === 'attack') {   // an Alien attack: red claw marks
        const R = size * 0.74, bg = el('g', { class: 'abadge alien', transform: `translate(${(size * 0.85).toFixed(1)} ${(-size * 0.85).toFixed(1)})` }, g), c = R * 0.5;
        el('circle', { r: R.toFixed(2) }, bg);
        el('path', { d: [-0.62, 0, 0.62].map(o => `M${(-c * 0.6 + o * c).toFixed(2)} ${-c}L${(c * 0.6 + o * c).toFixed(2)} ${c}`).join(''), 'stroke-width': (size * 0.1).toFixed(2) }, bg);
      }
    });
  });
  // route of the followed player: a solid line in their colour between their known steps
  if (focus && focus !== 'me') {
    const tl = trackOf(focus).map(v => { const hh = hp(v.sector); return [hh.x, hh.y]; });
    if (tl.length > 1) { const tlEl = arrowRoute(marks, tl, pal(focus)[0], 'tl'); const first = marks.querySelector('.pm'); if (first) marks.insertBefore(tlEl, first); }
  }
}
/* game over: every player's real route, from the devices that played them (announcements and bluffs are left out) */
function finalRoutes() {
  if (T.showAnn) return null;
  if (S.hot) { if (!(window.Hot && Hot.isOver())) return null; const me = myId(); return Object.entries(Hot.routes()).map(([id, v]) => ({ key: id === me ? 'me' : 'u:' + id, path: v.path, role: v.role })); }
  if (!(window.Sync && Sync.code && Sync.settings && Sync.settings.status === 'over')) return null;
  const out = [{ key: 'me', path: S.path, role: S.role }];
  Object.entries(Sync.players || {}).forEach(([u, p]) => { if (u !== Sync.uid && p.route) out.push({ key: 'u:' + u, path: decodeRoute(p.route), role: p.role }); });
  return out;
}
const ROLE_BORDER = { human: '#2f7dff', alien: '#ff3b30' };
function paintRoutes(routes, focus, hp, marks) {
  const bySector = new Map();
  routes.forEach(r => {   // lines first, so the markers sit on top
    const dim = focus && focus !== r.key, pts = r.path.map(p => hp(p.pos)).filter(Boolean).map(h => [h.x, h.y]);
    if (pts.length > 1) arrowRoute(marks, pts, pal(r.key)[0], 'rline' + (r.key === 'me' ? ' me' : '') + (dim ? ' dim' : ''));
    r.path.forEach(p => { if (!bySector.has(p.pos)) bySector.set(p.pos, new Map()); const m = bySector.get(p.pos); if (!m.has(r.key)) m.set(r.key, { r, turns: [] }); m.get(r.key).turns.push(p.turn); });
  });
  bySector.forEach((m, sec) => {
    const h = hp(sec); if (!h) return;
    const list = [...m.values()].sort((a, b) => colorOf(a.r.key) - colorOf(b.r.key)), { size, pts: sp } = slots(list.length);
    list.forEach((it, i) => {
      const [dx, dy] = sp[i], k = it.r.key, turns = [...new Set(it.turns)].sort((a, b) => b - a), dim = focus && focus !== k;
      const label = turns.slice(0, 2).map(n => n || 'S').join(',') + (turns.length > 2 ? '…' : '');
      const g = el('g', { class: 'mk pm route' + (k === 'me' ? ' mine' : '') + (dim ? ' dim' : ''), transform: `translate(${(h.x + dx).toFixed(1)} ${(h.y + dy).toFixed(1)})` }, marks);
      const ty = markBody(g, k, size, { border: k === 'me' ? null : ROLE_BORDER[it.r.role] });
      const tx = el('text', { fill: pal(k)[1], y: ty.toFixed(1), 'font-size': (label.length > 2 ? size * 0.72 : size * 0.98).toFixed(1) }, g); tx.textContent = label;
    });
  });
}
/* eliminated / escaped badge on a player's icon in the strip and the sheet */
function outMark(k) {
  const o = k === 'me' ? ({ dead: 'killed', escaped: 'escaped', trapped: 'trapped' })[S.over] : k.startsWith('u:') ? (tablePlayers()[k.slice(2)] || {}).out : null;
  if (!o) return '';
  return o === 'escaped' ? `<i class="omark esc" title="${t('escaped')}">${ico('check', 12)}</i>` : `<i class="omark dead" title="${t('eliminated')}">${ico('cross', 12)}</i>`;
}
/* banner under the top bar while following a player */
function followBar() {
  const bar = $('#followbar'); if (!bar) return;
  const k = T.focus;
  if (!k || !S.role || T.editor) { bar.hidden = true; return; }
  const name = k === 'me' ? t('Me') : ((knownPlayers().find(([x]) => x === k) || [0, '?'])[1]);
  let txt;
  if (k === 'me') txt = t('Showing only your route');
  else {
    const fz = followZone(k);
    txt = fz ? t('Following {p} · heard in {s} on turn {n} · could now be in {c} sectors', { p: name, s: fz.last.sector, n: fz.last.turn, c: fz.zone.size }) : t('Following {p} · not heard yet', { p: name });
  }
  bar.hidden = false; bar.style.setProperty('--fc', pal(k)[0]);
  bar.innerHTML = `${dotIcon(k)}<span>${esc(txt)}</span><button class="btn" data-act="unfollow">${t('Stop')}</button>`;
}
/* floating strip on the map: tap a player to see only their timeline */
function knownPlayers() {
  const out = [], seen = new Set(['me']);
  const ord = tableOrder(), ps = tablePlayers();
  ord.forEach(u => { if (ps[u] && u !== myId()) { seen.add('u:' + u); out.push(['u:' + u, ps[u].name]); } });
  (S.extraPlayers || []).forEach(n => { const k = 'n:' + n.toLowerCase(); if (!seen.has(k)) { seen.add(k); out.push([k, n]); } });
  S.log.forEach(e => { if (!e.sector || e.kind === 'spot') return; const k = playerKey(e); if (!seen.has(k)) { seen.add(k); out.push([k, e.who]); } });
  return out;
}
/* short label for the narrow strip: 'Player 3' -> 'P3', long names cut */
const shortName = n => { n = String(n).trim(); const d = n.match(/\d+$/); return n.length <= 6 ? n : d ? n[0] + d[0] : n.slice(0, 5) + '…'; };
/* ---- manual tracking & map notes ---- */
function toggleMark(sec) {
  S.marks = S.marks || []; const turn = T.markTurn || S.turn;
  const i = S.marks.findIndex(m => m.key === T.markKey && m.sector === sec && m.turn === turn);
  if (i >= 0) S.marks.splice(i, 1); else S.marks.push({ key: T.markKey, sector: sec, turn });
  buzz(); save(); paintOverlay();
}
function markBanner() {
  const who = T.markKey ? (knownPlayers().find(([k]) => k === T.markKey) || [0, '?'])[1] : null;
  return `<div class="banner mark"><div>${who ? t('Marking {p}: tap the sectors on the map. Tap again to remove.', { p: esc(who) }) : t('Pick the player to mark in the strip on the left.')}</div>
    <div class="row tight"><span class="mturn">${t('Turn')} <button class="btn" data-act="mturn" data-d="-1" aria-label="−">−</button><b>${T.markTurn || S.turn}</b><button class="btn" data-act="mturn" data-d="1" aria-label="+">+</button></span><button class="btn primary" data-act="markmode">${t('Done')}</button></div></div>`;
}
const STICKER_PATH = { alert: 'M12 4v10M12 19v.01', ask: 'M9 9a3 3 0 116 0c0 2-3 2.2-3 5M12 19v.01', alien: 'M12 4c4 0 7 3 7 7 0 4-3 8-7 9-4-1-7-5-7-9 0-4 3-7 7-7zM8.5 11l2.5 1M15.5 11L13 12', crew: 'M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20c0-4 3-6 7-6s7 2 7 6', skull: 'M12 4c4 0 7 3 7 7 0 2-1 3-2 4v3H7v-3c-1-1-2-2-2-4 0-4 3-7 7-7zM9.5 11.5v.01M14.5 11.5v.01M10 20v-2M14 20v-2', star: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 19.2 8 13.7 4 9.8 9.5 9z' };
const STICKERS = Object.keys(STICKER_PATH), LEGACY_STICKER = { '❗': 'alert', '❓': 'ask', '👽': 'alien', '🧑': 'crew', '☠️': 'skull', '⭐': 'star' };
const stickerKey = k => STICKER_PATH[k] ? k : LEGACY_STICKER[k] || 'alert';
const stickerIco = (k, s = 24) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${STICKER_PATH[stickerKey(k)]}"/></svg>`;
function paintNotes() {
  const g = $('#notes'); if (!g) return; g.textContent = '';
  if (!S.role || T.editor) return;
  (S.notes || []).forEach(n => {
    const p = parseId(n.sector); if (!p) return; const h = hexPos(T.map, p[0], p[1]);
    const s = el('g', { class: 'sticker', transform: `translate(${(h.x - 11).toFixed(1)} ${(h.y - 11).toFixed(1)})` }, g);
    el('rect', { x: -6.5, y: -6.5, width: 13, height: 13, rx: 3 }, s);
    el('path', { d: STICKER_PATH[stickerKey(n.icon)], class: 'sglyph', transform: 'translate(-5 -5) scale(.42)' }, s);
    if (n.text) el('circle', { cx: 6, cy: -6, r: 2.2, class: 'sdot' }, s);
  });
}
function noteDlg(sec) {
  const n = (S.notes || []).find(x => x.sector === sec) || { sector: sec, icon: STICKERS[0], text: '' };
  n.icon = stickerKey(n.icon); T.noteIcon = n.icon;
  dlg.innerHTML = `<h2>${t('Note on {s}', { s: esc(label(sec)) })}</h2>
    <div class="chips stick" role="group" aria-label="${t('Sticker')}">${STICKERS.map(s => `<button data-st="${s}" aria-pressed="${s === n.icon}" aria-label="${s}">${stickerIco(s, 26)}</button>`).join('')}</div>
    <textarea id="note-txt" maxlength="120" placeholder="${t('Write a note (optional)')}" style="min-height:80px;margin-top:10px">${esc(n.text || '')}</textarea>
    <div class="row">${(S.notes || []).some(x => x.sector === sec) ? `<button class="btn danger" id="d-del">${t('Delete')}</button>` : ''}<button class="btn" id="d-no">${t('Cancel')}</button><button class="btn primary" id="d-yes">${t('Save')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  dlg.querySelectorAll('.stick button').forEach(b => b.onclick = () => { T.noteIcon = b.dataset.st; dlg.querySelectorAll('.stick button').forEach(x => x.setAttribute('aria-pressed', x === b)); });
  const del = $('#d-del'); if (del) del.onclick = () => { S.notes = S.notes.filter(x => x.sector !== sec); save(); paintNotes(); closeDlg(); };
  $('#d-yes').onclick = () => { S.notes = (S.notes || []).filter(x => x.sector !== sec); S.notes.push({ sector: sec, icon: T.noteIcon, text: $('#note-txt').value.trim().slice(0, 120) }); save(); paintNotes(); closeDlg(); };
}
function renderMkBar() {
  const bar = $('#mkbar'); if (!bar) return;
  const ps = S.role && !T.editor ? knownPlayers() : [];
  const manual = S.track === 'manual';
  if (!ps.length && !manual) { bar.hidden = true; return; }
  bar.hidden = false;
  const sus = k => `<div class="msus" role="group" aria-label="${t('Your suspicion')}">${[['', '?'], ['human', t('H')], ['alien', t('A')]].map(([v, l]) => `<button data-act="sus" data-k="${esc(k)}" data-v="${v}" class="${v || 'none'}" aria-pressed="${suspicion(k) === v}">${l}</button>`).join('')}</div>`;
  bar.innerHTML = `<button class="mkt" data-act="mkall" data-v="${S.mkAll ? 0 : 1}" aria-pressed="${!!S.mkAll}" aria-label="${S.mkAll ? t('All turns') : t('Last {n} turns', { n: MK_RECENT })}"><b>${S.mkAll ? t('All') : MK_RECENT}</b><span>${t('turns')}</span></button>` +
    (manual ? `<button class="mkt" data-act="markmode" aria-pressed="${!!T.markMode}" aria-label="${t('Mark players by hand')}"><b>${ico('pencil', 18)}</b><span>${t('mark')}</span></button>` : '') +
    (T.markMode ? ps : [['me', t('Me')]].concat(ps)).map(([k, n]) => T.markMode
      ? `<button data-act="markwho" data-k="${esc(k)}" aria-pressed="${T.markKey === k}" aria-label="${esc(n)}" title="${esc(n)}">${dotIcon(k)}<span>${esc(shortName(n))}</span></button>`
      : `<button data-act="pfocus" data-k="${esc(k)}" aria-pressed="${T.focus === k}" aria-label="${esc(n)}${outMark(k) ? ' · ' + t(/esc/.test(outMark(k)) ? 'escaped' : 'eliminated') : ''}" title="${esc(n)}" class="${outMark(k) ? 'isout' : ''}"><span class="dotw">${dotIcon(k)}${outMark(k)}</span><span>${esc(shortName(n))}</span></button>${T.focus === k && k !== 'me' ? sus(k) : ''}`).join('') +
    (T.markMode && !Sync.code && !S.hot && ps.length < 7 ? `<button class="mkt" data-act="addplayer" aria-label="${t('Add player')}"><b>+</b></button>` : '');
}
/* follow one player (or only my route): grey out the rest and frame what matters */
function follow(k) {
  T.focus = k || null; paintOverlay();
  if (!T.focus) return;
  if (T.focus === 'me') return frameSectors(S.path.map(p => p.pos).concat(ownSteps().bluffs.map(b => b.sector)));
  const fz = followZone(T.focus);
  frameSectors(trackOf(T.focus).map(v => v.sector).concat(fz ? [...fz.zone.keys()] : []));
}
/* zoom so that all the given sectors are visible */
function frameSectors(ids) {
  const pts = ids.map(parseId).filter(Boolean).map(([c, r]) => hexPos(T.map, c, r)); if (!pts.length) return;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y), r = stageRect(), pad = 60;
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2, h = Math.max(...ys) - Math.min(...ys) + pad * 2;
  view.k = Math.max(fitK, Math.min(fitK * 4, Math.min(r.width / w, r.height / h)));
  view.x = r.width / 2 - (Math.min(...xs) + Math.max(...xs)) / 2 * view.k; view.y = r.height / 2 - (Math.min(...ys) + Math.max(...ys)) / 2 * view.k; applyView();
}
/* pan and zoom move the whole svg with a CSS transform: the browser slides the painted map instead of repainting it.
   While moving it is promoted to its own layer; when it settles the layer is dropped so it re-rasterises sharp at the new zoom. */
const stage = $('#stage'), mapwrap = $('#mapwrap'), stageRect = () => stage.getBoundingClientRect();
function applyView() {
  mapwrap.style.transform = `translate(${view.x.toFixed(1)}px, ${view.y.toFixed(1)}px) scale(${view.k.toFixed(4)})`;
  svg.classList.toggle('zl', view.k > fitK * 1.7);
  mapwrap.style.willChange = 'transform'; clearTimeout(applyView.t); applyView.t = setTimeout(() => { mapwrap.style.willChange = 'auto'; }, 220);
}
function fit() {
  const r = stageRect(); if (!r.width) return;
  fitK = Math.min(r.width / mapW, r.height / mapH) * 0.98; view.k = fitK;
  view.x = (r.width - mapW * fitK) / 2; view.y = (r.height - mapH * fitK) / 2; applyView();
}
function zoomAt(f, cx, cy) {
  const k = Math.max(fitK * 0.7, Math.min(fitK * 9, view.k * f)), s = k / view.k;
  view.x = cx - (cx - view.x) * s; view.y = cy - (cy - view.y) * s; view.k = k; applyView();
}
function focusOn(id) {
  const p = parseId(id); if (!p) return; const r = stageRect(), h = hexPos(T.map, p[0], p[1]);
  view.k = Math.max(view.k, Math.min(fitK * 2.2, 2.2)); view.x = r.width / 2 - h.x * view.k; view.y = r.height / 2 - h.y * view.k; applyView();
}

/* pointer: pan, pinch, tap */
const ptrs = new Map(); let drag = null, moved = false, pinch0 = null;
const onMapUi = e => !!(e.target.closest && e.target.closest('button, .mkbar, .zoom, .inspect, .followbar'));
stage.addEventListener('pointerdown', e => {
  if (onMapUi(e)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, target: e.target }; moved = false; }
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], r = stageRect();
    pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, vx: view.x, vy: view.y, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top }; moved = true;
  }
});
stage.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    const k = Math.max(fitK * 0.7, Math.min(fitK * 9, pinch0.k * d / pinch0.d)), s = k / pinch0.k;
    view.k = k; view.x = pinch0.cx - (pinch0.cx - pinch0.vx) * s; view.y = pinch0.cy - (pinch0.cy - pinch0.vy) * s; applyView();
  } else if (ptrs.size === 1 && drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 7) { moved = true; try { stage.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } }
    if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
  }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (e.type === 'pointerup' && ptrs.size === 0 && !moved && drag) { const g = drag.target.closest && drag.target.closest('[data-id]'); if (g) onCell(g.dataset.id); }
  if (ptrs.size === 0) { drag = null; pinch0 = null; }
};
stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
stage.addEventListener('wheel', e => { if (onMapUi(e)) return; e.preventDefault(); const r = stageRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
new ResizeObserver(() => { if (T.map && !fitDone) { fit(); fitDone = true; } }).observe(stage);
let fitDone = false;

/* ---------------- game logic ---------------- */
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const PUBLIC = ['noise', 'attack', 'spot', 'silence', 'hatch', 'item', 'reveal', 'out'];
function say(text, kind, sector, extra = {}) {
  const e = Object.assign({ id: uid(), by: myId() || '', turn: S.turn, who: S.name || t('Me'), kind, sector: sector || null, text: text || kind, mine: !S.hot, at: Date.now() }, extra);
  S.log.unshift(e);
  if (window.Sync && Sync.code && PUBLIC.includes(kind)) Sync.push({ id: e.id, by: Sync.uid, turn: e.turn, who: e.who, kind, sector: e.sector || '', text: e.text, at: e.at, n: e.n || 0, ok: e.ok ? 1 : 0 });
  if (S.log.length > 400) S.log.length = 400;
}
/* the printed icon that goes with a log line, if there is one (an Alien attack has none: the Attack icon is the item) */
function logIcon(e, w = 18) {
  if (e.kind === 'noise') return gico('noise-here', w);
  if (e.kind === 'silence') return e.text === 'secure' ? gicoSilent(w) : gico('silence', w);
  if (e.kind === 'attack') return S.log.some(x => x.kind === 'item' && x.text === 'attack' && x.turn === e.turn && playerKey(x) === playerKey(e)) ? gico('attack', w) : '';
  if (e.kind === 'spot' || e.kind === 'reveal') return gico('spotlight', w);
  if (e.kind === 'item') return gico(e.text, w);
  return '';
}
/* announcements are rendered from structured data so each player sees them in their own language */
function entryText(e) {
  const s = e.sector;
  if (e.kind === 'noise') return t('Noise in Sector {s}', { s });
  if (e.kind === 'attack') return t('Attack in Sector {s}', { s });
  if (e.kind === 'spot') return t('Spotlight on Sector {s}', { s });
  if (e.kind === 'silence') return t(e.text === 'secure' ? 'Silent Sector' : 'Silence in all Sectors');
  if (e.kind === 'hatch' && e.n) return t(e.ok ? 'Escape Hatch {n}: escaped' : 'Escape Hatch {n}: damaged', { n: e.n });
  if (e.kind === 'item') return t('plays {i}', { i: t(((typeof ITEMS !== 'undefined' && ITEMS[e.text]) || [e.text])[0]) });
  if (e.kind === 'reveal') return t('Position revealed: {s}', { s });
  if (e.kind === 'out') { const [why, role, ch] = String(e.text).split('|'); return t(why === 'escaped' ? 'escaped' : why === 'trapped' ? 'is trapped and out of the game' : 'was eliminated') + ' (' + t(role === 'alien' ? 'Alien' : 'Human') + (ch ? ', ' + t(ch) : '') + ')'; }
  return t(e.text);
}
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2600); }
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch (_) { /* noop */ } };
function selectCell(id) { T.sel = id; refreshReach(); render(); paintCells(); }
function refreshReach() { T.reach = S.phase === 'move' && !S.over && S.role && !T.editor ? reachable(T.map, S.pos, allowance(), S.role) : new Map(); }
const roomUrl = () => location.origin + location.pathname + '?room=' + Sync.code;
const actions = {
  hide() { $('#cover').hidden = false; },
  unhide() { $('#cover').hidden = true; },
  zin() { const r = stageRect(); zoomAt(1.4, r.width / 2, r.height / 2); },
  zout() { const r = stageRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); },
  fit, focus() { S.pos && focusOn(S.pos); },
  tab(b) { setTab(b.dataset.tab); },
  addann() { addDlg(); },
  clearlog() { confirmDlg(t('Clear all announcements?'), t('The history on this device will be erased.'), () => { S.log = []; afterChange(); }); },
  newgame() {
    const host = !!(Sync.code && Sync.isHost());
    const [title, body] = S.hot ? ['Close this game?', 'The pass-and-play game ends for everyone.'] : !Sync.code ? ['Start a new game?', 'Your route, notes and role will be erased.'] : host ? ['Close this game?', 'The game ends for everyone at the table. You can then host a new one.'] : ['Leave this game?', 'You leave the table. Your route and notes on this device are erased.'];
    confirmDlg(t(title), t(body), async () => {
      if (S.hot) Hot.clear();
      if (host) await Sync.updateSettings({ status: 'over', result: { reason: 'closed' } });
      Sync.leave(true); resetToWelcome(host ? 'host' : 'welcome');
    });
  },
  map(b) { actions.ovclose(); const m = T.maps.find(x => x.id === b.dataset.id); if (!m || m === T.map) return; confirmDlg(t('Switch map?'), t('Your position resets to the start sector of the new map.'), () => { T.map = m; S.mapId = m.id; S.pos = find(m, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; T.sel = null; S.phase = 'move'; S.res = null; buildMap(); afterChange(); }); },
  edit() { actions.ovclose(); startEditor(); },
  tool(b) { T.editor.tool = b.dataset.t; render(); },
  esave() { saveEditor(); },
  ecancel() { T.map = T.editor.orig; T.editor = null; setTab('more'); buildMap(); afterChange(); },
  eexport() { exportMap(); },
  eimport() { importDlg(); },
  edel(b) { S.customMaps = S.customMaps.filter(m => m.id !== b.dataset.id); loadMaps().then(() => { if (!T.maps.includes(T.map)) { T.map = T.maps.find(m => m.id === T.map.id) || T.maps[0]; S.mapId = T.map.id; } afterChange(); }); },
  share() { const url = roomUrl(), data = { title: 'EFTAIOS', text: t('Join my table: {c}', { c: Sync.code }), url }; if (navigator.share) navigator.share(data).catch(() => {}); else copyText(url, t('Link copied')); },
  qr() { qrDlg(); },
  lang(b) { setLang(b.dataset.l); },
  mapstyle(b) { setMapStyle(b.dataset.v); b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b)); },
  cancelpick() { T.pick = null; paintCells(); render(); },
  noop() { },
  sus(b) { const k = b.dataset.k, v = b.dataset.v; S.sus = S.sus || {}; if (v) S.sus[k] = v; else delete S.sus[k]; save(); render(); paintOverlay(); },
  pfocus(b) { follow(T.focus === b.dataset.k ? null : b.dataset.k); },
  unfollow() { follow(null); },
  follow(b) { setTab('play'); follow(b.dataset.k); },
  markmode() { T.markMode = !T.markMode; T.markTurn = S.turn; T.focus = null; if (T.markMode && !T.markKey) { const ps = knownPlayers(); if (ps.length === 1) T.markKey = ps[0][0]; } render(); paintOverlay(); },
  markwho(b) { T.markKey = b.dataset.k; render(); paintOverlay(); },
  mturn(b) { T.markTurn = Math.max(1, Math.min(MAX_TURN, (T.markTurn || S.turn) + +b.dataset.d)); render(); },
  addplayer() { const n = (prompt(t('Player name')) || '').trim().slice(0, 20); if (!n) return; S.extraPlayers = (S.extraPlayers || []).concat([n]); T.markKey = 'n:' + n.toLowerCase(); save(); render(); paintOverlay(); },
  notemode() { pickSector(t('Tap the sector for your note'), sec => noteDlg(sec)); },
  noteedit(b) { $('#inspect').hidden = true; noteDlg(b.dataset.s); },
  tsec(b) { T.tableSec = b.dataset.k; render(); },
  rules() { overlay(t('How to play'), rulesHtml()); },
  maps() { overlay(t('Map'), mapsHtml()); },
  ovclose() { const o = $('#overlay'); if (o) o.remove(); },
  revealview(b) { T.showAnn = b.dataset.v === 'ann'; b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b)); paintOverlay(); },
  mkall(b) { S.mkAll = b.dataset.v === '1'; save(); render(); paintOverlay(); }
};
function copyText(s, msg) { (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast(msg), () => toast(s)); }
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => { if (!T.editor) setTab(b.dataset.tab); }));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const f = actions[b.dataset.act]; if (f) { e.preventDefault(); f(b); }
});

function pickSector(label_, cb, locked) { T.pick = { label: label_, cb, locked: !!locked }; S.tab = 'play'; render(); paintCells(); hdr(); }
function onCell(id) {
  if (T.editor) { paintEditor(id); return; }
  if (T.pick) { const cb = T.pick.cb; T.pick = null; paintCells(); cb(id); return; }
  if (T.markMode) { if (T.markKey) toggleMark(id); else toast(t('First pick the player to mark, on the left.')); return; }
  if (S.role && S.phase === 'move' && !S.over && T.reach.has(id)) { selectCell(id); buzz(); return; }
  T.inspect = id; paintCells();
  const i = $('#inspect'), note = (S.notes || []).find(n => n.sector === id); i.hidden = false;
  i.innerHTML = `<b>${'HA1234'.includes(at(T.map, id)) ? '' : id}</b>${esc(typeName(at(T.map, id)))}${note ? `<div class="inote">${stickerIco(note.icon, 18)} ${esc(note.text || '')} <button class="btn" data-act="noteedit" data-s="${id}">${t('Edit')}</button></div>` : ''}`;
  clearTimeout(onCell.h); onCell.h = setTimeout(() => { T.inspect = null; i.hidden = true; paintCells(); }, note ? 6000 : 3500);
}

/* ---------------- announcements ---------------- */
const NOTE_TYPES = { noise: ['Noise', true], attack: ['Attack', true], spot: ['Spotlight', true], silence: ['Silence', false], info: ['Other', false] };
function addDlg() {
  dlg.innerHTML = `<h2>${t('Record an announcement')}</h2><p class="dim">${t('Something another player just announced.')}</p>
    <div class="chips" role="group" aria-label="${t('Type')}">${Object.entries(NOTE_TYPES).map(([k, v]) => `<button data-k="${k}" aria-pressed="${k === T.noteType}">${t(v[0])}</button>`).join('')}</div>
    <div class="stack" style="margin-top:12px"><input id="note-who" type="text" maxlength="20" placeholder="${t('Player name')}" value="${esc(T.noteWho)}" aria-label="${t('Player name')}">
    <input id="note-text" type="text" maxlength="80" placeholder="${t('Note')}" aria-label="${t('Note')}" ${T.noteType === 'info' ? '' : 'hidden'}></div>
    <div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn primary" id="d-yes">${t('Next')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  dlg.querySelectorAll('.chips button').forEach(b => b.onclick = () => { T.noteType = b.dataset.k; dlg.querySelectorAll('.chips button').forEach(x => x.setAttribute('aria-pressed', x === b)); $('#note-text').hidden = T.noteType !== 'info'; });
  $('#d-yes').onclick = () => { const who = $('#note-who').value.trim(), text = $('#note-text').value.trim(); T.noteWho = who; closeDlg(); addNote(who, text); };
}
function addNote(who, text) {
  const k = T.noteType, needsSector = NOTE_TYPES[k][1], finish = sec => {
    S.log.unshift({ id: uid(), turn: S.turn, who: who || t('Someone'), kind: k, sector: sec || null, text: text || 'Note', mine: false, at: Date.now() });
    afterChange(); setTab('table');
    if (k === 'spot' && S.pos && !S.over) { const q = parseId(sec), near = q && (sec === S.pos || neighbors(T.map, q[0], q[1]).some(([a, b]) => cid(a, b) === S.pos)); if (near) alertDlg(t('Spotlight!'), t('You are in range. Announce your exact location now: {p}.', { p: label(S.pos) })); }
  };
  if (needsSector) pickSector(t('Tap the sector announced by {w}', { w: who || t('the player') }), finish); else finish(null);
}

/* ---------------- dialogs ---------------- */
const dlg = $('#dlg');
const closeDlg = () => { if (dlg.open) dlg.close(); };
function confirmDlg(title, body, ok) {
  dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn danger" id="d-yes">${t('Confirm')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg; $('#d-yes').onclick = () => { closeDlg(); ok(); };
}
function alertDlg(title, body) { dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="row"><button class="btn primary" id="d-no">OK</button></div>`; dlg.showModal(); $('#d-no').onclick = closeDlg; }
function qrSvg(text) {
  const q = qrcode(0, 'M'); q.addData(text); q.make(); const n = q.getModuleCount(); let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 2} ${r + 2}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n + 4} ${n + 4}" role="img" aria-label="QR code" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
}
function qrDlg() {
  const url = roomUrl();
  dlg.innerHTML = `<h2>${t('Join my table')}</h2><p class="dim">${t('Scan with the phone camera, or enter the code in the app.')}</p>
    <div class="qr">${qrSvg(url)}</div><div class="say silent" style="margin:12px 0 0;text-align:center"><small>${t('Table code')}</small><b style="letter-spacing:.3em;color:var(--text)">${esc(Sync.code)}</b></div>
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button><button class="btn primary" data-act="share">${t('Share link')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
function importDlg() {
  dlg.innerHTML = `<h2>${t('Import map')}</h2><p class="dim">${t('Paste map JSON or choose a file.')}</p>
    <textarea id="imp" spellcheck="false" aria-label="JSON"></textarea><input id="imp-file" type="file" accept=".json,application/json" style="margin-top:10px">
    <p id="imp-err" style="color:#ff9d8a"></p><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn primary" id="d-yes">${t('Import')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  $('#imp-file').onchange = async e => { const f = e.target.files[0]; if (f) $('#imp').value = await f.text(); };
  $('#d-yes').onclick = () => {
    try {
      const j = JSON.parse($('#imp').value), list = (j.maps || [j]).map(m => { const p = parseMap(m); return { id: m.id || 'custom-' + Date.now(), name: p.name, rows_data: m.rows_data, oddColumnsLower: p.odd }; });
      list.forEach(m => { S.customMaps = S.customMaps.filter(x => x.id !== m.id).concat(m); });
      loadMaps().then(() => { afterChange(); closeDlg(); toast(t('Map imported')); });
    } catch (e) { $('#imp-err').textContent = t('Could not import: {m}', { m: e.message }); }
  };
}

/* ---------------- map editor ---------------- */
function startEditor() {
  const m = T.map; T.editor = { tool: '.', name: m.name + ' (2)', odd: m.odd, grid: m.grid.map(r => r.slice()), orig: m };
  T.sel = null; T.pick = null; T.reach = new Map(); setTab('play');
  T.map = Object.assign({}, m, { grid: T.editor.grid }); buildMap(); render();
}
function paintEditor(id) {
  const [c, r] = parseId(id), tool = T.editor.tool, g = T.editor.grid;
  if ('HA1234'.includes(tool)) for (const row of g) for (let i = 0; i < row.length; i++) if (row[i] === tool) row[i] = '.';
  g[r][c] = tool; paintCells();
}
function saveEditor() {
  const g = T.editor.grid, name = ($('#ed-name').value || 'Custom map').trim();
  if (!g.some(r => r.includes('H')) || !g.some(r => r.includes('A'))) return toast(t('Place the Human and Alien start sectors'));
  const id = 'custom-' + Date.now();
  S.customMaps.push({ id, name, rows_data: g.map(r => r.join('')), oddColumnsLower: T.editor.odd });
  T.editor = null; loadMaps().then(() => { T.map = T.maps.find(m => m.id === id); S.mapId = id; if (S.role) { S.pos = find(T.map, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; S.phase = 'move'; S.res = null; } buildMap(); afterChange(); setTab('more'); toast(t('Map saved')); });
}
function exportMap() {
  const m = T.map, json = JSON.stringify({ id: m.id, name: m.name, oddColumnsLower: m.odd, rows_data: m.grid.map(r => r.join('')) }, null, 1);
  dlg.innerHTML = `<h2>${t('Export map')}</h2><textarea readonly id="exp">${esc(json)}</textarea>
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button><button class="btn primary" id="d-copy">${t('Copy')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  $('#d-copy').onclick = () => copyText(json, t('Copied'));
}

/* ---------------- panels ---------------- */
function setTab(k) { S.tab = k; T.pick = null; save(); render(); paintCells(); hdr(); }
function hdr() {
  $('#hd-turn').textContent = S.turn; $('#hd-pos').textContent = S.pos ? ('HA'.includes(at(T.map, S.pos)) ? t('Start') : label(S.pos)) : '—';
  const r = $('#hd-role'); r.className = 'chip ' + S.role + (S.fed ? ' fed' : ''); r.textContent = S.role === 'alien' ? (S.fed ? t('Alien') + ' · ' + t('Fed') : t('Alien')) : t('Human');
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
  const tb = $('#turnbar');
  if (Sync.code && T.turnState && !(Sync.settings && Sync.settings.status === 'over')) { const mine = T.turnState.uid === Sync.uid; tb.hidden = false; tb.className = 'turnbar' + (mine ? ' mine' : ''); tb.textContent = mine ? t('Your turn!') : t('{p} is playing', { p: ((Sync.players[T.turnState.uid] || {}).name) || '?' }); } else tb.hidden = true;
}
function render() {
  const p = $('#panel-body'); let h = '';
  if (T.pick) h = `<div class="banner"><span>${esc(T.pick.label)}</span>${T.pick.locked ? '' : `<button class="btn" data-act="cancelpick">${t('Cancel')}</button>`}</div>`;
  if (T.markMode && !T.pick) h = markBanner();
  if (T.editor) h = editorPanel();
  else if (T.markMode && !T.pick) { /* marking: banner only */ }
  else if (S.tab === 'play') h += playPanel();
  else if (S.tab === 'table') h += tablePanel();
  else h += morePanel();
  p.innerHTML = h;
  const rc = $('#room-code'); if (rc) rc.onkeydown = e => { if (e.key === 'Enter') actions.syncjoin(); };
  const sh = $('#sheet'); if (sh) sh.scrollLeft = sh.scrollWidth;   // the sheet opens on the latest turns
}
const RULES = [
  ['Goal', ['<b>Humans</b> reach an Escape Hatch. <b>Aliens</b> hunt every Human down.', '<b>Basic game:</b> it ends when the first Human reaches a hatch. Aliens win if all Humans die or 39 rounds pass.', '<b>Advanced game:</b> adds Items and Escape Hatch cards. Play continues until every Human has escaped or been eliminated. Humans still aboard after 39 rounds are eliminated.']],
  ['Your turn', ['<b>Move</b> (mandatory, never ending where you started). Humans 1 sector. Aliens 1–2 sectors, or 1–3 after feeding.', '<b>Secure sector:</b> your turn is over.', '<b>Dangerous sector:</b> draw a card: Noise in your sector, Noise in any sector or Silence.', '<b>Alien attack:</b> after moving, announce the attack instead of drawing. Anyone there (Human or Alien) is eliminated and reveals their card. Humans cannot attack without an Attack item.']],
  ['Sectors', ['Dangerous: draw a card. Secure: nothing happens.', 'Human and Alien start sectors: nobody may enter or cross them.', 'Escape Hatches: Humans only. They have no coordinates.']],
  ['Escape Hatches (Advanced)', ['Declare which hatch you reached, draw an Escape Hatch card and reveal it.', '<b>Red:</b> hatch damaged, closed for everyone. <b>Green:</b> you escaped and the hatch is blocked.', 'If every hatch is closed you are eliminated.']],
  ['Items (Advanced)', ['A Noise card with an Item icon makes you draw an Item card (Aliens too). Max 3 held. Only Humans can use them.', '<b>Attack</b> as an Alien would. <b>Teleport</b> to the Human sector, plus your normal move. <b>Sedatives</b> no card this turn. <b>Spotlight</b> name a sector: it and its 6 neighbours must announce exact coordinates. <b>Defense</b> survive an attack. <b>Adrenaline</b> move 2 sectors.']],
  ['Infection scenario', ['Eliminated Humans become Aliens where they fell. All hatches start open and each works once. Aliens do not speed up after feeding.']]
];
/* full-screen sheet for long content (rules, map list): read without squeezing it into the panel */
function overlay(title, html) {
  actions.ovclose();
  const g = document.createElement('div'); g.id = 'overlay'; g.className = 'gallery'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', title);
  g.innerHTML = `<header><h2>${esc(title)}</h2><button class="icon-btn" data-act="ovclose" aria-label="${t('Close')}">${ico('close')}</button></header><div class="gbody">${html}</div>`;
  document.body.appendChild(g); g.querySelector('[data-act=ovclose]').focus();
}
const rulesHtml = () => `<div class="rules">${RULES.map(([h, li]) => `<h4>${t(h)}</h4><ul>${li.map(x => `<li>${t(x)}</li>`).join('')}</ul>`).join('')}
  <p class="dim fine2">${t('A summary of the official rulebook. The rulebook is authoritative.')} ${t('Unofficial fan companion for Escape from the Aliens in Outer Space.')}</p></div>`;
const mapsHtml = () => `<div class="ggrid">${T.maps.map(m => `<div class="gwrap"><button class="gcard" data-act="map" data-id="${esc(m.id)}" aria-pressed="${m.id === T.map.id}">${mapPreview(m)}<b>${esc(m.name)}</b></button>${(S.customMaps || []).some(c => c.id === m.id) ? `<button class="btn danger gdel" data-act="edel" data-id="${esc(m.id)}" aria-label="${t('Delete')}">${ico('close', 16)}</button>` : ''}</div>`).join('')}</div>
  <div class="row" style="margin-top:16px"><button class="btn" data-act="edit">${t('Edit map')}</button><button class="btn" data-act="eexport">${t('Export')}</button><button class="btn" data-act="eimport">${t('Import')}</button></div>`;
const segRow = (label_, act, key, cur, opts) => `<div class="setrow"><span>${t(label_)}</span><div class="seg" role="radiogroup" aria-label="${t(label_)}">${opts.map(([v, l]) => `<button role="radio" data-act="${act}" data-${key}="${v}" aria-checked="${cur === v}">${l}</button>`).join('')}</div></div>`;
function morePanel() {
  const solo = !Sync.code && !S.hot, host = !!(Sync.code && Sync.isHost());
  const ng = S.hot || host ? 'Close game' : Sync.code ? 'Leave game' : 'New game';
  return `<div class="menu">
    <div class="tiles${solo ? '' : ' one'}"><button class="mrow" data-act="rules">${t('How to play')}<i aria-hidden="true">${ico('next', 18)}</i></button>
    ${solo ? `<button class="mrow" data-act="maps">${t('Map')}<i aria-hidden="true">${ico('next', 18)}</i></button>` : ''}</div>
    ${solo ? `<div class="setrow"><span>${t('Turn')}</span><div class="stepper"><button class="btn" data-act="turnminus" aria-label="${t('Previous turn')}">−</button><b>${S.turn}<small>/${MAX_TURN}</small></b><button class="btn" data-act="turnplus" aria-label="${t('Next turn')}">+</button></div></div>` : ''}
    ${segRow('Map style', 'mapstyle', 'v', MAP_STYLE, [['dark', t('Dark')], ['classic', t('Classic')]])}
    ${segRow('Language', 'lang', 'l', LANG, [['en', 'English'], ['it', 'Italiano']])}
    </div>
    <div class="row menuact"><button class="btn danger" data-act="newgame">${t(ng)}</button></div>`;
}
function editorPanel() {
  const tl = [['.', 'Dangerous', '#59627a'], ['s', 'Secure', '#ece6d3'], ['x', 'Empty', '#0b1222'], ['H', 'Human', '#1c5d93'], ['A', 'Alien', '#a53312'], ['1', 'Hatch 1', '#1e8a4f'], ['2', 'Hatch 2', '#1e8a4f'], ['3', 'Hatch 3', '#1e8a4f'], ['4', 'Hatch 4', '#1e8a4f']];
  return `<h2>${t('Edit map')}</h2><p class="dim">${t('Pick a tool, then tap sectors. Start sectors and hatches are unique.')}</p>
    <div class="tools" role="group">${tl.map(([k, n, c]) => `<button data-act="tool" data-t="${k}" aria-pressed="${T.editor.tool === k}"><i style="background:${c};outline:1px solid #fff3"></i>${t(n)}</button>`).join('')}</div>
    <label class="field" style="margin-top:14px"><span>${t('Map name')}</span><input id="ed-name" type="text" maxlength="40" value="${esc(T.editor.name)}"></label>
    <div class="row"><button class="btn" data-act="ecancel">${t('Cancel')}</button><button class="btn primary" data-act="esave">${t('Save map')}</button></div>`;
}

/* ---------------- boot ---------------- */
function setLang(l) { LANG = l; try { localStorage.setItem('eftaios.lang', l); } catch (_) { /* noop */ } applyStatic(); if (S.stage === 'game' && S.role) { render(); hdr(); paintCells(); } else renderFlow(); }
/* back to the start screen, keeping only the name and custom maps */
function resetToWelcome(stage) { const keep = { customMaps: S.customMaps, name: S.name, mapId: S.mapId, mode: S.mode, cards: S.cards }; S = Object.assign(fresh(), keep); S.stage = stage || 'welcome'; T.turnState = null; T.counts = null; Sync.status = 'off'; closeDlg(); save(); boot(); }
function boot() {
  if (S.hot && window.Hot) Hot.rebind();
  T.editor = null; T.pick = null; T.sel = null;
  const game = S.stage === 'game' && S.role;
  $('#flow').hidden = !!game; $('#app').hidden = !game;
  applyStatic();
  if (!game) { if (S.stage === 'game') S.stage = 'welcome'; renderFlow(); return; }
  T.map = T.maps.find(m => m.id === S.mapId) || T.maps[0]; S.mapId = T.map.id;
  if (!S.pos || !parseId(S.pos)) { S.pos = find(T.map, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; }
  fitDone = false; buildMap(); refreshReach(); render(); paintCells(); hdr();
  requestAnimationFrame(() => { fit(); fitDone = true; if (S.pos) focusOn(S.pos); });
}
