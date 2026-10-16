'use strict';
/* EFTAIOS Companion — tracks a player's secret route for the physical board game.
   No cards, no hidden-information resolution: the app only records what the player tells it. */

const MAX_TURN = 39;
const SVGNS = 'http://www.w3.org/2000/svg';
const HEX = 20; // hex radius in map units
const STORE = 'eftaios.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const colL = c => String.fromCharCode(65 + c);
const cid = (c, r) => colL(c) + String(r + 1).padStart(2, '0');
const parseId = s => { const m = /^([A-Za-z])\s*0?(\d{1,2})$/.exec(String(s).trim()); return m ? [m[1].toUpperCase().charCodeAt(0) - 65, +m[2] - 1] : null; };

/* ---------------- state ---------------- */
const fresh = () => ({
  stage: 'welcome', myRole: null, ready: false, items: [], undo: null, sus: {}, shapes: {}, mkAll: false, char: '', online: false, outSent: false, revealed: false, room: null, mapId: null, mode: 'advanced', role: null, name: '', turn: 1, pos: null, fed: false, adr: false,
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
  return { id: m.id || 'map-' + Date.now(), name: m.name || 'Custom map', description: m.description || '', official: !!m.official, cols: rows[0].length, rows: rows.length, odd: m.oddColumnsLower !== false, grid: rows.map(r => r.split('')) };
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

function buildMap() {
  const map = T.map; svg.textContent = '';
  mapW = HEX * 2 + 1.5 * HEX * (map.cols - 1); mapH = Math.sqrt(3) * HEX * (map.rows + 0.5);
  const vp = el('g', { id: 'vp' }, svg);
  const cells = el('g', { id: 'cells' }, vp);
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const { x, y } = hexPos(map, c, r), id = cid(c, r);
    const g = el('g', { 'data-id': id }, cells);
    el('polygon', { points: hexPts(x, y, HEX - 0.6), class: 'hex' }, g);
    const t = el('text', { x, y: y + 12, class: 'lbl' }, g); t.textContent = id;
    el('text', { x, y, class: 'sym' }, g);
  }
  el('polyline', { id: 'trail', class: 'trail' }, vp);
  el('g', { id: 'marks' }, vp); el('g', { id: 'me' }, vp);
  paintCells(); fit();
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
    const txt = t === 'H' ? tr('HUMANS') : t === 'A' ? tr('ALIENS') : '1234'.includes(t) ? t : '';
    g.children[1].textContent = txt ? '' : id; sym.textContent = txt; sym.setAttribute('class', 'sym' + (txt.length > 1 ? ' sm' : ''));
  }
  paintOverlay();
}
/* ---- player markers: one shape per player, neutral or suspected Human (blue) / Alien (red) ---- */
const SHAPES = 8, MK_RECENT = 5;
function shapePath(i, r) {
  const poly = (n, rot, k = 1) => { let d = ''; for (let j = 0; j < n; j++) { const a = rot + j * 2 * Math.PI / n, rr = (k !== 1 && j % 2) ? r * k : r; d += (j ? 'L' : 'M') + (rr * Math.cos(a)).toFixed(2) + ' ' + (rr * Math.sin(a)).toFixed(2); } return d + 'Z'; };
  const q = -Math.PI / 2;
  switch (i % SHAPES) {
    case 0: return `M${-r} 0a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;     // circle
    case 1: { const s = r * 0.86; return `M${-s} ${-s}H${s}V${s}H${-s}Z`; }                    // square
    case 2: return poly(3, q);                                                                  // triangle
    case 3: return poly(4, q);                                                                  // diamond
    case 4: return poly(5, q);                                                                  // pentagon
    case 5: return poly(10, q, 0.45);                                                           // star
    case 6: { const w = r * 0.38; return `M${-w} ${-r}H${w}V${-w}H${r}V${w}H${w}V${r}H${-w}V${w}H${-r}V${-w}H${-w}Z`; } // cross
    default: return poly(3, Math.PI / 2);                                                       // triangle down
  }
}
const shapeIcon = (i, sus) => `<svg class="shp ${sus || 'neutral'}" viewBox="-10 -10 20 20" aria-hidden="true"><path d="${shapePath(i, 8)}"/></svg>`;
/* a stable key per player: table players by id, hand-written notes by name */
function playerKey(e) {
  if (e.mine || (e.by && window.Sync && e.by === Sync.uid)) return 'me';
  if (e.by) return 'u:' + e.by;
  const name = String(e.who || '?').trim().toLowerCase();
  const ps = (window.Sync && Sync.players) || {};
  for (const u in ps) if ((ps[u].name || '').toLowerCase() === name) return 'u:' + u;
  return 'n:' + name;
}
function shapeOf(key) {
  const k = key === 'me' && window.Sync && Sync.uid && Sync.code ? 'u:' + Sync.uid : key;
  const ord = (window.Sync && Sync.settings && Sync.settings.order) || [];
  if (k.startsWith('u:')) { const i = ord.indexOf(k.slice(2)); if (i >= 0) return i % SHAPES; }
  S.shapes = S.shapes || {};
  if (!(k in S.shapes)) S.shapes[k] = (ord.length + Object.keys(S.shapes).length) % SHAPES;
  return S.shapes[k];
}
const suspicion = key => (key !== 'me' && S.sus && S.sus[key]) || '';
function paintOverlay() {
  const map = T.map, inPlay = S.role && !T.editor;
  const trail = $('#trail'), marks = $('#marks'), me = $('#me');
  const pts = inPlay ? S.path.map(p => { const [c, r] = parseId(p.pos), h = hexPos(map, c, r); return h.x + ',' + h.y; }) : [];
  trail.setAttribute('points', pts.join(' '));
  marks.textContent = ''; me.textContent = '';
  if (!inPlay) return;
  // numbered footprints of my route
  const seen = new Set();
  for (const p of S.path.slice().reverse()) {
    if (seen.has(p.pos) || p.pos === S.pos) continue; seen.add(p.pos);
    const [c, r] = parseId(p.pos), h = hexPos(map, c, r);
    const t = el('text', { x: h.x, y: h.y - 7, class: 'tnum' }, marks); t.textContent = p.turn || 'S';
  }
  // other players' announcements: latest per player per sector, recent turns only unless "all"
  const bySector = new Map(), done = new Set();
  for (const e of S.log) {
    if (!e.sector || !['noise', 'attack', 'reveal', 'spot'].includes(e.kind)) continue;
    if (!S.mkAll && S.turn - e.turn >= MK_RECENT) continue;
    const key = e.kind === 'spot' ? 'spot' : playerKey(e), id = key + '@' + e.sector;
    if (done.has(id)) continue; done.add(id);
    if (!bySector.has(e.sector)) bySector.set(e.sector, []);
    bySector.get(e.sector).push({ e, key });
  }
  const OFF = [[9, -9], [-9, -9], [9, 9], [-9, 9], [0, -13], [0, 13], [13, 0], [-13, 0]];
  bySector.forEach((list, sec) => {
    const p = parseId(sec); if (!p) return; const h = hexPos(map, p[0], p[1]);
    list.slice(0, OFF.length).forEach(({ e, key }, i) => {
      const [dx, dy] = list.length === 1 ? OFF[0] : OFF[i], old = S.turn - e.turn >= 2;
      if (key === 'spot') { const g = el('g', { class: 'mk spot', transform: `translate(${h.x} ${h.y})` }, marks); el('circle', { r: 15 }, g); return; }
      const sus = suspicion(key);
      const g = el('g', { class: `mk pm ${e.kind} ${sus || 'neutral'}${old ? ' old' : ''}`, transform: `translate(${h.x + dx} ${h.y + dy})` }, marks);
      el('path', { d: shapePath(shapeOf(key), 7.5) }, g);
      const t = el('text', {}, g); t.textContent = e.turn;
    });
  });
  if (S.pos) {
    const [c, r] = parseId(S.pos), h = hexPos(map, c, r);
    el('circle', { cx: h.x, cy: h.y, r: 13, class: 'me-ring pulse' }, me);
    el('circle', { cx: h.x, cy: h.y, r: 8, class: 'me-dot ' + S.role }, me);
    el('circle', { cx: h.x, cy: h.y, r: 13, class: 'me-ring' }, me);
  }
}
function applyView() {
  $('#vp').setAttribute('transform', `translate(${view.x.toFixed(1)} ${view.y.toFixed(1)}) scale(${view.k.toFixed(3)})`);
  svg.classList.toggle('zl', view.k > fitK * 1.7);
}
function fit() {
  const r = svg.getBoundingClientRect(); if (!r.width) return;
  fitK = Math.min(r.width / mapW, r.height / mapH) * 0.98; view.k = fitK;
  view.x = (r.width - mapW * fitK) / 2; view.y = (r.height - mapH * fitK) / 2; applyView();
}
function zoomAt(f, cx, cy) {
  const k = Math.max(fitK * 0.7, Math.min(fitK * 9, view.k * f)), s = k / view.k;
  view.x = cx - (cx - view.x) * s; view.y = cy - (cy - view.y) * s; view.k = k; applyView();
}
function focusOn(id) {
  const p = parseId(id); if (!p) return; const r = svg.getBoundingClientRect(), h = hexPos(T.map, p[0], p[1]);
  view.k = Math.max(view.k, Math.min(fitK * 2.2, 2.2)); view.x = r.width / 2 - h.x * view.k; view.y = r.height / 2 - h.y * view.k; applyView();
}

/* pointer: pan, pinch, tap */
const ptrs = new Map(); let drag = null, moved = false, pinch0 = null;
svg.addEventListener('pointerdown', e => {
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, target: e.target }; moved = false; }
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], r = svg.getBoundingClientRect();
    pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, vx: view.x, vy: view.y, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top }; moved = true;
  }
});
svg.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 2 && pinch0) {
    const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
    const k = Math.max(fitK * 0.7, Math.min(fitK * 9, pinch0.k * d / pinch0.d)), s = k / pinch0.k;
    view.k = k; view.x = pinch0.cx - (pinch0.cx - pinch0.vx) * s; view.y = pinch0.cy - (pinch0.cy - pinch0.vy) * s; applyView();
  } else if (ptrs.size === 1 && drag) {
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!moved && Math.hypot(dx, dy) > 7) { moved = true; try { svg.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } }
    if (moved) { view.x = drag.vx + dx; view.y = drag.vy + dy; applyView(); }
  }
});
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (e.type === 'pointerup' && ptrs.size === 0 && !moved && drag) { const g = drag.target.closest && drag.target.closest('[data-id]'); if (g) onCell(g.dataset.id); }
  if (ptrs.size === 0) { drag = null; pinch0 = null; }
};
svg.addEventListener('pointerup', endPtr); svg.addEventListener('pointercancel', endPtr);
svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
new ResizeObserver(() => { if (T.map && !fitDone) { fit(); fitDone = true; } }).observe(svg);
let fitDone = false;

/* ---------------- game logic ---------------- */
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const PUBLIC = ['noise', 'attack', 'spot', 'silence', 'hatch', 'item', 'reveal', 'out'];
function say(text, kind, sector, extra = {}) {
  const e = Object.assign({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind, sector: sector || null, text: text || kind, mine: true, at: Date.now() }, extra);
  S.log.unshift(e);
  if (window.Sync && Sync.code && PUBLIC.includes(kind)) Sync.push({ id: e.id, by: Sync.uid, turn: e.turn, who: e.who, kind, sector: e.sector || '', text: e.text, at: e.at, n: e.n || 0, ok: e.ok ? 1 : 0 });
  if (S.log.length > 400) S.log.length = 400;
}
/* announcements are rendered from structured data so each player sees them in their own language */
function entryText(e) {
  const s = e.sector;
  if (e.kind === 'noise') return t('Noise in Sector {s}', { s });
  if (e.kind === 'attack') return t('Attack in Sector {s}', { s });
  if (e.kind === 'spot') return t('Spotlight on Sector {s}', { s });
  if (e.kind === 'silence') return t('Silence in all Sectors');
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
  zin() { const r = svg.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); },
  zout() { const r = svg.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); },
  fit, focus() { S.pos && focusOn(S.pos); },
  tab(b) { setTab(b.dataset.tab); },
  addann() { addDlg(); },
  clearlog() { confirmDlg(t('Clear all announcements?'), t('The history on this device will be erased.'), () => { S.log = []; afterChange(); }); },
  newgame() {
    const host = !!(Sync.code && Sync.isHost());
    const [title, body] = !Sync.code ? ['Start a new game?', 'Your route, notes and role will be erased.'] : host ? ['Close this game?', 'The game ends for everyone at the table. You can then host a new one.'] : ['Leave this game?', 'You leave the table. Your route and notes on this device are erased.'];
    confirmDlg(t(title), t(body), async () => {
      if (host) await Sync.updateSettings({ status: 'over', result: { reason: 'closed' } });
      Sync.leave(true); resetToWelcome(host ? 'host' : 'welcome');
    });
  },
  map(b) { const m = T.maps.find(x => x.id === b.dataset.id); if (!m || m === T.map) return; confirmDlg(t('Switch map?'), t('Your position resets to the start sector of the new map.'), () => { T.map = m; S.mapId = m.id; S.pos = find(m, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; T.sel = null; S.phase = 'move'; S.res = null; buildMap(); afterChange(); }); },
  edit() { startEditor(); },
  tool(b) { T.editor.tool = b.dataset.t; render(); },
  esave() { saveEditor(); },
  ecancel() { T.map = T.editor.orig; T.editor = null; setTab('more'); buildMap(); afterChange(); },
  eexport() { exportMap(); },
  eimport() { importDlg(); },
  edel(b) { S.customMaps = S.customMaps.filter(m => m.id !== b.dataset.id); loadMaps().then(() => { if (!T.maps.includes(T.map)) { T.map = T.maps.find(m => m.id === T.map.id) || T.maps[0]; S.mapId = T.map.id; } afterChange(); }); },
  share() { const url = roomUrl(), data = { title: 'EFTAIOS', text: t('Join my table: {c}', { c: Sync.code }), url }; if (navigator.share) navigator.share(data).catch(() => {}); else copyText(url, t('Link copied')); },
  qr() { qrDlg(); },
  lang(b) { setLang(b.dataset.l); },
  cancelpick() { T.pick = null; paintCells(); render(); },
  noop() { },
  sus(b) { const k = b.dataset.k, v = b.dataset.v; S.sus = S.sus || {}; if (v) S.sus[k] = v; else delete S.sus[k]; save(); render(); paintOverlay(); },
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
  if (S.role && S.phase === 'move' && !S.over && T.reach.has(id)) { selectCell(id); buzz(); return; }
  T.inspect = id; paintCells();
  const i = $('#inspect'); i.hidden = false; i.innerHTML = `<b>${'HA1234'.includes(at(T.map, id)) ? '' : id}</b>${esc(typeName(at(T.map, id)))}`;
  clearTimeout(onCell.h); onCell.h = setTimeout(() => { T.inspect = null; i.hidden = true; paintCells(); }, 3500);
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
  if (T.editor) h = editorPanel();
  else if (S.tab === 'play') h += playPanel();
  else if (S.tab === 'table') h += tablePanel();
  else h += morePanel();
  p.innerHTML = h;
  const gi = $('#go-input'); if (gi) gi.onkeydown = e => { if (e.key === 'Enter') actions.go(); };
  const rc = $('#room-code'); if (rc) rc.onkeydown = e => { if (e.key === 'Enter') actions.syncjoin(); };
}
const RULES = [
  ['Goal', ['<b>Humans</b> reach an Escape Hatch. <b>Aliens</b> hunt every Human down.', '<b>Basic game:</b> it ends when the first Human reaches a hatch. Aliens win if all Humans die or 39 rounds pass.', '<b>Advanced game:</b> adds Items and Escape Hatch cards. Play continues until every Human has escaped or been eliminated. Humans still aboard after 39 rounds are eliminated.']],
  ['Your turn', ['<b>Move</b> (mandatory, never ending where you started). Humans 1 sector. Aliens 1–2 sectors, or 1–3 after feeding.', '<b>Secure sector:</b> your turn is over.', '<b>Dangerous sector:</b> draw a card: Noise in your sector, Noise in any sector or Silence.', '<b>Alien attack:</b> after moving, announce the attack instead of drawing. Anyone there (Human or Alien) is eliminated and reveals their card. Humans cannot attack without an Attack item.']],
  ['Sectors', ['Dangerous: draw a card. Secure: nothing happens.', 'Human and Alien start sectors: nobody may enter or cross them.', 'Escape Hatches: Humans only. They have no coordinates.']],
  ['Escape Hatches (Advanced)', ['Declare which hatch you reached, draw an Escape Hatch card and reveal it.', '<b>Red:</b> hatch damaged, closed for everyone. <b>Green:</b> you escaped and the hatch is blocked.', 'If every hatch is closed you are eliminated.']],
  ['Items (Advanced)', ['A Noise card with an Item icon makes you draw an Item card (Aliens too). Max 3 held. Only Humans can use them.', '<b>Attack</b> as an Alien would. <b>Teleport</b> to the Human sector, plus your normal move. <b>Sedatives</b> no card this turn. <b>Spotlight</b> name a sector: it and its 6 neighbours must announce exact coordinates. <b>Defense</b> survive an attack. <b>Adrenaline</b> move 2 sectors.']],
  ['Infection scenario', ['Eliminated Humans become Aliens where they fell. All hatches start open and each works once. Aliens do not speed up after feeding.']]
];
function morePanel() {
  const maps = T.maps.map(m => `<div class="inline" style="margin-bottom:8px"><button class="btn mapbtn${m.id === T.map.id ? ' on' : ''}" data-act="map" data-id="${esc(m.id)}">${esc(m.name)}${m.description ? '<small>' + esc(t(m.description)) + '</small>' : ''}</button>${(S.customMaps || []).some(c => c.id === m.id) ? `<button class="btn danger" data-act="edel" data-id="${esc(m.id)}" aria-label="${t('Delete')}">✕</button>` : ''}</div>`).join('');
  return `<h2>${t('More')}</h2>
    <details class="acc"><summary>${t('How to play')}</summary><div class="rules"><p class="dim">${t('A summary of the official rulebook. The rulebook is authoritative.')}</p>
      ${RULES.map(([h, li]) => `<h4>${t(h)}</h4><ul>${li.map(x => `<li>${t(x)}</li>`).join('')}</ul>`).join('')}</div></details>
    <details class="acc"><summary>${t('Map')}</summary>${maps}<div class="row"><button class="btn" data-act="edit">${t('Edit map')}</button><button class="btn" data-act="eexport">${t('Export')}</button><button class="btn" data-act="eimport">${t('Import')}</button></div></details>
    <details class="acc"><summary>${t('Game')}</summary>${Sync.code ? `<p>${t('Turn {n} of {m}', { n: S.turn, m: MAX_TURN })}</p>` : `<div class="inline"><button class="btn" data-act="turnminus" aria-label="−">−</button><div class="btn static">${t('Turn {n} of {m}', { n: S.turn, m: MAX_TURN })}</div><button class="btn" data-act="turnplus" aria-label="+">+</button></div>`}
      <div class="stack" style="margin-top:10px"><button class="btn" data-act="hide">${t('Hide screen')}</button><button class="btn" data-act="clearlog">${t('Clear announcements')}</button><button class="btn danger" data-act="newgame">${t('New game')}</button></div></details>
    <details class="acc"><summary>${t('Language')}</summary><div class="chips">${['en', 'it'].map(l => `<button data-act="lang" data-l="${l}" aria-pressed="${LANG === l}">${l === 'en' ? 'English' : 'Italiano'}</button>`).join('')}</div></details>
    <p class="dim fine2">${t('Unofficial fan companion for Escape from the Aliens in Outer Space. Requires the physical game; no cards are included.')}</p>`;
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
