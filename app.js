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
  room: null, mapId: null, mode: 'advanced', role: null, name: '', turn: 1, pos: null, fed: false, adr: false,
  phase: 'move', res: null, over: null, path: [], log: [],
  hatches: { 1: 0, 2: 0, 3: 0, 4: 0 }, tab: 'play', customMaps: []
});
let S = fresh();
try { Object.assign(S, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* ignore */ }
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
const label = id => { const t = at(T.map, id); return t === 'H' ? 'Human start' : t === 'A' ? 'Alien start' : '1234'.includes(t) ? 'Hatch ' + t : id; };
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
const typeName = t => ({ '.': 'Dangerous sector', s: 'Safe sector', x: 'Empty space', H: 'Human start', A: 'Alien start' }[t] || 'Escape Hatch ' + t);

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
    const txt = t === 'H' ? 'HUMAN' : t === 'A' ? 'ALIEN' : '1234'.includes(t) ? t : '';
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
function say(text, kind, sector, extra = {}) {
  const e = Object.assign({ id: Math.random().toString(36).slice(2, 8) + Date.now().toString(36), turn: S.turn, who: S.name || 'Me', kind, sector: sector || null, text, mine: true, at: Date.now() }, extra);
  S.log.unshift(e);
  if (window.Sync && Sync.code && ['noise', 'attack', 'spot', 'silence', 'hatch'].includes(kind)) Sync.push({ id: e.id, turn: e.turn, who: e.who, kind, sector: e.sector || '', text: e.text, at: e.at });
  if (S.log.length > 400) S.log.length = 400;
}
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2600); }
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch (_) { /* noop */ } };

function startGame(role) {
  const id = $('#setup-map').value; T.map = T.maps.find(m => m.id === id) || T.maps[0];
  const keep = S.customMaps, name = $('#setup-name').value.trim(), mode = $('#setup-mode').value;
  S = Object.assign(fresh(), { mapId: T.map.id, role, name, mode, customMaps: keep });
  S.pos = find(T.map, role === 'human' ? 'H' : 'A');
  if (!S.pos) { alert('This map has no ' + (role === 'human' ? 'Human' : 'Alien') + ' start sector.'); S.role = null; return; }
  S.path = [{ turn: 0, pos: S.pos }];
  save(); boot();
}
function selectCell(id) {
  T.sel = id; refreshReach(); render(); paintCells();
}
function refreshReach() { T.reach = S.phase === 'move' && !S.over && S.role && !T.editor ? reachable(T.map, S.pos, allowance(), S.role) : new Map(); }

function confirmMove() {
  if (!T.sel || !T.reach.has(T.sel)) return;
  S.pos = T.sel; S.path.push({ turn: S.turn, pos: S.pos }); T.sel = null; buzz();
  const t = at(T.map, S.pos);
  S.phase = 'resolve'; S.res = { stage: '1234'.includes(t) ? 'pod' : 'choose', msg: null, tone: null };
  T.itemIcon = false;
  if (S.res.stage === 'pod' && (basic() || infection())) { actions.podGreen(); return; }
  S.adr = false; // adrenaline lasts one move
  afterChange(); focusOn(S.pos);
}
function announce(res) { S.res = Object.assign({ stage: 'done' }, res); afterChange(); }
function endTurn() {
  if (S.turn >= MAX_TURN) { S.over = 'time'; } else { S.turn++; S.phase = 'move'; S.res = null; }
  T.sel = null; afterChange(); if (!S.over) focusOn(S.pos);
}
function afterChange() { if (S.role === 'human' && !S.over && [1, 2, 3, 4].every(n => S.hatches[n])) S.over = 'trapped'; save(); refreshReach(); render(); paintCells(); hdr(); }

const actions = {
  start: b => startGame(b.dataset.role),
  hide() { $('#cover').hidden = false; },
  unhide() { $('#cover').hidden = true; },
  zin() { const r = svg.getBoundingClientRect(); zoomAt(1.4, r.width / 2, r.height / 2); },
  zout() { const r = svg.getBoundingClientRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); },
  fit, focus() { S.pos && focusOn(S.pos); },
  confirm: confirmMove,
  clearsel() { T.sel = null; afterChange(); },
  go() { const v = $('#go-input').value, id = parseId(v) && cid(...parseId(v)); if (id && T.reach.has(id)) { selectCell(id); focusOn(id); } else toast(v ? `${v.toUpperCase()} is not reachable this turn` : 'Type a sector, e.g. L07'); },
  icon(b) { T.itemIcon = !T.itemIcon; render(); },
  noiseHere() { announce({ say: 'Noise in Sector ' + S.pos, sub: 'Say it aloud.', tone: 'alert', extra: iconNote(), logged: say('Noise in my sector ' + S.pos, 'noise', S.pos) }); },
  noiseAny() { pickSector('Where is the noise? Tap the sector you announce.', id => { announce({ say: 'Noise in Sector ' + id, sub: 'Say it aloud. You may name any sector, even a far-off one.', tone: 'alert', extra: iconNote(), logged: say('Noise in sector ' + id, 'noise', id) }); }); },
  silence() { announce({ say: 'Silence in all Sectors', sub: 'Say it aloud.', tone: 'silent', logged: say('Silence in all sectors', 'silence') }); },
  quiet() { announce({ say: 'No announcement', sub: S.res && S.res.why || 'Say nothing.', tone: 'silent', logged: say('No announcement', 'info') }); },
  sedatives() { announce({ say: 'No card, no announcement', sub: 'Sedatives: you skip the card draw.', tone: 'silent', logged: say('Sedatives used', 'info') }); },
  attack() { S.res = { stage: 'attack', attackItem: S.role === 'human' }; afterChange(); },
  attackDone(b) {
    const k = b.dataset.k, txt = { none: 'nobody there', alien: 'only Aliens eliminated', human: 'Human eliminated' }[k];
    say('I attack in sector ' + S.pos + ' — ' + txt, 'attack', S.pos);
    let sub = 'Anyone in this sector must declare it and is out of the game.';
    if (k === 'human' && S.role === 'alien' && !S.fed && !infection()) { S.fed = true; sub += ' You have FED: from now on you move 1, 2 or 3 sectors.'; }
    announce({ say: 'I attack in sector ' + S.pos, sub, tone: 'alert' });
  },
  podGreen() { const n = at(T.map, S.pos); say(`Escape Hatch ${n} — escaped!`, 'hatch', S.pos); S.hatches[n] = 1; Sync.setHatch(n, 1); S.over = 'escaped'; afterChange(); },
  podRed() { const n = at(T.map, S.pos); S.hatches[n] = 1; Sync.setHatch(n, 1); say(`Escape Hatch ${n} — damaged`, 'hatch', S.pos); announce({ say: `Escape Hatch ${n} is damaged`, sub: 'Reveal the red card. No one may enter this hatch again. Head for another one.', tone: 'alert' }); },
  next: endTurn,
  backres() { S.res = { stage: 'choose' }; afterChange(); },
  item(b) { itemAction(b.dataset.i); },
  caught(b) { caughtAction(b.dataset.k); },
  tab(b) { setTab(b.dataset.tab); },
  hatch(b) { const n = b.dataset.n; S.hatches[n] = S.hatches[n] ? 0 : 1; Sync.setHatch(n, S.hatches[n]); afterChange(); },
  addNote() { addNote(); },
  notetype(b) { T.noteType = b.dataset.k; render(); },
  clearlog() { confirmDlg('Clear all notes?', 'Your announcement history will be erased.', () => { S.log = []; afterChange(); }); },
  newgame() { confirmDlg('Start a new game?', 'Your route, notes and role will be erased.', () => { Sync.leave(); S = Object.assign(fresh(), { customMaps: S.customMaps }); save(); boot(); }); },
  turnminus() { S.turn = Math.max(1, S.turn - 1); afterChange(); },
  turnplus() { S.turn = Math.min(MAX_TURN, S.turn + 1); afterChange(); },
  map(b) { const m = T.maps.find(x => x.id === b.dataset.id); if (!m) return; confirmDlg('Switch map?', 'Your position resets to the start sector of the new map.', () => { T.map = m; S.mapId = m.id; S.pos = find(m, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; T.sel = null; S.phase = 'move'; S.res = null; buildMap(); afterChange(); }); },
  edit() { startEditor(); },
  tool(b) { T.editor.tool = b.dataset.t; render(); },
  esave() { saveEditor(); },
  ecancel() { T.map = T.editor.orig; T.editor = null; setTab('menu'); buildMap(); afterChange(); },
  eexport() { exportMap(); },
  eimport() { importDlg(); },
  edel(b) { S.customMaps = S.customMaps.filter(m => m.id !== b.dataset.id); loadMaps().then(() => { if (!T.maps.includes(T.map)) { T.map = T.maps.find(m => m.id === T.map.id) || T.maps[0]; S.mapId = T.map.id; } afterChange(); }); },
  syncnew() { Sync.join(Sync.newCode(), true); },
  syncjoin() { Sync.join($('#room-code').value, false); },
  syncleave() { Sync.leave(); S.room = null; save(); render(); },
  copycode() { navigator.clipboard && navigator.clipboard.writeText(Sync.code).then(() => toast('Room code copied')); },
  cancelpick() { T.pick = null; paintCells(); render(); }
};
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => { if (!T.editor) setTab(b.dataset.tab); }));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const f = actions[b.dataset.act]; if (f) { e.preventDefault(); f(b); }
});

const iconNote = () => { const on = T.itemIcon && !basic(); T.itemIcon = false; return on ? 'Draw an Item card (hold max 3)' : null; };
function pickSector(label, cb) { T.pick = { label, cb }; S.tab = 'play'; render(); paintCells(); hdr(); }
function onCell(id) {
  if (T.editor) { paintEditor(id); return; }
  if (T.pick) { const cb = T.pick.cb; T.pick = null; paintCells(); cb(id); return; }
  if (S.role && S.phase === 'move' && !S.over && T.reach.has(id)) { selectCell(id); buzz(); return; }
  T.inspect = id; paintCells();
  const i = $('#inspect'); i.hidden = false; i.innerHTML = `<b>${id}</b>${typeName(at(T.map, id))}`;
  clearTimeout(onCell.h); onCell.h = setTimeout(() => { T.inspect = null; i.hidden = true; paintCells(); }, 3500);
}

function itemAction(k) {
  closeDlg();
  if (k === 'adrenaline') { if (S.phase !== 'move' || S.role !== 'human') return toast('Play Adrenaline before you move'); S.adr = true; say('Adrenaline used', 'info'); T.sel = null; afterChange(); return toast('You may move up to 2 sectors'); }
  if (k === 'teleport') { if (S.role !== 'human') return; S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport' }); say('Teleport used', 'info'); T.sel = null; afterChange(); focusOn(S.pos); return toast(S.phase === 'move' ? 'Teleported. Now make your normal move from the Human sector' : 'Teleported to the Human sector'); }
  if (k === 'spotlight') return pickSector('Spotlight: tap the sector to name.', id => { say('Spotlight on ' + id, 'spot', id); afterChange(); toast('Announce: Spotlight on Sector ' + id); });
  if (k === 'sedatives') { if (S.phase !== 'resolve' || S.res.stage !== 'choose') return toast('Use Sedatives in place of drawing a card'); return actions.sedatives(); }
  if (k === 'attack') { if (S.phase !== 'resolve' || S.res.stage === 'done') return toast('Use Attack after moving'); return actions.attack(); }
}
function caughtAction(k) {
  closeDlg();
  if (k === 'become') { S.role = 'alien'; S.fed = false; say('Eliminated — continuing as an Alien (Infection)', 'info'); S.phase = 'move'; S.res = null; T.sel = null; afterChange(); toast('You are now an Alien, moving from where you fell'); }
  else if (k === 'dead') { S.over = 'dead'; say('Eliminated', 'info'); afterChange(); }
  else if (k === 'survive') { say('Survived an attack (Defense)', 'info'); afterChange(); }
}

/* ---------------- notes ---------------- */
const NOTE_TYPES = { noise: ['Noise', true], attack: ['Attack', true], spot: ['Spotlight', true], silence: ['Silence', false], hatch: ['Pod result', true], info: ['Other', false] };
function addNote() {
  const who = ($('#note-who') || {}).value || ''; T.noteWho = who;
  const k = T.noteType, [label, needsSector] = NOTE_TYPES[k], finish = sec => {
    const d = k === 'noise' ? 'Noise in ' + sec : k === 'attack' ? 'Attack in ' + sec : k === 'spot' ? 'Spotlight on ' + sec : k === 'hatch' ? 'Pod at ' + sec : label;
    const text = (needsSector ? d : k === 'silence' ? 'Silence in all sectors' : ($('#note-text') && $('#note-text').value || 'Note'));
    S.log.unshift({ turn: S.turn, who: who || 'Someone', kind: k, sector: sec || null, text, mine: false, at: Date.now() });
    afterChange(); setTab('notes');
    if (k === 'spot' && S.pos && !S.over) { const q = parseId(sec); const near = q && (sec === S.pos || neighbors(T.map, q[0], q[1]).some(([a, b]) => cid(a, b) === S.pos)); if (near) alertDlg('Spotlight!', `You are in range. Announce your exact location now: ${label(S.pos)}.`); }
  };
  if (needsSector) pickSector(`${label}: tap the sector announced by ${who || 'the player'}.`, finish); else finish(null);
}

/* ---------------- dialogs ---------------- */
const dlg = $('#dlg');
const closeDlg = () => { if (dlg.open) dlg.close(); };
function confirmDlg(title, body, ok) {
  dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="row"><button class="btn" id="d-no">Cancel</button><button class="btn danger" id="d-yes">Confirm</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg; $('#d-yes').onclick = () => { closeDlg(); ok(); };
}
function alertDlg(title, body) { dlg.innerHTML = `<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="row"><button class="btn primary" id="d-no">OK</button></div>`; dlg.showModal(); $('#d-no').onclick = closeDlg; }
function itemsDlg() {
  const it = (k, n, d) => `<button class="btn" data-act="item" data-i="${k}">${n}<small>${d}</small></button>`;
  dlg.innerHTML = `<h2>Item played</h2><p class="dim">Tell the app which item card you played. The card text in your rulebook is authoritative.</p><div class="stack">
    ${it('adrenaline', 'Adrenaline', 'Move 2 sectors this turn')}${it('sedatives', 'Sedatives', 'No Dangerous Sector card this turn')}
    ${it('teleport', 'Teleport', 'Jump to the Human sector, plus your normal move')}
    ${it('spotlight', 'Spotlight', 'Name a sector: it and its 6 neighbours must reveal')}${it('attack', 'Attack', 'Attack as an Alien would')}</div>
    <div class="row"><button class="btn" id="d-no">Close</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
function caughtDlg() {
  const h = S.role === 'human';
  dlg.innerHTML = `<h2>I was attacked</h2><p class="dim">${h && !basic() ? 'Play a Defense card to survive.' : 'You must declare your presence.'}</p><div class="stack">
    ${h && !basic() ? `<button class="btn ok" data-act="caught" data-k="survive">I survived (Defense card)</button>` : ''}
    <button class="btn danger" data-act="caught" data-k="dead">I was eliminated — out of the game</button>
    ${h && infection() ? `<button class="btn danger" data-act="caught" data-k="become">Eliminated — I become an Alien (Infection)</button>` : ''}
  </div><div class="row"><button class="btn" id="d-no">Close</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
function importDlg() {
  dlg.innerHTML = `<h2>Import map</h2><p class="dim">Paste map JSON (see README) or choose a file.</p>
    <textarea id="imp" spellcheck="false" aria-label="Map JSON"></textarea><input id="imp-file" type="file" accept=".json,application/json" style="margin-top:10px">
    <p id="imp-err" style="color:#ff9d8a"></p><div class="row"><button class="btn" id="d-no">Cancel</button><button class="btn primary" id="d-yes">Import</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  $('#imp-file').onchange = async e => { const f = e.target.files[0]; if (f) $('#imp').value = await f.text(); };
  $('#d-yes').onclick = () => {
    try {
      const j = JSON.parse($('#imp').value), list = (j.maps || [j]).map(m => { const p = parseMap(m); return { id: m.id || 'custom-' + Date.now(), name: p.name, rows_data: m.rows_data, oddColumnsLower: p.odd }; });
      list.forEach(m => { S.customMaps = S.customMaps.filter(x => x.id !== m.id).concat(m); });
      loadMaps().then(() => { fillMapSelect(); afterChange(); closeDlg(); toast('Map imported'); });
    } catch (e) { $('#imp-err').textContent = 'Could not import: ' + e.message; }
  };
}

/* ---------------- editor ---------------- */
function startEditor() {
  const m = T.map; T.editor = { tool: '.', name: m.name.replace(' (unofficial)', '') + ' (copy)', odd: m.odd, grid: m.grid.map(r => r.slice()), orig: m };
  T.sel = null; T.pick = null; T.reach = new Map(); setTab('play');
  T.map = Object.assign({}, m, { grid: T.editor.grid }); buildMap(); render();
}
function paintEditor(id) {
  const [c, r] = parseId(id), t = T.editor.tool, g = T.editor.grid;
  if ('HA1234'.includes(t)) for (const row of g) for (let i = 0; i < row.length; i++) if (row[i] === t) row[i] = '.';
  g[r][c] = t; paintCells();
}
function saveEditor() {
  const g = T.editor.grid, name = ($('#ed-name').value || 'Custom map').trim();
  const miss = ['H', 'A'].filter(ch => !g.some(r => r.includes(ch))).map(ch => ch === 'H' ? 'Human start' : 'Alien start');
  if (miss.length) return toast('Place: ' + miss.join(', '));
  const id = 'custom-' + Date.now();
  S.customMaps.push({ id, name, rows_data: g.map(r => r.join('')), oddColumnsLower: T.editor.odd });
  T.editor = null; loadMaps().then(() => { T.map = T.maps.find(m => m.id === id); S.mapId = id; if (S.role) { S.pos = find(T.map, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; S.phase = 'move'; S.res = null; } buildMap(); afterChange(); setTab('menu'); toast('Map saved'); });
}
function exportMap() {
  const m = T.map, json = JSON.stringify({ id: m.id, name: m.name, oddColumnsLower: m.odd, rows_data: m.grid.map(r => r.join('')) }, null, 1);
  dlg.innerHTML = `<h2>Export map</h2><p class="dim">Copy this JSON or save it as a file.</p><textarea readonly id="exp">${esc(json)}</textarea>
    <div class="row"><button class="btn" id="d-no">Close</button><button class="btn primary" id="d-copy">Copy</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  $('#d-copy').onclick = async () => { try { await navigator.clipboard.writeText(json); toast('Copied'); } catch (_) { $('#exp').select(); toast('Press Ctrl/Cmd+C'); } };
}

/* ---------------- panel rendering ---------------- */
function setTab(t) { S.tab = t; T.pick = null; save(); render(); paintCells(); document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab)); }
function hdr() {
  $('#hd-turn').textContent = S.turn; $('#hd-pos').textContent = S.pos ? label(S.pos) : '—';
  const r = $('#hd-role'); r.className = 'chip ' + S.role + (S.fed ? ' fed' : ''); r.textContent = S.role === 'alien' ? (S.fed ? 'Alien · Fed' : 'Alien') : 'Human';
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab));
}
function render() {
  const p = $('#panel-body'); let h = '';
  if (T.pick) h = `<div class="banner"><span>${esc(T.pick.label)}</span><button class="btn" data-act="cancelpick">Cancel</button></div>`;
  if (T.editor) h = editorPanel();
  else if (S.tab === 'play') h += playPanel();
  else if (S.tab === 'notes') h += notesPanel();
  else if (S.tab === 'rules') h += rulesPanel();
  else h += menuPanel();
  p.innerHTML = h;
  const gi = $('#go-input'); if (gi) gi.onkeydown = e => { if (e.key === 'Enter') actions.go(); };
}
const itemsBtn = () => `<div class="row" style="margin-top:14px">${basic() || S.role !== 'human' ? '' : '<button class="btn" onclick="itemsDlg()">Item played…</button>'}<button class="btn" onclick="caughtDlg()">I was attacked…</button></div>`;
window.itemsDlg = itemsDlg; window.caughtDlg = caughtDlg;

function playPanel() {
  if (T.pick) return '';
  if (S.over) return overPanel();
  const n = allowance(), who = S.role === 'alien';
  if (S.phase === 'move') {
    const sel = T.sel;
    return `<p class="step">Turn ${S.turn} · Step 1 of 2 · Move</p>
      <h2>${sel ? 'Move to ' + sel : 'Choose your destination'}</h2>
      <p>${who ? `Aliens move 1 to <b>${n}</b> sectors${S.fed ? ' (fed)' : ''}.` : `Humans move <b>${n === 1 ? 'only 1 sector' : 'up to ' + n + ' sectors'}</b>${S.adr ? ' (Adrenaline)' : ''}.`} You must move and cannot end where you started.</p>
      ${sel ? `<div class="kv" style="margin-bottom:12px"><dt>Sector</dt><dd>${typeName(at(T.map, sel))}</dd><dt>Distance</dt><dd>${T.reach.get(sel)} step${T.reach.get(sel) > 1 ? 's' : ''}</dd></div>
        <div class="row"><button class="btn" data-act="clearsel">Change</button><button class="btn primary big" data-act="confirm">Confirm move</button></div>`
      : `<div class="inline"><input id="go-input" type="text" inputmode="text" maxlength="3" autocapitalize="characters" placeholder="or type sector, e.g. L07" aria-label="Destination sector"><button class="btn" data-act="go">Go</button></div>`}
      ${itemsBtn()}`;
  }
  const t = at(T.map, S.pos), r = S.res || { stage: 'choose' };
  const head = `<p class="step">Turn ${S.turn} · Step 2 of 2 · ${r.stage === 'done' ? 'Done' : 'Your sector'}</p><h2>${esc(label(S.pos))} <span class="dim" style="font-size:16px">${'.sHA'.includes(t) ? '· ' + typeName(t) : ''}</span></h2>`;
  if (r.stage === 'pod') return head + `<p>You reached <b>Escape Hatch ${t}</b>. Declare which hatch it is, then draw an <b>Escape Hatch</b> card from the physical deck and reveal it.</p><div class="row"><button class="btn ok big" data-act="podGreen">Green — escaped</button><button class="btn danger big" data-act="podRed">Red — damaged</button></div>`;
  if (r.stage === 'attack') return head + `<div class="say alert"><small>Say aloud</small><b>I attack in Sector ${esc(S.pos)}</b></div>
      <p>Anyone in the sector must declare it. Who was eliminated?</p>
      <div class="stack"><button class="btn" data-act="attackDone" data-k="none">Nobody</button><button class="btn" data-act="attackDone" data-k="alien">Only Alien(s)</button><button class="btn danger" data-act="attackDone" data-k="human">At least one Human</button></div>
      <div class="row" style="margin-top:12px"><button class="btn" data-act="backres">Back</button></div>`;
  if (r.stage === 'done') return head + `<div class="say ${r.tone || ''}"><small>Say aloud</small><b>${esc(r.say)}</b></div>${r.extra ? `<div class="say alert"><small>Also say</small><b>${esc(r.extra)}</b></div>` : ''}<p class="dim">${esc(r.sub || '')}</p><button class="btn primary big" style="width:100%" data-act="next">${S.turn >= MAX_TURN ? 'Finish game' : 'End turn ' + S.turn}</button>${itemsBtn()}`;
  // choose
  const safe = t === 's', start = t === 'H' || t === 'A';
  if (safe || start) return head + `<p>${safe ? 'Secure Sector: no card, your turn is over.' : 'Nothing to draw here.'}${who ? '' : ''}</p>
    ${who ? `<button class="btn danger" style="width:100%;margin-bottom:10px" data-act="attack">Attack this sector</button>` : ''}
    <button class="btn primary big" style="width:100%" data-act="quiet">Done — announce nothing</button>${itemsBtn()}`;
  return head + `<p>${who ? 'Attack, or draw' : 'Draw'} a <b>Dangerous Sector</b> card and pick what it says.</p>
    ${basic() ? '' : `<button class="btn" style="width:100%;margin-bottom:12px" data-act="icon" aria-pressed="${!!T.itemIcon}">${T.itemIcon ? '☑' : '☐'} Card shows an Item icon</button>`}
    ${who ? `<button class="btn danger big" style="width:100%;margin-bottom:12px" data-act="attack">Attack this sector<small>Instead of drawing</small></button>` : ''}
    <div class="stack"><button class="btn big" data-act="noiseHere">Noise in your sector</button><button class="btn big" data-act="noiseAny">Noise in any sector</button><button class="btn big" data-act="silence">Silence in all sectors</button></div>${itemsBtn()}`;
}
function overPanel() {
  const m = { escaped: ['Escaped!', 'You left the ship and win. That hatch is now blocked.', 'ok'], time: ['39 rounds played', 'Humans still on board are eliminated: the Aliens win.', ''], dead: ['Out of the game', 'You were eliminated. Your Character card is revealed.', ''], trapped: ['No way out', 'Every Escape Hatch is blocked or damaged. You are eliminated.', ''] }[S.over];
  return `<p class="step">Game over</p><h2>${m[0]}</h2><p>${m[1]}</p><button class="btn primary big" style="width:100%" data-act="newgame">New game</button>`;
}
const SYNC_MSG = { connecting: 'Connecting…', online: 'Online', offline: 'Offline, will resync', error: 'Connection error', 'bad-code': 'Enter a 4+ character code', 'no-room': 'Room not found', off: '' };
function syncBlock() {
  if (!Sync.enabled) return `<h3>Table sync</h3><p class="dim" style="font-size:13px">Not configured. Add your Firebase config in <code>firebase-config.js</code> to share announcements between devices.</p>`;
  if (Sync.code) return `<h3>Table sync</h3><div class="say silent" style="margin:0 0 8px"><small>Room · ${esc(SYNC_MSG[Sync.status] || '')}</small><b style="letter-spacing:.3em">${esc(Sync.code)}</b></div>
    <div class="row"><button class="btn" data-act="copycode">Copy code</button><button class="btn" data-act="syncleave">Leave</button></div><p class="dim" style="font-size:13px">Only announcements and hatch status are shared. Your position stays private.</p>`;
  return `<h3>Table sync</h3><div class="stack"><button class="btn" data-act="syncnew">Create room</button>
    <div class="inline"><input id="room-code" type="text" maxlength="8" autocapitalize="characters" placeholder="Room code" aria-label="Room code"><button class="btn" data-act="syncjoin">Join</button></div>
    <p class="dim" style="font-size:13px;margin:0">${esc(SYNC_MSG[Sync.status] || 'Share a room code so everyone sees announcements automatically.')}</p></div>`;
}
function notesPanel() {
  const t = T.noteType, ln = S.log.map(e => `<li class="${e.kind}${e.mine ? ' mine' : ''}"><time>T${e.turn}</time><span><b>${esc(e.who)}</b> · ${esc(e.text)}</span></li>`).join('');
  return `<p class="step">Shared table</p><h2>Notes</h2>${syncBlock()}
    <h3>Round</h3><div class="inline"><button class="btn" data-act="turnminus" aria-label="Previous turn">−</button><div class="btn" style="flex:1;cursor:default">Turn ${S.turn} of ${MAX_TURN}</div><button class="btn" data-act="turnplus" aria-label="Next turn">+</button></div>
    <h3>Escape hatches <span class="dim" style="text-transform:none;font-size:12px;letter-spacing:0">tap to close / reopen</span></h3>
    <div class="hatches">${[1, 2, 3, 4].map(n => `<button data-act="hatch" data-n="${n}" aria-pressed="${!!S.hatches[n]}">${n}<small>${S.hatches[n] ? 'Closed' : 'Open'}</small></button>`).join('')}</div>
    <h3>Record what you heard</h3>
    <div class="chips" role="group" aria-label="Announcement type">${Object.entries(NOTE_TYPES).map(([k, v]) => `<button data-act="notetype" data-k="${k}" aria-pressed="${k === t}">${v[0]}</button>`).join('')}</div>
    <div class="stack" style="margin-top:10px"><input id="note-who" type="text" maxlength="20" placeholder="Player name" value="${esc(T.noteWho)}" aria-label="Player name">
    ${t === 'info' ? '<input id="note-text" type="text" maxlength="80" placeholder="Note" aria-label="Note">' : ''}
    <button class="btn primary" data-act="addNote">${NOTE_TYPES[t][1] ? 'Pick sector on map' : 'Add note'}</button></div>
    <h3>History</h3>${ln ? `<ul class="log">${ln}</ul><button class="btn" style="width:100%;margin-top:12px" data-act="clearlog">Clear notes</button>` : '<p class="dim">Nothing yet. Your announcements are logged automatically.</p>'}`;
}
function rulesPanel() {
  return `<div class="rules"><p class="step">Quick reference</p><h2>How to play</h2>
  <p class="dim">A summary of the official rulebook to speed up play. The rulebook is authoritative.</p>
  <h3>Goal</h3><ul><li><b>Humans</b> reach an Escape Hatch. <b>Aliens</b> hunt every Human down.</li>
  <li><b>Basic game:</b> it ends when the first Human reaches a hatch. Aliens win if all Humans die or 39 rounds pass.</li>
  <li><b>Advanced game:</b> adds Items and Escape Hatch cards. Play continues until every Human has escaped or been eliminated. Humans still aboard after 39 rounds are eliminated.</li></ul>
  <h3>Your turn</h3><ul><li><b>Move</b> (mandatory, never ending where you started). Humans 1 sector. Aliens 1–2 sectors, or 1–3 after feeding.</li>
  <li><b>Secure sector:</b> your turn is over.</li>
  <li><b>Dangerous sector:</b> draw a card: <i>Noise in your sector</i>, <i>Noise in any sector</i> or <i>Silence</i>.</li>
  <li><b>Alien attack:</b> after moving, say “I attack in Sector X” instead of drawing. Anyone there (Human or Alien) is eliminated and reveals their card. Humans cannot attack without an Attack item.</li></ul>
  <h3>Sectors</h3><div class="legend">
  <div><i style="background:var(--hex)"></i>Dangerous: draw a card</div><div><i style="background:var(--hex-safe)"></i>Secure: nothing happens</div>
  <div><i style="background:#1c5d93"></i>Human sector: nobody may enter or cross it</div><div><i style="background:#a53312"></i>Alien sector: nobody may enter or cross it</div>
  <div><i style="background:#1e8a4f"></i>Escape Hatch: Humans only</div></div>
  <h3>Escape Hatches (Advanced)</h3><ul><li>Declare which hatch you reached, draw an Escape Hatch card and reveal it.</li><li><b>Red:</b> hatch damaged, closed for everyone. <b>Green:</b> you escaped; the hatch is blocked.</li><li>If every hatch is closed you are eliminated.</li></ul>
  <h3>Items (Advanced)</h3><ul><li>A Noise card with an Item icon makes you draw an Item card (Aliens too). Max 3 held. Only Humans can use them.</li>
  <li><b>Attack</b> as an Alien would. <b>Teleport</b> to the Human sector, plus your normal move. <b>Sedatives</b> no card this turn. <b>Spotlight</b> name a sector: it and its 6 neighbours must announce exact coordinates. <b>Defense</b> survive an attack. <b>Adrenaline</b> move 2 sectors.</li></ul>
  <h3>Infection scenario</h3><ul><li>Eliminated Humans become Aliens where they fell. All hatches start open and each works once. Aliens do not speed up after feeding.</li></ul>
  <h3>Using this app</h3><ul><li>Everything stays on this device. Tap <b>Hide</b> (top right) when you put it down.</li><li>Hatches, the Human and Alien sectors have no coordinates, as in the printed maps.</li></ul></div>`;
}
function menuPanel() {
  const maps = T.maps.map(m => `<div class="inline" style="margin-bottom:8px"><button class="btn" style="flex:1;text-align:left;${m.id === T.map.id ? 'border-color:var(--amber)' : ''}" data-act="map" data-id="${esc(m.id)}">${esc(m.name)}${m.description ? '<small>' + esc(m.description) + '</small>' : ''}</button>${(S.customMaps || []).some(c => c.id === m.id) ? `<button class="btn danger" data-act="edel" data-id="${esc(m.id)}" aria-label="Delete ${esc(m.name)}">✕</button>` : ''}</div>`).join('');
  return `<p class="step">Settings</p><h2>Menu</h2>
    <h3>Maps</h3>${maps}
    <div class="row"><button class="btn" data-act="edit">Edit this map</button><button class="btn" data-act="eexport">Export</button><button class="btn" data-act="eimport">Import</button></div>
    <p class="dim" style="font-size:13px;margin-top:10px">Galilei, Fermi and Galvani come from the Black Edition maps. Add your own via the editor or import.</p>
    <h3>Game</h3><div class="stack"><button class="btn" data-act="hide">Hide screen</button><button class="btn danger" data-act="newgame">New game</button></div>
    <h3>About</h3><p class="dim" style="font-size:13px">Unofficial fan companion for <i>Escape from the Aliens in Outer Space</i> by Mario Porpora. Requires the physical game; no cards are included.</p>`;
}
function editorPanel() {
  const tl = [['.', 'Dangerous', '#59627a'], ['s', 'Safe', '#ece6d3'], ['x', 'Empty', '#0b1222'], ['H', 'Human', '#1c5d93'], ['A', 'Alien', '#a53312'], ['1', 'Pod 1', '#1e8a4f'], ['2', 'Pod 2', '#1e8a4f'], ['3', 'Pod 3', '#1e8a4f'], ['4', 'Pod 4', '#1e8a4f']];
  return `<p class="step">Map editor</p><h2>Edit map</h2><p>Pick a tool, then tap sectors. Start sectors and pods are unique.</p>
    <div class="tools" role="group" aria-label="Tools">${tl.map(([k, n, c]) => `<button data-act="tool" data-t="${k}" aria-pressed="${T.editor.tool === k}"><i style="background:${c};outline:1px solid #fff3"></i>${n}</button>`).join('')}</div>
    <label class="field" style="margin-top:14px"><span>Map name</span><input id="ed-name" type="text" maxlength="40" value="${esc(T.editor.name)}"></label>
    <div class="row"><button class="btn" data-act="ecancel">Cancel</button><button class="btn primary" data-act="esave">Save map</button></div>`;
}

/* ---------------- boot ---------------- */
function fillMapSelect() { $('#setup-map').innerHTML = T.maps.map(m => `<option value="${esc(m.id)}">${esc(m.name)}</option>`).join(''); }
function boot() {
  T.editor = null; T.pick = null; T.sel = null;
  const setup = !S.role;
  $('#setup').hidden = !setup; $('#app').hidden = setup;
  if (setup) { fillMapSelect(); return; }
  T.map = T.maps.find(m => m.id === S.mapId) || T.maps[0]; S.mapId = T.map.id;
  if (!S.pos || !parseId(S.pos)) { S.pos = find(T.map, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; }
  fitDone = false; buildMap(); refreshReach(); render(); paintCells(); hdr();
  requestAnimationFrame(() => { fit(); fitDone = true; if (S.pos) focusOn(S.pos); });
}
Sync.on({
  status() { if (S.tab === 'notes' && !T.editor) render(); },
  joined(code) { S.room = code; save(); if (S.tab === 'notes') render(); },
  entry(e) {
    if (!e || !e.id || S.log.some(x => x.id === e.id)) return;
    S.log.push({ id: e.id, turn: e.turn, who: e.who, kind: e.kind, sector: e.sector || null, text: e.text, mine: false, at: e.at, remote: true });
    S.log.sort((a, b) => b.at - a.at); save(); if (S.role) { paintOverlay(); if (S.tab === 'notes') render(); }
  },
  hatches(h) { for (const n of [1, 2, 3, 4]) if (h[n] !== undefined) S.hatches[n] = h[n] ? 1 : 0; if (S.role) { afterChange(); } }
});
loadMaps().then(() => { boot(); if (S.room && S.role) Sync.join(S.room, false); });
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });
