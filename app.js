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
  stage: 'welcome', myRole: null, ready: false, room: null, mapId: null, mode: 'advanced', role: null, name: '', turn: 1, pos: null, fed: false, adr: false,
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
  // announcements heard / made
  const done = new Set();
  for (const e of S.log) {
    if (!e.sector || !['noise', 'attack', 'spot'].includes(e.kind) || done.has(e.sector)) continue; done.add(e.sector);
    const p = parseId(e.sector); if (!p) continue; const h = hexPos(map, p[0], p[1]);
    const g = el('g', { class: 'mk ' + e.kind, transform: `translate(${h.x + 8} ${h.y - 8})` }, marks);
    el('circle', { r: 7 }, g); const t = el('text', {}, g); t.textContent = e.turn;
  }
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
const PUBLIC = ['noise', 'attack', 'spot', 'silence', 'hatch'];
function say(text, kind, sector, extra = {}) {
  const e = Object.assign({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind, sector: sector || null, text: text || kind, mine: true, at: Date.now() }, extra);
  S.log.unshift(e);
  if (window.Sync && Sync.code && PUBLIC.includes(kind)) Sync.push({ id: e.id, turn: e.turn, who: e.who, kind, sector: e.sector || '', text: e.text, at: e.at, n: e.n || 0, ok: e.ok ? 1 : 0 });
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
  return t(e.text);
}
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2600); }
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch (_) { /* noop */ } };

function selectCell(id) { T.sel = id; refreshReach(); render(); paintCells(); }
function refreshReach() { T.reach = S.phase === 'move' && !S.over && S.role && !T.editor ? reachable(T.map, S.pos, allowance(), S.role) : new Map(); }

function confirmMove() {
  if (!T.sel || !T.reach.has(T.sel)) return;
  S.pos = T.sel; S.path.push({ turn: S.turn, pos: S.pos }); T.sel = null; buzz();
  const ty = at(T.map, S.pos);
  S.phase = 'resolve'; S.res = { stage: '1234'.includes(ty) ? 'pod' : 'choose' };
  T.itemIcon = false; S.adr = false; // adrenaline lasts one move
  if (S.res.stage === 'pod' && (basic() || infection())) { actions.podGreen(); return; }
  afterChange(); focusOn(S.pos);
}
function announce(res) { S.res = Object.assign({ stage: 'done' }, res); afterChange(); }
function endTurn() {
  if (S.turn >= MAX_TURN) S.over = 'time'; else { S.turn++; S.phase = 'move'; S.res = null; }
  T.sel = null; afterChange(); if (!S.over) focusOn(S.pos);
}
function afterChange() { if (S.role === 'human' && !S.over && [1, 2, 3, 4].every(n => S.hatches[n])) S.over = 'trapped'; save(); refreshReach(); render(); paintCells(); hdr(); }

const roomUrl = () => location.origin + location.pathname + '?room=' + Sync.code;
const actions = {
  hide() { $('#cover').hidden = false; },
  unhide() { $('#cover').hidden = true; },
  zin() { const r = svg.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); },
  zout() { const r = svg.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); },
  fit, focus() { S.pos && focusOn(S.pos); },
  confirm: confirmMove,
  clearsel() { T.sel = null; afterChange(); },
  go() { const v = $('#go-input').value, p = parseId(v), id = p && cid(...p); if (id && T.reach.has(id)) { selectCell(id); focusOn(id); } else toast(v ? t('{s} is not reachable this turn', { s: v.toUpperCase() }) : t('Type a sector, e.g. L07')); },
  icon() { T.itemIcon = !T.itemIcon; render(); },
  noiseHere() { announce({ say: t('Noise in Sector {s}', { s: S.pos }), tone: 'alert', extra: iconNote(), logged: say('', 'noise', S.pos) }); },
  noiseAny() { pickSector(t('Tap the sector you announce'), id => announce({ say: t('Noise in Sector {s}', { s: id }), sub: t('You may name any sector, even a far-off one.'), tone: 'alert', extra: iconNote(), logged: say('', 'noise', id) })); },
  silence() { announce({ say: t('Silence in all Sectors'), tone: 'silent', logged: say('', 'silence') }); },
  quiet() { announce({ say: t('Nothing to announce'), tone: 'silent' }); },
  sedatives() { say('Sedatives used', 'info'); announce({ say: t('Nothing to announce'), sub: t('Sedatives: no card this turn.'), tone: 'silent' }); },
  attack() { S.res = { stage: 'attack' }; afterChange(); },
  attackDone(b) {
    const k = b.dataset.k; say('', 'attack', S.pos);
    let sub = t('Anyone in this sector must declare it and is out of the game.');
    if (k === 'human' && S.role === 'alien' && !S.fed && !infection()) { S.fed = true; sub += ' ' + t('You have FED: from now on you move 1, 2 or 3 sectors.'); }
    announce({ say: t('Attack in Sector {s}', { s: S.pos }), sub, tone: 'alert' });
  },
  podGreen() { const n = +at(T.map, S.pos); say('', 'hatch', S.pos, { n, ok: 1 }); S.hatches[n] = 1; Sync.setHatch(n, 1); S.over = 'escaped'; afterChange(); },
  podRed() { const n = +at(T.map, S.pos); S.hatches[n] = 1; Sync.setHatch(n, 1); say('', 'hatch', S.pos, { n, ok: 0 }); announce({ say: t('Escape Hatch {n}: damaged', { n }), sub: t('Reveal the red card. Nobody can enter this hatch again.'), tone: 'alert' }); },
  next: endTurn,
  backres() { S.res = { stage: 'choose' }; afterChange(); },
  item(b) { itemAction(b.dataset.i); },
  caught(b) { caughtAction(b.dataset.k); },
  tab(b) { setTab(b.dataset.tab); },
  hatch(b) { const n = b.dataset.n; S.hatches[n] = S.hatches[n] ? 0 : 1; Sync.setHatch(n, S.hatches[n]); afterChange(); },
  addann() { addDlg(); },
  clearlog() { confirmDlg(t('Clear all announcements?'), t('The history on this device will be erased.'), () => { S.log = []; afterChange(); }); },
  newgame() { confirmDlg(t('Start a new game?'), t('Your route, notes and role will be erased.'), () => { Sync.leave(); const keep = { customMaps: S.customMaps, name: S.name }; S = Object.assign(fresh(), keep); save(); boot(); }); },
  turnminus() { S.turn = Math.max(1, S.turn - 1); afterChange(); },
  turnplus() { S.turn = Math.min(MAX_TURN, S.turn + 1); afterChange(); },
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
  lang(b) { setLang(b.dataset.l); }
};
function copyText(s, msg) { (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast(msg), () => toast(s)); }
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => { if (!T.editor) setTab(b.dataset.tab); }));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const f = actions[b.dataset.act]; if (f) { e.preventDefault(); f(b); }
});

const iconNote = () => { const on = T.itemIcon && !basic(); T.itemIcon = false; return on ? t('Draw an Item card (max 3)') : null; };
function pickSector(label_, cb) { T.pick = { label: label_, cb }; S.tab = 'play'; render(); paintCells(); hdr(); }
function onCell(id) {
  if (T.editor) { paintEditor(id); return; }
  if (T.pick) { const cb = T.pick.cb; T.pick = null; paintCells(); cb(id); return; }
  if (S.role && S.phase === 'move' && !S.over && T.reach.has(id)) { selectCell(id); buzz(); return; }
  T.inspect = id; paintCells();
  const i = $('#inspect'); i.hidden = false; i.innerHTML = `<b>${'HA1234'.includes(at(T.map, id)) ? '' : id}</b>${esc(typeName(at(T.map, id)))}`;
  clearTimeout(onCell.h); onCell.h = setTimeout(() => { T.inspect = null; i.hidden = true; paintCells(); }, 3500);
}

function itemAction(k) {
  closeDlg();
  if (k === 'adrenaline') { if (S.phase !== 'move' || S.role !== 'human') return toast(t('Play Adrenaline before you move')); S.adr = true; say('Adrenaline used', 'info'); T.sel = null; afterChange(); return toast(t('You may move up to 2 sectors')); }
  if (k === 'teleport') { if (S.role !== 'human') return; S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport' }); say('Teleport used', 'info'); T.sel = null; afterChange(); focusOn(S.pos); return toast(S.phase === 'move' ? t('Teleported. Now make your normal move.') : t('Teleported to the Human sector')); }
  if (k === 'spotlight') return pickSector(t('Spotlight: tap the sector to name'), id => { say('', 'spot', id); afterChange(); toast(t('Announce: Spotlight on Sector {s}', { s: id })); });
  if (k === 'sedatives') { if (S.phase !== 'resolve' || S.res.stage !== 'choose') return toast(t('Use Sedatives instead of drawing a card')); return actions.sedatives(); }
  if (k === 'attack') { if (S.phase !== 'resolve' || S.res.stage === 'done') return toast(t('Use Attack after moving')); return actions.attack(); }
}
function caughtAction(k) {
  closeDlg();
  if (k === 'become') { S.role = 'alien'; S.fed = false; say('Eliminated, continuing as an Alien', 'info'); S.phase = 'move'; S.res = null; T.sel = null; afterChange(); toast(t('You are now an Alien, moving from where you fell')); }
  else if (k === 'dead') { S.over = 'dead'; say('Eliminated', 'info'); afterChange(); }
  else if (k === 'survive') { say('Survived an attack (Defense)', 'info'); afterChange(); }
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
function itemsDlg() {
  const it = (k, n, d) => `<button class="btn" data-act="item" data-i="${k}">${t(n)}<small>${t(d)}</small></button>`;
  dlg.innerHTML = `<h2>${t('Item played')}</h2><div class="stack">
    ${it('adrenaline', 'Adrenaline', 'Move 2 sectors this turn')}${it('sedatives', 'Sedatives', 'No Dangerous Sector card this turn')}
    ${it('teleport', 'Teleport', 'Jump to the Human sector, plus your normal move')}
    ${it('spotlight', 'Spotlight', 'Name a sector: it and its 6 neighbours must reveal')}${it('attack', 'Attack', 'Attack as an Alien would')}</div>
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
function caughtDlg() {
  const h = S.role === 'human';
  dlg.innerHTML = `<h2>${t('I was attacked')}</h2><p class="dim">${h && !basic() ? t('Play a Defense card to survive.') : t('You must declare your presence.')}</p><div class="stack">
    ${h && !basic() ? `<button class="btn ok" data-act="caught" data-k="survive">${t('I survived (Defense card)')}</button>` : ''}
    <button class="btn danger" data-act="caught" data-k="dead">${t('I was eliminated: out of the game')}</button>
    ${h && infection() ? `<button class="btn danger" data-act="caught" data-k="become">${t('Eliminated: I become an Alien (Infection)')}</button>` : ''}
  </div><div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
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
  $('#hd-turn').textContent = S.turn; $('#hd-pos').textContent = S.pos ? label(S.pos) : '—';
  const r = $('#hd-role'); r.className = 'chip ' + S.role + (S.fed ? ' fed' : ''); r.textContent = S.role === 'alien' ? (S.fed ? t('Alien') + ' · ' + t('Fed') : t('Alien')) : t('Human');
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
}
function render() {
  const p = $('#panel-body'); let h = '';
  if (T.pick) h = `<div class="banner"><span>${esc(T.pick.label)}</span><button class="btn" data-act="cancelpick">${t('Cancel')}</button></div>`;
  if (T.editor) h = editorPanel();
  else if (S.tab === 'play') h += playPanel();
  else if (S.tab === 'table') h += tablePanel();
  else h += morePanel();
  p.innerHTML = h;
  const gi = $('#go-input'); if (gi) gi.onkeydown = e => { if (e.key === 'Enter') actions.go(); };
  const rc = $('#room-code'); if (rc) rc.onkeydown = e => { if (e.key === 'Enter') actions.syncjoin(); };
}
actions.cancelpick = () => { T.pick = null; paintCells(); render(); };
const extras = () => `<div class="row mini">${basic() || S.role !== 'human' ? '' : `<button class="btn" onclick="itemsDlg()">${t('Item played')}</button>`}<button class="btn" onclick="caughtDlg()">${t('I was attacked')}</button></div>`;
window.itemsDlg = itemsDlg; window.caughtDlg = caughtDlg;
const sayBox = (txt, tone, small) => `<div class="say ${tone || ''}"><small>${t(small || 'Say aloud')}</small><b>${esc(txt)}</b></div>`;

function playPanel() {
  if (T.pick) return '';
  if (S.over) return overPanel();
  const n = allowance(), alien = S.role === 'alien';
  if (S.phase === 'move') {
    const sel = T.sel;
    const rule = alien ? t('Aliens move 1 to {n} sectors.', { n }) : (n === 1 ? t('Humans move 1 sector.') : t('Humans move up to {n} sectors.', { n }));
    return `<h2>${sel ? esc(t('Move to {s}', { s: label(sel) })) : t('Choose your destination')}</h2>
      <p class="dim">${rule} ${t('You must move.')}</p>
      ${sel ? `<p>${esc(typeName(at(T.map, sel)))}</p><div class="row"><button class="btn" data-act="clearsel">${t('Change')}</button><button class="btn primary big" data-act="confirm">${t('Confirm move')}</button></div>`
        : `<div class="inline"><input id="go-input" type="text" maxlength="3" autocapitalize="characters" placeholder="${t('or type a sector, e.g. L07')}" aria-label="${t('Destination sector')}"><button class="btn" data-act="go">${t('Go')}</button></div>`}
      ${extras()}`;
  }
  const ty = at(T.map, S.pos), r = S.res || { stage: 'choose' };
  const head = `<h2>${esc(label(S.pos))}${'.sHA'.includes(ty) ? ` <span class="dim sub">${esc(typeName(ty))}</span>` : ''}</h2>`;
  if (r.stage === 'pod') return head + `<p>${t('Declare which hatch you reached, then draw an Escape Hatch card and reveal it.')}</p><div class="row"><button class="btn ok big" data-act="podGreen">${t('Green: escaped')}</button><button class="btn danger big" data-act="podRed">${t('Red: damaged')}</button></div>`;
  if (r.stage === 'attack') return head + sayBox(t('Attack in Sector {s}', { s: S.pos }), 'alert') + `<p>${t('Anyone in the sector must declare it. Who was eliminated?')}</p>
      <div class="stack"><button class="btn" data-act="attackDone" data-k="none">${t('Nobody')}</button><button class="btn" data-act="attackDone" data-k="alien">${t('Only Alien(s)')}</button><button class="btn danger" data-act="attackDone" data-k="human">${t('At least one Human')}</button></div>
      <div class="row mini"><button class="btn" data-act="backres">${t('Back')}</button></div>`;
  if (r.stage === 'done') return head + sayBox(r.say, r.tone) + (r.extra ? sayBox(r.extra, 'alert', 'Also') : '') + (r.sub ? `<p class="dim">${esc(r.sub)}</p>` : '') +
    `<button class="btn primary big wide" data-act="next">${S.turn >= MAX_TURN ? t('Finish game') : t('End turn')}</button>${extras()}`;
  const safe = ty === 's' || ty === 'H' || ty === 'A';
  if (safe) return head + `<p>${t('Secure sector: no card to draw.')}</p>${alien ? `<button class="btn danger wide" data-act="attack">${t('Attack this sector')}</button>` : ''}
    <button class="btn primary big wide" data-act="quiet">${t('Done')}</button>${extras()}`;
  return head + `<p>${alien ? t('Attack, or draw a Dangerous Sector card:') : t('Draw a Dangerous Sector card:')}</p>
    ${alien ? `<button class="btn danger big wide" data-act="attack">${t('Attack this sector')}</button>` : ''}
    <div class="stack"><button class="btn big" data-act="noiseHere">${t('Noise in your sector')}</button><button class="btn big" data-act="noiseAny">${t('Noise in any sector')}</button><button class="btn big" data-act="silence">${t('Silence')}</button></div>
    ${basic() ? '' : `<button class="btn check" data-act="icon" aria-pressed="${!!T.itemIcon}"><i></i>${t('The card shows an Item icon')}</button>`}${extras()}`;
}
function overPanel() {
  const m = { escaped: ['Escaped!', 'You left the ship and win. That hatch is now blocked.'], time: ['39 rounds played', 'Humans still on board are eliminated: the Aliens win.'], dead: ['Out of the game', 'You were eliminated. Your Character card is revealed.'], trapped: ['No way out', 'Every Escape Hatch is blocked or damaged. You are eliminated.'] }[S.over];
  return `<h2>${t(m[0])}</h2><p>${t(m[1])}</p><button class="btn primary big wide" data-act="newgame">${t('New game')}</button>`;
}

const SYNC_MSG = { connecting: 'Connecting…', online: 'Online', offline: 'Offline, will resync', error: 'Connection error', 'bad-code': 'Enter the 4-letter code', 'no-room': 'Table not found' };
function roomBlock() {
  if (!Sync.code) return `<p class="dim">${t('You are playing without a table.')}</p>`;
  return `<div class="roomcard"><div><small>${t('Table code')}</small><b>${esc(Sync.code)}</b><span class="stat-line ${Sync.status}">${t(SYNC_MSG[Sync.status] || 'Online')}</span></div>
    <div class="row"><button class="btn primary" data-act="qr">${t('QR code')}</button><button class="btn" data-act="share">${t('Share')}</button></div></div>`;
}
function tablePanel() {
  const ln = S.log.map(e => `<li class="${e.kind}${e.mine ? ' mine' : ''}"><time>${t('T{n}', { n: e.turn })}</time><span><b>${esc(e.who)}</b> · ${esc(entryText(e))}</span></li>`).join('');
  return `<h2>${t('Table')}</h2>${roomBlock()}
    <h3>${t('Escape hatches')} <span class="hint">${t('tap to close or reopen')}</span></h3>
    <div class="hatches">${[1, 2, 3, 4].map(n => `<button data-act="hatch" data-n="${n}" aria-pressed="${!!S.hatches[n]}">${n}<small>${S.hatches[n] ? t('Closed') : t('Open')}</small></button>`).join('')}</div>
    <h3>${t('Announcements')}</h3><button class="btn wide" data-act="addann">+ ${t('Record an announcement')}</button>
    ${ln ? `<ul class="log" style="margin-top:12px">${ln}</ul>` : `<p class="dim">${t('Nothing yet. Yours are logged automatically.')}</p>`}`;
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
    <details class="acc"><summary>${t('Game')}</summary><div class="inline"><button class="btn" data-act="turnminus" aria-label="−">−</button><div class="btn static">${t('Turn {n} of {m}', { n: S.turn, m: MAX_TURN })}</div><button class="btn" data-act="turnplus" aria-label="+">+</button></div>
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
