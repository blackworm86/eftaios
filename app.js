'use strict';
/* EFTAIOS Companion — tracks a player's secret route for the physical board game.
   No cards, no hidden-information resolution: the app only records what the player tells it. */

const MAX_TURN = 40;
const SVGNS = 'http://www.w3.org/2000/svg';
const HEX = 20; // hex radius in map units
const STORE = 'eftaios.v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* one icon family: 24px grid, 2px round strokes */
const ICONS = { friends: 'M9 6a3 3 0 100 6 3 3 0 000-6zM3 20c0-4 3-6 6-6s6 2 6 6M16 6a3 3 0 010 6M18 14c2 1 3 3 3 6', stack: 'M4 7l8-4 8 4-8 4zM4 12l8 4 8-4M4 17l8 4 8-4', book: 'M5 4h9a4 4 0 014 4v12H9a4 4 0 01-4-4zM9 8h5', bolt: 'M13 2L4 14h7l-1 8 9-12h-7z', plus: 'M12 5v14M5 12h14', swap: 'M4 8h13l-3-3M20 16H7l3 3', sheet: 'M5 3h10l4 4v14H5zM9 11h6M9 15h4', chart: 'M5 20V10M12 20V4M19 20v-7', map: 'M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14', globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18', user: 'M12 4a4 4 0 100 8 4 4 0 000-8zM4 21c0-5 4-7 8-7s8 2 8 7', play: 'M7 4l12 8-12 8z', qr: 'M4 9V6a2 2 0 012-2h3M20 9V6a2 2 0 00-2-2h-3M4 15v3a2 2 0 002 2h3M20 15v3a2 2 0 01-2 2h-3M8 12h8', close: 'M6 6l12 12M18 6L6 18', check: 'M5 12.5l4.5 4.5L19 7', up: 'M6 15l6-6 6 6', left: 'M15 5l-7 7 7 7', route: 'M3 18a2 2 0 104 0 2 2 0 10-4 0M7 17c5-1 3-8 9-9M13 5l4 3-3 4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 100 6 3 3 0 000-6z', collapsel: 'M5 5v14M19 12H9M13 8l-4 4 4 4', expandr: 'M19 5v14M5 12h10M11 8l4 4-4 4', flag: 'M6 21V4M6 5h12l-2.5 4L18 13H6', down: 'M6 9l6 6 6-6', next: 'M9 5l7 7-7 7', undo: 'M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-3', pencil: 'M4 20l1-5L16 4l4 4L9 19zM14 6l4 4', turn: 'M8 5l10 7-10 7z', cross: 'M7 7l10 10M17 7L7 17', bucket: 'M5 12l7-7 7 7-6.5 6.5a2.1 2.1 0 01-3 0zM5 12h14M20 15c0 0-1.8 2.2-1.8 3.4a1.8 1.8 0 003.6 0C21.8 17.2 20 15 20 15z', picker: 'M14.5 4.5l5 5-3 3-5-5zM13 8L4.5 16.5V19.5h3L16 11', expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5', hand: 'M8 13V6.5a1.5 1.5 0 013 0V11M11 11V4.5a1.5 1.5 0 013 0V11M14 11V6.5a1.5 1.5 0 013 0V14c0 4-2 7-6 7-3 0-4.5-2-6-5l-1.5-3a1.5 1.5 0 012.5-1.5L8 14' };
const ROUTE_ICO = '<svg class="ico" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.6 18.0 L7.8 21.1 L4.2 21.1 L2.4 18.0 L4.2 14.9 L7.8 14.9Z" fill="currentColor"/><path d="M21.6 6.0 L19.8 9.1 L16.2 9.1 L14.4 6.0 L16.2 2.9 L19.8 2.9Z"/><path d="M10 18c4.5 0 8-2 8-6.4M15.8 12.8L18 10.4l2.2 2.4"/></svg>';   // two hexagons joined by an arrow: from the sector I was in to the one I reached
/* a rounded-hexagon badge like the game's printed icons: a colour, a black rim and a symbol in it */
const hexBadge = (name, col, s = 44, ink = '#fff') => `<span class="hxb" style="width:${s}px;height:${Math.round(s * 0.91)}px"><svg viewBox="-55 -50 110 100" width="${s}" height="${Math.round(s * 0.91)}" aria-hidden="true"><path d="${GI_HEX}" fill="${col}" stroke="#000" stroke-width="7"/></svg><i style="color:${ink}">${ico(name, Math.round(s * 0.5))}</i></span>`;
const ico = (n, s = 20) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="${n === 'turn' ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${ICONS[n]}"/></svg>`;
const colL = c => String.fromCharCode(65 + c);
const cid = (c, r) => colL(c) + String(r + 1).padStart(2, '0');
const parseId = s => { const m = /^([A-Za-z])\s*0?(\d{1,2})$/.exec(String(s).trim()); return m ? [m[1].toUpperCase().charCodeAt(0) - 65, +m[2] - 1] : null; };

/* ---------------- state ---------------- */
const fresh = () => ({
  stage: 'welcome', ready: false, items: [], undo: null, sus: {}, shapes: {}, mkN: 5, track: 'auto', marks: [], notes: [], char: '', online: false, outSent: false, revealed: false, routeSent: false, room: null, mapId: null, mode: 'ultimate', role: null, name: '', turn: 1, pos: null, fed: false, adr: false,
  phase: 'move', res: null, over: null, path: [], log: [],
  hatches: { 1: 0, 2: 0, 3: 0, 4: 0 }, tab: 'play', customMaps: [], annos: [], reborn: false, ab: {}, cat: false
});
let S = fresh();
try { Object.assign(S, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* ignore */ }
S.tab = { play: 'play', table: 'table', notes: 'table', rules: 'more', menu: 'more', more: 'more' }[S.tab] || 'play';
/* older companion games kept the other players' steps as hand marks: they are declarations now */
if (S.marks && S.marks.length) { const nm = k => String(k).replace(/^n:/, ''); S.marks.forEach((m, i) => S.log.push({ id: 'mk' + i, by: '', who: nm(m.key), turn: m.turn, kind: 'noise', sector: m.sector, text: 'noise', at: 0, mine: false })); S.marks = []; }
const save = () => { try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } if (S.online && S.room) { queueSeat(); queueJournal(); } };
/* the same state, on the table, readable only by this account: the only resume path */
let seatTimer = null;
function flushSeat() {
  if (!(S.online && S.room && S.stage === 'game' && S.role && Sync.code)) return;
  S.seatAt = Sync.now();
  let res = JSON.stringify(S.res || null); if (res.length > 1500) res = JSON.stringify({ stage: S.res.stage });
  const flags = { fed: !!S.fed, reborn: !!S.reborn, adr: !!S.adr, cat: !!S.cat, outSent: !!S.outSent, revealed: !!S.revealed, routeSent: !!S.routeSent };
  Sync.saveSeat(Object.assign({ turn: S.turn, pos: S.pos || '', path: JSON.stringify(S.path || []), items: S.items || [], over: S.over || '', char: S.char || '', role: S.role, at: S.seatAt, phase: S.phase || 'move', res }, flags, S.mkN === undefined ? {} : { mkN: S.mkN }));
}
/* the private journal: notes, drawings, suspicions. S.jsent holds what the table last confirmed, so a change made
   on this device and not yet saved can be told apart from a change made on another device. */
const journalOf = () => ({ notes: JSON.stringify(S.notes || []), annos: JSON.stringify(S.annos || []), sus: JSON.stringify(S.sus || {}), shapes: JSON.stringify(S.shapes || {}) });
let journalTimer = null, journalWarned = false;
async function flushJournal() {
  if (!(S.online && S.room && S.stage === 'game' && S.role && Sync.code)) return;
  const j = journalOf(), sent = S.jsent || {};
  if (Object.keys(j).every(k => j[k] === sent[k])) return;
  try {
    await Sync.saveJournal(j);
    S.jsent = j; try { localStorage.setItem(STORE, JSON.stringify(S)); } catch (e) { /* storage unavailable */ }
    journalWarned = false;
  } catch (e) {
    if (!journalWarned) { journalWarned = true; toast(t('Could not save your notes to the game. Check your connection.')); }
  }
}
const queueJournal = () => { clearTimeout(journalTimer); journalTimer = setTimeout(flushJournal, 1000); };
const queueSeat = () => { clearTimeout(seatTimer); seatTimer = setTimeout(flushSeat, 300); };
/* closing the tab writes the seat checkpoint and frees the bots for the rest of the table */
addEventListener('pagehide', () => {
  if (S.stage === 'game' && S.room) {
    save(); flushSeat(); flushJournal();
    try { if (window.Sync && Sync.isHolder && Sync.isHolder()) Sync.releaseHost(); } catch (_) { /* noop */ }
  }
});

/* transient (not persisted) */
const T = { maps: [], map: null, sel: null, pick: null, inspect: null, noteType: 'noise', noteWho: '' };

/* ---------------- maps ---------------- */
function parseMap(m) {
  const rows = m.rows_data;
  if (!Array.isArray(rows) || !rows.length || rows.some(r => typeof r !== 'string' || r.length !== rows[0].length)) throw new Error('Invalid map rows');
  if (!rows.every(r => /^[.sxHA1-4]+$/.test(r))) throw new Error('Unknown symbol in map (allowed: . s x H A 1 2 3 4)');
  return { id: m.id || 'map-' + Date.now(), name: m.name || 'Custom map', description: m.description || '', players: m.players || '', difficulty: m.difficulty || '', pack: m.pack || '', author: m.author || '', official: !!m.official, shared: !!(S.sharedMap && S.sharedMap.id === m.id && !(S.customMaps || []).some(c => c.id === m.id)), cols: rows[0].length, rows: rows.length, odd: m.oddColumnsLower !== false, grid: rows.map(r => r.split('')) };
}
async function loadMaps() {
  let list = [];
  try { const r = await fetch('maps/maps.json', { cache: 'no-cache' }); list = (await r.json()).maps || []; } catch (e) { /* offline/file: fall through */ }
  list = list.concat(S.customMaps || []);
  if (S.sharedMap) list.push(S.sharedMap);
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
const label = id => { const ty = at(T.map, id); return ty === 'H' ? t('Human start') : ty === 'A' ? t('Alien start') : '1234'.includes(ty) ? t('Escape Pod {n}', { n: ty }) : id; };
const basic = () => S.mode === 'basic';
/* the abilities of the Character in play (none in the Basic game, none after being reborn as an Alien) */
const myAbil = () => abilOf(S, S.mode);

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
const allowance = () => (S.role === 'alien' ? (S.fed || (myAbil() === 'Fast Alien' && S.path.length <= 1) ? 3 : 2) : 1) + (S.adr ? 1 : 0);
const typeName = ty => ({ '.': t('Dangerous sector'), s: t('Secure sector'), x: t('Empty space'), H: t('Human start'), A: t('Alien start') }[ty] || t('Escape Pod {n}', { n: ty }));

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
  el('g', { id: 'zone' }, vp);
  el('g', { id: 'marks' }, vp); el('g', { id: 'me' }, vp); el('g', { id: 'notes' }, vp); el('g', { id: 'annos' }, vp);
  paintCells(); fit();
}
/* start sectors and escape hatches: the white line art of the printed maps, traced from the original sectors */
const SECTOR_ART = {
  H: 'M-5.9 -13.6L-11.0 -10.7L-11.0 8.0L-0.9 13.9L0.6 14.2L11.3 8.0L11.3 -10.7L5.9 -13.6L4.7 -11.9L8.9 -9.2L8.9 -5.0L1.2 -0.3L-0.3 0.0L-8.6 -5.0L-8.6 -9.2L-4.4 -11.6L-5.3 -13.6zM-8.6 -1.8L-7.7 -1.8L0.3 3.0L8.6 -1.8L8.9 6.5L0.0 11.6L-8.6 6.5z',
  A: 'M-8.7 -13.1L-9.9 -11.0L-3.1 -7.2L-2.5 -6.3L-10.7 -1.6L-10.7 12.5L0.4 6.0L11.3 12.2L11.3 -2.2L3.1 -6.6L10.7 -11.0L9.6 -13.1L0.4 -7.8zM-8.4 -0.1L0.4 -5.1L9.0 -0.4L9.0 7.8L8.7 8.1L0.1 3.4L-8.1 8.1z',
  P: 'M14.3 2.5L12.8 1.6L11.9 1.9L6.3 11.6L-5.1 11.6L-5.1 14.0L7.8 14.0zM5.1 -14.0L-7.8 -14.0L-14.3 -2.5L-12.8 -1.6L-11.9 -1.9L-6.3 -11.6L5.1 -11.6z'
};
/* after a pod card the sector is solid red (damaged) or green (escaped) with only the printed black symbol */
const POD_GLYPH = {"red": "<g transform=\"translate(-46.23 -136.36)\"><path d=\"M 32.824219 135.703125 L 45.09375 135.703125 L 38.957031 125.078125 Z M 32.824219 135.703125 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 52.367188 124.421875 L 40.09375 124.421875 L 46.230469 135.050781 Z M 52.367188 124.421875 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 52.367188 148.300781 L 46.230469 137.671875 L 40.09375 148.300781 Z M 52.367188 148.300781 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 45.09375 137.015625 L 32.824219 137.015625 L 38.957031 147.644531 Z M 45.09375 137.015625 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 47.367188 135.703125 L 59.640625 135.703125 L 53.503906 125.078125 Z M 47.367188 135.703125 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 59.640625 137.015625 L 47.367188 137.015625 L 53.503906 147.644531 Z M 59.640625 137.015625 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/></g>", "green": "<g transform=\"translate(-46.23 -213.93)\"><path d=\"M 42.585938 211.402344 L 40.6875 204.921875 L 40.691406 204.921875 L 39.84375 202.023438 L 51.652344 201.992188 Z M 42.585938 211.402344 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 38.933594 225.128906 L 33.046875 214.992188 L 45.640625 218.332031 Z M 38.933594 225.128906 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 54.527344 211.597656 L 46.609375 209.601562 L 50.589844 205.46875 L 53.402344 202.554688 L 59.367188 212.824219 Z M 54.527344 211.597656 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 40.015625 208.480469 L 40.046875 208.585938 L 42.125 215.695312 L 35.683594 213.988281 L 32.867188 213.238281 L 38.523438 203.382812 Z M 40.015625 208.480469 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 50.167969 212.199219 L 50.171875 212.199219 L 59.59375 214.578125 L 53.703125 224.847656 L 52.386719 220.125 L 52.382812 220.125 Z M 50.167969 212.199219 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/><path d=\"M 43.589844 222.753906 L 49.683594 216.582031 L 52.269531 225.835938 L 40.511719 225.871094 L 43.59375 222.753906 Z M 43.589844 222.753906 \" transform=\"matrix(1.0000 0.0000 0.0000 1.0000 0.0000 0.0000)\" fill=\"#111\" fill-rule=\"nonzero\"/></g>"};
/* what happened at pod n: 'red', 'green', or '' while it is still open */
const podState = n => { if (!S.hatches[n]) return ''; const e = S.log.find(x => x.kind === 'hatch' && +x.n === +n); return e ? (e.ok ? 'green' : 'red') : 'red'; };
function sectorIcon(k) {
  if (k.startsWith('pod:')) return `<g transform="scale(.71)">${POD_GLYPH[k.slice(4)]}</g>`;
  const pod = '1234'.includes(k);
  return `<path class="sig" fill-rule="evenodd" d="${SECTOR_ART[pod ? 'P' : k]}"/>` + (pod ? `<text class="podn">${k}</text>` : '');
}
const tr = s => window.t ? window.t(s) : s; // map symbols are painted before/after language changes
function paintCells() {
    const map = T.map, reach = T.reach || new Map();
  for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
    const id = cid(c, r), g = svg.querySelector(`[data-id="${id}"]`), poly = g.firstChild, sym = g.lastChild, t = map.grid[r][c];
    let cls = 'hex ' + ('1234'.includes(t) ? 'P' : t === '.' ? 'd' : t);
    const ps = '1234'.includes(t) ? podState(+t) : '';
    if (ps) cls += ' closed ' + ps;
    if (reach.has(id)) cls += ' reach';
    if (T.sel === id || (T.pick && T.pick.sel === id)) cls += ' sel';
    if (T.pick) cls += ' pick';
    if (T.inspect === id) cls += ' inspected';
    poly.setAttribute('class', cls);
    const kind = ps ? 'pod:' + ps : t === 'H' || t === 'A' || '1234'.includes(t) ? t : '';
    g.children[1].textContent = kind ? '' : id; sym.textContent = '';
    const ic = g.children[2]; if (ic.dataset.k !== kind) { ic.dataset.k = kind; ic.innerHTML = kind ? sectorIcon(kind) : ''; }
  }
  paintOverlay(); paintMoveBtns();
}
/* the printed Dangerous Sector card back: a notched hexagon with six marks, grey on near-black */
const cardBack = w => { const P = (a, r) => [Math.cos(a * Math.PI / 180) * r, Math.sin(a * Math.PI / 180) * r];
  const star = Array.from({ length: 12 }, (_, i) => P(i * 30, i % 2 ? 0.36 : 0.5).map(n => n.toFixed(3)).join(' ')).join('L');
  const mark = a => { const c = P(a, 0.71), u = P(a + 90, 0.085), v = P(a, 0.06); return `M${c[0] + u[0]} ${c[1] + u[1]}L${c[0] + v[0]} ${c[1] + v[1]}L${c[0] - u[0]} ${c[1] - u[1]}L${c[0] - v[0]} ${c[1] - v[1]}Z`; };
  return `<svg class="cardback" viewBox="-1 -1.45 2 2.9" width="${w}" height="${Math.round(w * 1.45)}" aria-hidden="true"><rect x="-0.95" y="-1.4" width="1.9" height="2.8" rx="0.22" fill="#231f20" stroke="#8a8a8a" stroke-width="0.09"/><path d="M${star}Z" fill="none" stroke="#bdbdbd" stroke-width="0.065"/><path d="${[30, 90, 150, 210, 270, 330].map(mark).join('')}" fill="#bdbdbd"/></svg>`; };
/* confirm and cancel drawn like the game's icons: a coloured rounded hexagon, black rim, white symbol */
const hexSvg = kind => `<svg viewBox="-55 -50 110 100" width="50" height="46" aria-hidden="true"><path d="${GI_HEX}" fill="${kind === 'yes' ? '#1e8a4f' : '#EE1B2D'}" stroke="#000" stroke-width="7"/>${kind === 'yes'
  ? '<path d="M-14 1l9 9 19-20" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'
  : '<path d="M-11 -11l22 22M11 -11l-22 22" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round"/>'}</svg>`;
const hexPair = (no, yes, noLabel, yesLabel) => `<div class="hexpair">${no ? `<button class="hexbtn" data-act="${no}" aria-label="${esc(noLabel)}" title="${esc(noLabel)}">${hexSvg('no')}</button>` : ''}<button class="hexbtn" data-act="${yes}" aria-label="${esc(yesLabel)}" title="${esc(yesLabel)}">${hexSvg('yes')}</button></div>`;
const cmdChip = (icon, text) => `<div class="cmdchip">${icon || ''}<span>${text}</span></div>`;
/* what the map offers right now, next to the sector it acts on; the panel only explains it */
/* what the turn came to (the announcement, an item drawn, who was hit) next to my sector, with the tick that ends the turn */
function doneCallout(r) {
  const lines = [r.sub, r.extra].concat(r.report || []).filter(Boolean), last = !inRoom() && S.turn >= MAX_TURN;
  return `<div class="callout">${r.icon ? gico(r.icon, 34) : ''}<div class="ct"><b>${esc(r.say)}</b>${lines.map(l => `<small>${esc(l)}</small>`).join('')}</div>${hexPair('', 'next', '', t(last ? 'Finish game' : 'End turn'))}</div>`;
}
function mapCmd() {
  if (T.pick && T.pick.sel) return { at: T.pick.sel, key: 'pick:' + T.pick.sel, html: cmdChip(T.pick.icon, esc(T.pick.sel)) + hexPair('pickno', 'pickyes', t('Change sector'), t('Confirm')) };
  if (T.pick) return null;
  if (T.sel && canMoveNow()) return { at: T.sel, key: 'move', html: hexPair('mpno', 'mpyes', t('Change'), t('Confirm move')) };
  if (digital() && S.phase === 'resolve' && S.res && S.res.stage === 'done' && myTurn() && !S.over && !gameOver()) return { at: S.pos, key: 'done:' + S.turn + '|' + S.res.say + '|' + (S.res.extra || '') + (S.res.report || []).join(), html: doneCallout(S.res) };
  const opts = typeof turnOptions === 'function' ? turnOptions() : null;
  if (!opts || !opts.length) return null;
  const o = curOpt(opts), sole = o && !T.opt;   // a lone option is already chosen: cross = undo the move, if allowed
  if (o) return { at: S.pos, key: 'opt:' + o.k + (sole ? ':1' : ''), html: cmdChip(o.icon, esc(o.label)) + (sole ? hexPair(S.undo ? 'undo' : '', 'optyes', t('Undo'), o.commit) : hexPair('optno', 'optyes', t('Change plan'), o.commit)) };
  return { at: S.pos, key: 'opts:' + opts.map(x => x.k).join(','), html: `<div class="optbar" role="group" aria-label="${t('What you do next')}">${opts.map(x =>
    `<button class="opt${x.tone ? ' ' + x.tone : ''}" data-act="${x.k === 'undo' ? 'undo' : 'opt'}" data-k="${esc(x.k)}">${x.icon}<span>${esc(x.label)}</span></button>`).join('')}</div>` };
}
/* Adrenaline and Teleport are played before the move: at the start of the turn they sit on the map, in a row at the foot of it */
const premoveList = () => (typeof digital === 'function' && digital() && S.role && !S.over && !gameOver() && myTurn() && S.phase === 'move' && !T.sel && !T.pick && !T.markMode && S.tab === 'play')
  ? [...new Set(S.items)].filter(k => ['adrenaline', 'teleport'].includes(k) && canUse(k) && !(k === 'adrenaline' && S.adr) && !(k === 'teleport' && S.pos === find(T.map, 'H'))) : [];
const premoveOn = () => !T.rng && premoveList().length > 0;
function paintPremove() {
  const bar = $('#premove'); if (!bar) return;
  const list = T.rng ? [] : premoveList();
  bar.hidden = !list.length; if (!list.length) { bar.dataset.k = ''; bar.textContent = ''; return; }
  const key = LANG + '|' + list.join(',');
  if (bar.dataset.k !== key) { bar.dataset.k = key; bar.innerHTML = list.map(k => `<button class="btn" data-act="itemdlg" data-i="${k}">${gico(k, 26)}<span>${t(ITEMS[k][0])}</span></button>`).join(''); }
}
function paintMoveBtns() {
  paintPremove();
  document.querySelectorAll('#stage button[aria-label]').forEach(b => { b.title = b.getAttribute('aria-label'); });   // a hover hint on every map button
  const st = $('#stage'); if (!st || !T.map) return;
  let box = $('#movepick');
  if (!box) { box = document.createElement('div'); box.id = 'movepick'; box.className = 'movepick'; box.hidden = true; st.appendChild(box); }
  const c = mapCmd(); box.hidden = !c; if (!c) { box.dataset.k = ''; box.textContent = ''; return; }
  const key = LANG + '|' + c.key; if (box.dataset.k !== key) { box.dataset.k = key; box.innerHTML = c.html; }
  const p = parseId(c.at), h = hexPos(T.map, p[0], p[1]), top = view.y + (h.y - HEX) * view.k;
  const below = top < box.offsetHeight + 10;   // no room above: under the sector
  box.classList.toggle('below', below);
  box.style.top = (below ? view.y + (h.y + HEX) * view.k : top).toFixed(1) + 'px';
  const half = box.offsetWidth / 2, x = view.x + h.x * view.k;   // inside the map, clear of the controls on the right
  box.style.left = Math.max(half + 6, Math.min(st.clientWidth - 58 - half, x)).toFixed(1) + 'px';
}
/* ---- player markers ----
   fill = the player (you are always white), border = your guess about them:
   black = me, yellow = not decided, blue = suspected Human, red = suspected Alien.
   My own steps: full = heard (noise in the sector I reached), faded = silent or noise elsewhere,
   dashed border = a bluff, joined to where I really was by a dashed line. */
const mkN = () => S.mkN === undefined ? (S.mkAll ? 0 : 5) : S.mkN;
/* the turn slider: T.rng = [first, last] turn shown on the map and the sheet (null = the last few steps of everyone) */
/* the turns shown: the slider's span, or while it is closed the last N turns you chose, so the map looks the same either way (following a player and a finished game show everything) */
const effRng = () => T.rng || ((T.focusSet || []).length || !mkN() || (typeof gameOver === 'function' && gameOver()) ? null : [Math.max(1, S.turn - mkN() + 1), S.turn]);
const inRng = n => { const r = effRng(); return !r || (n >= r[0] && n <= r[1]); };
/* Declarations that cannot be where the player is. The game only suggests: the player decides, and marks a declaration
   fake ('f'), dubious ('d') or looked-at-and-kept ('k'). The marks live in the private journal, inside sus['~f'] (one more
   journal field would need new database rules). */
const fakeMap = () => (S.sus && S.sus['~f']) || {};
const fakeState = id => fakeMap()[id] || '';
let SUGGEST = new Map();   // declaration id -> why it seems fake (unmarked ones only)
let SUG_KEY = '', SUG_VAL = new Map();
function suggestFakes() {   // the same answer until the log or a mark changes: it is asked for on every redraw
  const key = S.log.length + '|' + (S.log[0] && S.log[0].id) + '|' + (typeof digital === 'function' && digital()) + '|' + JSON.stringify(fakeMap());
  if (key !== SUG_KEY) { SUG_VAL = suggestFakes0(); SUG_KEY = key; }
  return SUG_VAL;
}
function suggestFakes0() {
  const out = new Map(), log = S.log.slice().reverse(), H = find(T.map, 'H'), A = find(T.map, 'A');   // oldest first
  log.forEach((e, i) => {
    if (e.kind !== 'noise' || !e.sector || e.mine || fakeState(e.id)) return;
    const k = playerKey(e); if (k === 'me') return;
    // turn 1: nobody can be farther than 3 sectors from a start sector, whatever their Character or Items
    if (e.turn <= 1 && H && A && hexDist(T.map, H, e.sector) > 3 && hexDist(T.map, A, e.sector) > 3) return out.set(e.id, t('Too far from both start sectors on turn 1.'));
    // an attack in that very sector, after the declaration and before the player moved again, that touched nobody
    if (digital()) {
      let next = log.length; for (let x = i + 1; x < log.length; x++) if (playerKey(log[x]) === k && (['noise', 'silence', 'attack', 'out'].includes(log[x].kind) || (log[x].kind === 'item' && ['teleport', 'clone'].includes(log[x].text)))) { next = x; break; }   // they have moved on, or are gone
      for (let x = i + 1; x < next; x++) {
        const f = log[x]; if (f.kind !== 'attack' || f.sector !== e.sector || playerKey(f) === k || f.turn - e.turn > 1) continue;   // the same round, or just before they move again
        const hit = log.slice(x + 1, next + 1).some(g => (playerKey(g) === k && (g.kind === 'out' || g.kind === 'reveal' || (g.kind === 'item' && ['defense', 'clone'].includes(g.text)))) || killOf(g) === String(e.who).slice(0, 20));
        if (!hit) return out.set(e.id, t('An attack in this sector right after touched nobody.'));
      }
    }
    // far from a position that is certain (their attack, a pod, a revealed position)
    let sure = null; for (let x = i - 1; x >= 0; x--) { const g = log[x]; if (playerKey(g) === k && g.sector && ['attack', 'reveal', 'hatch'].includes(g.kind) && g.turn < e.turn) { sure = g; break; } }
    if (sure && !log.some(g => playerKey(g) === k && g.turn >= sure.turn && g.turn <= e.turn && ((g.kind === 'item' && ['teleport', 'clone'].includes(g.text)) || g.kind === 'out')) && hexDist(T.map, sure.sector, e.sector) > 3 * (e.turn - sure.turn))
      out.set(e.id, t('Too far from where they were on turn {n} ({s}).', { n: sure.turn, s: sure.sector }));
  });
  return out;
}
const ME_COLOR = ['#f5f5f5', '#101010'];
const PALETTE = [['#E69F00', '#1a1200'], ['#56B4E9', '#06202e'], ['#009E73', '#00140e'], ['#F0E442', '#2a2600'],
  ['#CC79A7', '#2b0619'], ['#A6763C', '#150d03'], ['#A99BF0', '#14102e'], ['#2EC4B6', '#06201d']];
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
/* What the whole table knows about a player's faction and Character, from the public record only: a card that was shown,
   an attack with no Attack card (only an Alien does that), Items only a Human uses, a pod, two noises with no Cat (the Pilot). */
let FACTS = new Map(), FACTS_KEY = '';
function publicFacts() {
  const key = S.log.length + '|' + (S.log[0] && S.log[0].id) + '|' + S.mode + '|' + (typeof digital === 'function' && digital()) + '|' + Object.keys(tablePlayers()).length;   // players arriving change who a line belongs to
  if (key === FACTS_KEY) return FACTS; FACTS_KEY = key;
  const out = new Map(), set = (k, role, char, why) => { const o = out.get(k) || {}; out.set(k, { role: role || o.role, char: char || o.char, why: why || o.why }); };
  const log = S.log.slice().reverse(), same = (x, e, k) => x.turn === e.turn && playerKey(x) === k;
  log.forEach(e => {
    const k = playerKey(e); if (k === 'me') return;
    const i = (e.kind === 'reveal' || e.kind === 'out') && typeof revealInfo === 'function' ? revealInfo(e) : null;
    if (i) set(k, i.killed && i.role === 'human' ? 'alien' : i.role, i.char, 'card');
    else if (e.kind === 'attack') {
      if (typeof digital === 'function' && !digital()) return;   // companion mode: declarations are typed in by hand, so a Soldier's attack is not told apart
      const card = log.some(x => same(x, e, k) && ((x.kind === 'item' && x.text === 'attack') || (x.kind === 'reveal' && String(x.text).startsWith('Id|human'))));
      set(k, card ? 'human' : 'alien', '', card ? 'attack card' : 'attack');
    } else if (e.kind === 'item') {
      if (['attack', 'cat', 'spotlight', 'sensor', 'defense', 'clone'].includes(e.text)) set(k, 'human', '', 'item');
      else if (e.text === 'mutation') set(k, 'alien', '', 'mutation');
    } else if (e.kind === 'hatch') set(k, 'human', '', 'pod');
  });
  if (S.mode === 'ultimate') { const n = new Map(); log.forEach(e => { if (e.kind === 'noise') { const k = playerKey(e); if (k !== 'me') n.set(k + '|' + e.turn, (n.get(k + '|' + e.turn) || 0) + 1); } });
    n.forEach((c, id) => { const [k, tn] = [id.slice(0, id.lastIndexOf('|')), +id.slice(id.lastIndexOf('|') + 1)]; if (c >= 2 && !log.some(x => x.kind === 'item' && x.text === 'cat' && x.turn === tn && playerKey(x) === k)) set(k, 'human', 'Pilot', 'two noises'); }); }
  return FACTS = out;
}
/* when the game is over every Character is shown, so the bubbles, the log and the sheet show them all */
function endFacts(k) {
  if (!k.startsWith('u:') || typeof gameOver !== 'function' || !gameOver()) return null;
  const p = tablePlayers()[k.slice(2)]; if (!p || !p.role) return null;
  return { role: p.conv ? 'alien' : p.role, char: p.char || '', why: 'end' };
}
const factOf = k => { if (k === 'me') return {}; const f = publicFacts().get(k) || {}, e = endFacts(k); return e ? Object.assign({}, f, e) : f; };
const suspicion = key => (key !== 'me' && (factOf(key).role || (S.sus && S.sus[key]))) || '';
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
  S.log.forEach(e => { if (e.sector && ['noise', 'attack', 'reveal', 'hatch'].includes(e.kind) && playerKey(e) === key) out.push({ turn: e.turn, sector: e.sector, kind: e.kind }); });
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
function setFake(id, v) {
  const open = dlg.open && dlg.querySelector('.fakecard'); S.sus = S.sus || {}; const m = Object.assign({}, fakeMap()); if (v) m[id] = v; else delete m[id];
  // the journal field holds 4000 characters: marks of lines that are gone go first, then the oldest, so a save is never refused
  const ids = new Set(S.log.map(e => e.id)); Object.keys(m).forEach(k => { if (!ids.has(k)) delete m[k]; });
  Object.keys(m).slice(0, Math.max(0, Object.keys(m).length - 120)).forEach(k => delete m[k]);
  if (Object.keys(m).length) S.sus['~f'] = m; else delete S.sus['~f'];
  save(); render(); paintOverlay(); if (open) fakeReview();   // the review dialog stays open for the next one
}
/* the flag on a declaration: nothing, dubious (amber), fake (red); a pulse means the game thinks it is fake */
const flagBtn = e => { const s = fakeState(e.id), why = SUGGEST.get(e.id); return `<button class="flagbtn${s ? ' ' + s : ''}${why && !s ? ' sug' : ''}" data-act="flag" data-id="${esc(e.id)}" aria-label="${esc(t(s === 'f' ? 'Marked fake: tap to clear' : s === 'd' ? 'Marked dubious: tap to mark fake' : 'Mark as dubious or fake'))}" title="${esc(why || t('Mark as dubious or fake'))}">${ico('flag', 16)}</button>`; };
/* drag a handle, or the bar between them (moves the whole span), or tap the track (moves the nearest handle) */
function tlDrag(track) {
  let mode = null, x0 = 0, r0 = null, w = 1;
  const turnAt = x => { const max = Math.max(1, S.turn); return Math.max(1, Math.min(max, Math.round(1 + (x - track.getBoundingClientRect().left) / w * (max - 1)))); };
  const set = (lo, hi) => { T.rng = [lo, hi]; stopPlay(); paintOverlay(); };   // the panel (the sheet) follows when the finger lifts
  track.onpointerdown = e => {
    const max = Math.max(1, S.turn), box = track.getBoundingClientRect(); w = box.width || 1; x0 = e.clientX; r0 = T.rng.slice();
    const px = n => box.left + (max > 1 ? (n - 1) / (max - 1) * w : 0), t = e.target;
    mode = t.classList.contains('lo') ? 'lo' : t.classList.contains('hi') ? 'hi' : t.classList.contains('tlfill') ? 'pan' : null;
    if (!mode) { const n = turnAt(e.clientX), dl = Math.abs(n - r0[0]), dh = Math.abs(n - r0[1]); mode = dl < dh || (dl === dh && n < r0[0]) ? 'lo' : 'hi'; mode === 'lo' ? set(Math.min(n, r0[1]), r0[1]) : set(r0[0], Math.max(n, r0[0])); r0 = T.rng.slice(); }
    if (r0[0] === r0[1] && (mode === 'lo' || mode === 'hi')) mode = 'both';   // two handles on one turn: the first move says which one
    track.setPointerCapture(e.pointerId); e.preventDefault(); e.stopPropagation();   // the map behind must not pan
  };
  track.onpointermove = e => {
    if (!mode) return; e.stopPropagation();
    const max = Math.max(1, S.turn), d = Math.round((e.clientX - x0) / w * (max - 1));
    if (mode === 'both') { if (Math.abs(e.clientX - x0) < 4) return; mode = e.clientX < x0 ? 'lo' : 'hi'; }
    if (mode === 'pan') { const span = r0[1] - r0[0], lo = Math.max(1, Math.min(max - span, r0[0] + d)); set(lo, lo + span); }
    else if (mode === 'lo') set(Math.max(1, Math.min(r0[1], r0[0] + d)), r0[1]);
    else if (mode === 'hi') set(r0[0], Math.min(max, Math.max(r0[0], r0[1] + d)));
  };
  track.onpointerup = track.onpointercancel = () => { if (mode) render(); mode = null; };
}
function stopPlay() { clearInterval(T.tlTimer); T.tlTimer = null; }
function tlShift(d) { const max = Math.max(1, S.turn), w = T.rng[1] - T.rng[0], lo = Math.max(1, Math.min(max - w, T.rng[0] + d)); T.rng = [lo, lo + w]; render(); paintOverlay(); }
/* the slider bar at the foot of the map: a range of turns, with a tick for every attack, pod and death */
function renderTl() {
  const bar = $('#tlbar'); if (!bar) return;
  if (!T.rng || !S.role || !T.map) { bar.hidden = true; bar.dataset.k = ''; return; }
  const max = Math.max(1, S.turn);
  if (T.rngMax && T.rngMax < max && T.rng[1] === T.rngMax) { const d = max - T.rngMax; T.rng = [T.rng[0] + d, max]; }   // following the live turn
  T.rngMax = max; T.rng = [Math.max(1, Math.min(T.rng[0], max)), Math.max(1, Math.min(T.rng[1], max))];
  const [lo, hi] = T.rng, pct = n => max > 1 ? (n - 1) / (max - 1) * 100 : 0, key = LANG + '|' + max + '|' + !!T.hideDecoy + '|' + !!T.tlTimer + '|' + Object.values(fakeMap()).includes('f');
  const lab = lo === hi ? t('Turn {n}', { n: lo }) : t('Turns {a}–{b}', { a: lo, b: hi });
  bar.hidden = false;
  if (bar.dataset.k !== key) {
    bar.dataset.k = key;
    const tick = new Map(); S.log.forEach(e => { const c = killOf(e) || e.kind === 'out' ? 'dead' : e.kind === 'attack' ? 'atk' : e.kind === 'hatch' && e.n ? 'pod' : ''; if (c) { if (!tick.has(e.turn)) tick.set(e.turn, new Set()); tick.get(e.turn).add(c); } });
    bar.innerHTML = `<div class="tlrow"><b class="tltxt"></b><button class="btn" data-act="tlall">${t('All')}</button><button class="btn" data-act="tlnow">${t('Now')}</button>${Object.values(fakeMap()).includes('f') ? `<button class="btn" data-act="tldecoy" aria-pressed="${!!T.hideDecoy}" title="${esc(t('Hide the declarations you marked fake'))}">${t('Fakes')}</button>` : ''}<button class="btn" data-act="mkall" aria-label="${t('Close')}">${ico('close', 16)}</button></div>
      <div class="tlrow2"><button class="btn" data-act="tlprev" aria-label="${t('Earlier')}">${ico('left', 16)}</button><button class="btn" data-act="tlplay" aria-label="${t(T.tlTimer ? 'Stop' : 'Play the turns')}">${ico(T.tlTimer ? 'close' : 'turn', 16)}</button><button class="btn" data-act="tlnext" aria-label="${t('Later')}">${ico('next', 16)}</button>
      <div class="tltrack"><div class="tlfill"></div><div class="tlticks">${[...tick].map(([n, s]) => `<i class="${[...s].join(' ')}" style="left:${pct(n).toFixed(1)}%"></i>`).join('')}</div>
      <i class="tlth lo" role="slider" aria-label="${t('From turn')}"></i><i class="tlth hi" role="slider" aria-label="${t('To turn')}"></i></div></div>`;
    tlDrag(bar.querySelector('.tltrack'));
  }
  const th = c => bar.querySelector('.tlth.' + c); th('lo').style.left = pct(lo) + '%'; th('hi').style.left = pct(hi) + '%'; th('lo').setAttribute('aria-valuenow', lo); th('hi').setAttribute('aria-valuenow', hi);
  bar.querySelector('.tltxt').textContent = lab;
  const f = bar.querySelector('.tlfill'); f.style.left = pct(lo) + '%'; f.style.width = Math.max(0, pct(hi) - pct(lo)) + '%';
}
function paintOverlay() {
  const map = T.map, inPlay = S.role;
  const marks = $('#marks'), me = $('#me'), zoneG = $('#zone');
  marks.textContent = ''; me.textContent = ''; if (zoneG) zoneG.textContent = ''; paintNotes(); paintAnnos();
  const focus = T.focus || null, fset = T.focusSet || [];   // fset: every player picked on the bar (one = focus)
  const hp = sec => { const q = parseId(sec); return q ? hexPos(map, q[0], q[1]) : null; };
  const routes = inPlay ? finalRoutes() : null;
  renderMkBar(); followBar(); renderTl();
  if (!inPlay) return;
  if (routes) { paintRoutes(routes, fset, hp, marks); return; }
  const own = ownSteps(); SUGGEST = suggestFakes();
  // follow mode: shade the sectors the followed player could have reached since they were last heard
  if (focus && focus !== 'me' && zoneG) {
    const fz = followZone(focus), [col] = pal(focus);
    if (fz) fz.zone.forEach((_, id) => { const q = parseId(id), h = hexPos(map, q[0], q[1]); el('polygon', { points: hexPts(h.x, h.y, HEX - 2.2), class: 'fzone', fill: col, stroke: col }, zoneG); });
  }
  // collect every visit: my own route + my bluffs + other players' public positions
  const visits = [];
  S.path.forEach(p => visits.push({ key: 'me', sector: p.pos, turn: p.turn, kind: 'route' }));
  S.log.forEach(e => { if (e.kind === 'attack' && e.sector && playerKey(e) === 'me') visits.push({ key: 'me', sector: e.sector, turn: e.turn, kind: 'attack', armed: S.role === 'human' }); });
  own.bluffs.forEach(b => visits.push({ key: 'bluff', sector: b.sector, turn: b.turn, kind: 'noise' }));
  for (const e of S.log) {
    if (!e.sector || !['noise', 'attack', 'reveal', 'spot'].includes(e.kind)) continue;
    const key = e.kind === 'spot' ? 'spot' : playerKey(e);
    if (key === 'me') continue;                                   // my own steps come from my route
    const armed = e.kind === 'attack' && S.log.some(x => x.kind === 'item' && x.text === 'attack' && x.turn === e.turn && playerKey(x) === key);
    const st = fakeState(e.id); if (st === 'f' && T.hideDecoy) continue;
    visits.push({ key, sector: e.sector, turn: e.turn, kind: e.kind, armed, st });
  }
  const mine = k => k === 'me' || k === 'bluff';
  // the last N known steps of every player, yours included (0 = all); following someone shows only them, from the start
  const N = mkN(), winTurns = new Map();
  new Set(visits.map(v => v.key)).forEach(k => { if (k === 'bluff' || k === 'spot') return; const ts = [...new Set(visits.filter(v => v.key === k).map(v => v.turn))].sort((x, y) => y - x); winTurns.set(k, new Set(N ? ts.slice(0, N) : ts)); });
  const R = effRng(), recent = v => R ? inRng(v.turn) && (!fset.length || fset.includes(v.key) || (fset.includes('me') && v.key === 'bluff')) : fset.length ? (fset.includes(v.key) || (fset.includes('me') && v.key === 'bluff')) : v.key === 'bluff' ? (winTurns.get('me') || new Set()).has(v.turn) : v.key === 'spot' ? (!N || S.turn - v.turn < N) : (winTurns.get(v.key) || new Set()).has(v.turn);
  // group: sector -> player -> turns
  const bySector = new Map();
  for (const v of visits) {
    if (!recent(v)) continue;
    if (!bySector.has(v.sector)) bySector.set(v.sector, new Map());
    const m = bySector.get(v.sector);
    if (!m.has(v.key)) m.set(v.key, { key: v.key, turns: [], kind: v.kind, armed: false, allF: true, allD: true });
    const it = m.get(v.key); it.allF = it.allF && v.st === 'f'; it.allD = it.allD && (v.st === 'f' || v.st === 'd'); if (!it.turns.includes(v.turn)) it.turns.push(v.turn);
    if (v.kind === 'attack') it.armed = !!v.armed;
    const rank = { route: 0, noise: 1, attack: 2, reveal: 3, spot: 0 };
    if (rank[v.kind] > rank[it.kind]) it.kind = v.kind;
  }
  const order = k => k === 'me' ? -2 : k === 'bluff' ? -1 : k === 'spot' ? 99 : colorOf(k);
  const mkPos = new Map();
  bySector.forEach((m, sec) => {
    const h = hp(sec); if (!h) return;
    const items = [...m.values()].sort((x, y) => order(x.key) - order(y.key));
    const spot = items.find(x => x.key === 'spot'), list = items.filter(x => x.key !== 'spot');
    if (spot) { el('circle', { cx: h.x, cy: h.y, r: 17, class: 'mk spot' + (fset.length ? ' dim' : '') }, marks); el('use', { href: '#gi-spotlight', x: (h.x - 7.5).toFixed(1), y: (h.y - 21).toFixed(1), width: 15, height: 13.8, class: 'mk' + (fset.length ? ' dim' : '') }, marks); }
    if (!list.length) return;
    // following a player: their markers sit alone in the middle of each sector (my own bluffs in the same sector stay out of the way)
    const shown = fset.length ? list.filter(x => fset.includes(x.key) || (x.key === 'bluff' && fset.includes('me') && !list.some(y => y.key === 'me'))) : list;
    if (!shown.length) return;
    const { size, pts: sp } = slots(shown.length);
    shown.forEach((it, i) => {
      const [dx, dy] = sp[i], turns = it.turns.sort((x, y) => y - x), last = turns[0];
      const label = turns.slice(0, 2).map(n => n || 'S').join(',') + (turns.length > 2 ? '…' : '');
      const ownM = mine(it.key), ck = ownM ? 'me' : it.key, ink = pal(ck)[1], bluff = it.key === 'bluff';
      const faded = it.key === 'me' && !own.heard.has(last);
      const dim = fset.length && !(fset.includes(it.key) || (fset.includes('me') && ownM)), old = !R && !fset.length && !ownM && S.turn - last >= 2;
      if (!bluff) mkPos.set((ownM ? 'me' : it.key) + '|' + sec, [h.x + dx, h.y + dy, size]);
      const g = el('g', { class: `mk pm ${it.kind}${it.allF ? ' fake' : it.allD ? ' dubious' : ''}${ownM ? ' mine' : ''}${bluff ? ' bluff' : ''}${faded ? ' faded' : ''}${old ? ' old' : ''}${dim ? ' dim' : ''}`, transform: `translate(${(h.x + dx).toFixed(1)} ${(h.y + dy).toFixed(1)})` }, marks);
      const ty = markBody(g, ck, size, { faded, dashed: bluff });
      if (it.key === 'me' && sec === S.pos) { const cls = fset.length && !fset.includes('me') ? ' dim' : '', at_ = { cx: (h.x + dx).toFixed(1), cy: (h.y + dy).toFixed(1) }; const rg = el('g', { transform: `translate(${at_.cx} ${at_.cy})` }, me), ringAt = (rr, c) => el('path', { d: roundedHex(rr, rr * 0.27), class: c }, rg); ringAt((size + 3) * 1.12, 'me-ring pulse' + cls); }
      const tx = el('text', { fill: ink, y: ty.toFixed(1), 'font-size': (label.length > 2 ? size * 0.72 : size * 0.98).toFixed(1) }, g); tx.textContent = label;
      if (it.key === 'me' && S.reborn && killedSector(S.path) === sec) killedBadge(g, size);
      // the printed icons of what this player declared on that step, as marks on the marker
      stepBadges(g, stepIcons(it.key, last, sec), size);
    });
  });
  if (S.routesOn) drawRouteArrows(liveSteps(fset, recent), mkPos, marks, !!R);
}
/* ---------------- routing overlay ----------------
   Colored arrows join each player's known steps, from their marker in one sector to their marker in the next.
   One step is a straight arrow; 2 or 3 sectors get a tag with the length; a teleport (or a restart) is a dotted
   curve and turns nobody heard a dashed curve. Arrows on the same two sectors are pushed apart into lanes.
   Older moves fade. */
const cubeOf = (map, c, r) => { const z = r - (map.odd ? (c - (c & 1)) / 2 : (c + (c & 1)) / 2); return [c, -c - z, z]; };
/* the sector type under a point of the map (null off the map) */
function typeAtPoint(map, x, y) {
  const c0 = Math.round((x - HEX) / (1.5 * HEX)); let best = null, bd = 1e9;
  for (let c = c0 - 1; c <= c0 + 1; c++) {
    const r0 = Math.floor((y - (lower(map, c) ? Math.sqrt(3) * HEX / 2 : 0)) / (Math.sqrt(3) * HEX));
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      if (c < 0 || r < 0 || c >= map.cols || r >= map.rows) continue;
      const h = hexPos(map, c, r), d = Math.hypot(h.x - x, h.y - y); if (d < bd) { bd = d; best = map.grid[r][c]; }
    }
  }
  return best;
}
/* is the line between two sectors a straight row of sectors (so it crosses their centres, not an edge)? */
function straightMove(map, a, b) {
  const p = parseId(a), q = parseId(b); if (!p || !q) return true;
  const A = cubeOf(map, p[0], p[1]), B = cubeOf(map, q[0], q[1]), d = [0, 1, 2].map(i => B[i] - A[i]);
  return d.filter(v => v === 0).length >= 1;
}
function hexDist(map, a, b) {
  const p = parseId(a), q = parseId(b); if (!p || !q) return 0;
  const A = cubeOf(map, p[0], p[1]), B = cubeOf(map, q[0], q[1]);
  return Math.max(Math.abs(A[0] - B[0]), Math.abs(A[1] - B[1]), Math.abs(A[2] - B[2]));
}
/* where a player was killed: the sector before the restart as an Alien, or the last one if they are out */
function killedSector(path, out) {
  const p = (path || []).filter(x => x && parseId(x.pos)), i = p.findIndex(x => x.note === 'reborn');
  return i > 0 ? p[i - 1].pos : out === 'killed' && p.length ? p[p.length - 1].pos : null;
}
const killedBadge = (g, size) => el('use', { href: '#gi-killed', x: (-size * 1.8).toFixed(1), y: (-size * 1.9).toFixed(1), width: (size * 1.6).toFixed(1), height: (size * 1.6).toFixed(1) }, g);   // top left: the step icons are on the right
/* a real route (my path, or anyone's at game over) as steps */
function pathSteps(path) {
  const out = [], p = (path || []).filter(x => x && parseId(x.pos));
  for (let i = 1; i < p.length; i++) {
    const a = p[i - 1], b = p[i], jump = ['teleport', 'clone'].includes(b.note);
    if (b.note === 'reborn' || b.note === 'mutated') continue;   // a restart or a mutation is not a move: only the marker shows
    out.push({ from: a.pos, to: b.pos, t0: a.turn, t: b.turn, kind: jump ? 'jump' : a.pos === b.pos ? 'stay' : 'move' });
  }
  return out;
}
/* what the table knows about everyone, as steps: my real route, and the others' announced positions */
function liveSteps(fset, recent) {
  const per = new Map();
  S.log.forEach(e => {
    if (!e.sector || !['noise', 'attack', 'reveal'].includes(e.kind) || fakeState(e.id) === 'f') return;
    const k = playerKey(e); if (k === 'me') return;
    if (!per.has(k)) per.set(k, new Map());
    const m = per.get(k); if (!m.has(e.turn)) m.set(e.turn, new Set()); m.get(e.turn).add(e.sector);
  });
  const all = [{ key: 'me', steps: pathSteps(S.path) }];
  per.forEach((m, k) => {
    const turns = [...m.keys()].sort((x, y) => x - y), steps = [];
    let prev = null;
    for (const t of turns) {
      const secs = [...m.get(t)];
      if (secs.length !== 1) { prev = null; continue; }   // two noises in one turn (a Cat): no telling which is real
      if (prev) {
        const tele = S.log.some(x => x.kind === 'item' && x.text === 'teleport' && x.turn === t && playerKey(x) === k);
        steps.push({ from: prev.sec, to: secs[0], t0: prev.t, t, kind: t - prev.t > 1 ? 'gap' : tele ? 'jump' : prev.sec === secs[0] ? 'stay' : 'move' });
      }
      prev = { sec: secs[0], t };
    }
    all.push({ key: k, steps });
  });
  return all.filter(r => (!fset.length || fset.includes(r.key))).map(r => ({ key: r.key, steps: r.steps.filter(s => recent({ key: r.key, turn: s.t }) && (inRng(s.t0) || !s.t0)) }));
}
/* how far to bend an arrow so it keeps off empty sectors, the start sectors and other players' markers: tries a few bends, the cheapest wins (straight wins a tie) */
function bestBend(map, x, markers) {
  const a = x.a, b = x.b, dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L, k = x.s.kind, base = k === 'jump' ? 0.38 : 0.26;
  const cands = k === 'move' ? (x.curve ? [0.15, -0.15, 0.3, -0.3, 0.45, -0.45] : [0, 0.15, -0.15, 0.3, -0.3, 0.45, -0.45]) : [base, -base, base * 1.6, -base * 1.6];
  const others = markers.filter(m => Math.hypot(m[0] - a[0], m[1] - a[1]) > 3 && Math.hypot(m[0] - b[0], m[1] - b[1]) > 3);   // the arrow's own two markers do not count
  let best = cands[0], bc = 1e9;
  for (const bend of cands) {
    const cx = (a[0] + b[0]) / 2 + nx * bend * L, cy = (a[1] + b[1]) / 2 + ny * bend * L; let cost = Math.abs(bend) * (k === 'move' ? 3 : 0.5);
    for (let i = 2; i <= 18; i++) {
      const t = i / 20, px = (1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cx + t * t * b[0], py = (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cy + t * t * b[1], ty = typeAtPoint(map, px, py);
      if (ty === 'x') cost += 4; else if (ty === 'H' || ty === 'A') cost += 3;
      if (others.some(m => Math.hypot(px - m[0], py - m[1]) < (m[2] || 6) + 3)) cost += 3;
    }
    if (cost < bc - 1e-9) { bc = cost; best = bend; }
  }
  return best;
}
function drawRouteArrows(routes, mkPos, marks, solid) {
  const map = T.map, g = el('g', { class: 'routes' }), now = S.turn, classic = svg.classList.contains('classic');
  const at = (k, sec) => { const p = mkPos.get(k + '|' + sec); if (p) return p; const q = parseId(sec); if (!q) return null; const h = hexPos(map, q[0], q[1]); return [h.x, h.y, 0]; };
  const fade = t => { if (solid) return 1; const age = now - t; return age < 3 ? 1 : Math.max(0.28, 1 - (age - 2) * 0.18); };
  const color = k => k === 'me' ? (classic ? '#151515' : '#f5f5f5') : pal(k)[0];
  const arrows = [];
  routes.forEach(r => {
    const seen = new Map();
    r.steps.forEach(s => {
      const a = at(r.key, s.from), b = at(r.key, s.to); if (!a || !b) return;
      if (s.kind === 'move') {   // repeated trips of the same player the same way are drawn once, at their newest turn
        const id = s.from + '>' + s.to, old = seen.get(id); if (old) { old.t = Math.max(old.t, s.t); return; }
        const it = { key: r.key, s, a, b, t: s.t, d: hexDist(map, s.from, s.to), curve: !straightMove(map, s.from, s.to) }; seen.set(id, it); arrows.push(it);
      } else arrows.push({ key: r.key, s, a, b, t: s.t });
    });
  });
  const markers = [...mkPos.values()];
  arrows.forEach(x => { if (x.s.kind === 'stay') return; x.bend = bestBend(map, x, markers); if (x.s.kind === 'move' && x.bend !== 0) x.curve = true; });
  // lanes: straight arrows on the same two sectors are spread so none sits on another
  const groups = new Map();
  arrows.filter(x => x.s.kind === 'move' && !x.curve).forEach(x => { const id = [x.s.from, x.s.to].sort().join('|'); if (!groups.has(id)) groups.set(id, []); groups.get(id).push(x); });
  groups.forEach(list => {
    const [c1, c2] = list[0].s.from < list[0].s.to ? [list[0].a, list[0].b] : [list[0].b, list[0].a];
    let dx = c2[0] - c1[0], dy = c2[1] - c1[1]; const L = Math.hypot(dx, dy) || 1; const nx = -dy / L, ny = dx / L;
    const mx = (c1[0] + c2[0]) / 2, my = (c1[1] + c2[1]) / 2;
    list.forEach(x => { x.perp = ((x.a[0] + x.b[0]) / 2 - mx) * nx + ((x.a[1] + x.b[1]) / 2 - my) * ny + (x.s.from < x.s.to ? 0.01 : -0.01); });
    const sorted = list.slice().sort((p, q) => p.perp - q.perp), GAP = 5.2, want = sorted.map(x => x.perp);
    for (let i = 1; i < want.length; i++) want[i] = Math.max(want[i], want[i - 1] + GAP);
    const shift = (want.reduce((s, v) => s + v, 0) - sorted.reduce((s, x) => s + x.perp, 0)) / want.length;
    sorted.forEach((x, i) => { const d = want[i] - shift - x.perp; x.off = [nx * d, ny * d]; });
  });
  const P = (x, y) => x.toFixed(1) + ' ' + y.toFixed(1);
  arrows.sort((p, q) => p.t - q.t).forEach(x => {
    const col = color(x.key), op = fade(x.t), grp = el('g', { class: 'rt' + (x.key === 'me' ? ' me' : ''), opacity: op.toFixed(2) }, g);
    const W = 1.7, HL = 6, HW = 5.8;
    if (x.s.kind === 'stay') {   // stayed or attacked without moving: a little circular arrow by the marker
      const [cx, cy, sz] = x.a, r = (sz || 6) + 4.5, a0 = 3.5, a1 = 8.6, pts = [];
      for (let i = 0; i <= 30; i++) { const an = a0 + (a1 - a0) * i / 30; pts.push([cx + r * Math.cos(an), cy + r * Math.sin(an)]); }
      el('path', { d: 'M' + pts.slice(0, 26).map(p => P(p[0], p[1])).join(' L'), fill: 'none', stroke: col, 'stroke-width': 2.2, 'stroke-linecap': 'round' }, grp);
      const tip = pts[30], bs = pts[25], ux = tip[0] - bs[0], uy = tip[1] - bs[1], l = Math.hypot(ux, uy) || 1, nx = -uy / l * 3.4, ny = ux / l * 3.4;
      el('path', { d: `M${P(tip[0], tip[1])} L${P(bs[0] + nx, bs[1] + ny)} L${P(bs[0] - nx, bs[1] - ny)}Z`, fill: col }, grp);
      return;
    }
    const off = x.off || [0, 0], a = [x.a[0] + off[0], x.a[1] + off[1]], b = [x.b[0] + off[0], x.b[1] + off[1]];
    const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy); if (L < 1) return;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux, t0 = (x.a[2] || 3) + 2.4, t1 = (x.b[2] || 3) + 2.4;
    if (x.s.kind === 'move' && !x.curve) {
      let s0 = t0, s1 = t1; if (L - s0 - s1 < HL + 3) { const k = Math.max(0, (L - HL - 3) / (s0 + s1)); s0 *= k; s1 *= k; }
      const sx = a[0] + ux * s0, sy = a[1] + uy * s0, tx = b[0] - ux * s1, ty = b[1] - uy * s1, bx = tx - ux * HL, by = ty - uy * HL;
      el('path', { d: `M${P(sx + nx * W / 2, sy + ny * W / 2)} L${P(bx + nx * W / 2, by + ny * W / 2)} L${P(bx + nx * HW / 2, by + ny * HW / 2)} L${P(tx, ty)} L${P(bx - nx * HW / 2, by - ny * HW / 2)} L${P(bx - nx * W / 2, by - ny * W / 2)} L${P(sx - nx * W / 2, sy - ny * W / 2)}Z`, fill: col, stroke: col, 'stroke-width': 0.6, 'stroke-linejoin': 'round' }, grp);
      return;
    }
    // a jump, unheard turns, or a move that is not in a straight row of sectors: a curve (a straight line there would run along the edge between two sectors)
    const bend = x.bend, cxp = (a[0] + b[0]) / 2 + nx * bend * L, cyp = (a[1] + b[1]) / 2 + ny * bend * L, q = t => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * cxp + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * cyp + t * t * b[1]];
    const pts = []; for (let i = 0; i <= 48; i++) pts.push(q(i / 48));
    const acc = [0]; for (let i = 1; i < pts.length; i++) acc.push(acc[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const tot = acc[acc.length - 1], i0 = acc.findIndex(v => v >= t0), i1 = acc.reduce((m, v, i) => v <= tot - t1 ? i : m, 0), ib = acc.reduce((m, v, i) => v <= acc[i1] - HL ? i : m, 0);
    if (i0 < 0 || ib <= i0) return;
    el('path', { d: 'M' + pts.slice(i0, ib + 1).map(p => P(p[0], p[1])).join(' L'), fill: 'none', stroke: col, 'stroke-width': x.s.kind === 'move' ? 1.7 : 2, 'stroke-linecap': 'round', ...(x.s.kind === 'move' ? {} : { 'stroke-dasharray': x.s.kind === 'jump' ? '0.1 4.6' : '5.5 4' }) }, grp);
    const tip = pts[i1], bs = pts[ib], vx = tip[0] - bs[0], vy = tip[1] - bs[1], l = Math.hypot(vx, vy) || 1, hx = -vy / l * HW / 2, hy = vx / l * HW / 2;
    el('path', { d: `M${P(tip[0], tip[1])} L${P(bs[0] + hx, bs[1] + hy)} L${P(bs[0] - hx, bs[1] - hy)}Z`, fill: col }, grp);
    const mid = q(0.5);
    if (x.s.kind === 'move') return;
    if (x.s.kind === 'gap') routeTag(grp, mid[0], mid[1], t('T{a}–{b}', { a: x.s.t0, b: x.s.t }), col, x.key);
    else el('path', { d: `M${P(mid[0], mid[1] - 5)} L${P(mid[0] + 1.4, mid[1] - 1.4)} L${P(mid[0] + 5, mid[1])} L${P(mid[0] + 1.4, mid[1] + 1.4)} L${P(mid[0], mid[1] + 5)} L${P(mid[0] - 1.4, mid[1] + 1.4)} L${P(mid[0] - 5, mid[1])} L${P(mid[0] - 1.4, mid[1] - 1.4)}Z`, fill: col }, grp);
  });
  marks.insertBefore(g, marks.firstChild);
}
/* a small rounded tag on an arrow: the number of sectors, or the unheard turns */
function routeTag(parent, x, y, txt, col, key) {
  const w = 5 + txt.length * 4.2, ink = key === 'me' ? '#111' : pal(key)[1];
  el('rect', { x: (x - w / 2).toFixed(1), y: (y - 5.4).toFixed(1), width: w.toFixed(1), height: 10.8, rx: 5.4, fill: col }, parent);
  const tx = el('text', { x: x.toFixed(1), y: (y + 0.4).toFixed(1), class: 'rtag', fill: ink }, parent); tx.textContent = txt;
}
/* game over: every player's real route, from the devices that played them (announcements and bluffs are left out) */
function finalRoutes() {
  if (T.showAnn) return null;
  if (S.hot) { if (!(window.Hot && Hot.isOver())) return null; const me = myId(); const pp = Hot.publicPlayers(); return Object.entries(Hot.routes()).map(([id, v]) => ({ key: id === me ? 'me' : 'u:' + id, path: v.path, role: v.role, out: (pp[id] || {}).out })); }
  if (!(window.Sync && Sync.code && Sync.settings && Sync.settings.status === 'over')) return null;
  const out = [{ key: 'me', path: S.path, role: S.role, out: S.over === 'dead' ? 'killed' : S.over }];
  Object.entries(Sync.players || {}).forEach(([u, p]) => { if (u !== Sync.uid && p.route) out.push({ key: 'u:' + u, path: decodeRoute(p.route), role: p.role, out: p.out }); });
  return out;
}
const ROLE_BORDER = { human: '#2f7dff', alien: '#ff3b30' };
/* the role held at each step of a path: Human until the restart or the mutation, Alien from there on */
function stepRoles(path, finalRole) {
  const p = (path || []).filter(x => x && parseId(x.pos)), i = p.findIndex(x => x.note === 'reborn' || x.note === 'mutated');
  return p.map((_, k) => (i >= 0 ? (k < i ? 'human' : 'alien') : finalRole));
}
function paintRoutes(routes, fset, hp, marks) {
  fset = Array.isArray(fset) ? fset : (fset ? [fset] : []);   // a list of picked players (a single key or null is accepted too)
  const bySector = new Map(), rpos = new Map();
  routes = routes.filter(r => !fset.length || fset.includes(r.key));   // following a player shows only their markers, each alone in its sector
  routes.forEach(r => { r.dead = killedSector(r.path, r.out); });
  routes.forEach(r => {
    const roles = stepRoles(r.path, r.role);
    r.path.filter(p => p && parseId(p.pos)).forEach((p, i) => { if (T.rng && !inRng(p.turn)) return; if (!bySector.has(p.pos)) bySector.set(p.pos, new Map()); const m = bySector.get(p.pos); if (!m.has(r.key)) m.set(r.key, { r, turns: [], role: roles[i] }); const it = m.get(r.key); it.turns.push(p.turn); it.role = roles[i]; });
  });
  bySector.forEach((m, sec) => {
    const h = hp(sec); if (!h) return;
    const list = [...m.values()].sort((a, b) => colorOf(a.r.key) - colorOf(b.r.key)), { size, pts: sp } = slots(list.length);
    list.forEach((it, i) => {
      const [dx, dy] = sp[i], k = it.r.key, turns = [...new Set(it.turns)].sort((a, b) => b - a), dim = fset.length && !fset.includes(k);
      const label = turns.slice(0, 2).map(n => n || 'S').join(',') + (turns.length > 2 ? '…' : '');
      rpos.set(k + '|' + sec, [h.x + dx, h.y + dy, size]);
      const g = el('g', { class: 'mk pm route' + (k === 'me' ? ' mine' : '') + (dim ? ' dim' : ''), transform: `translate(${(h.x + dx).toFixed(1)} ${(h.y + dy).toFixed(1)})` }, marks);
      const ty = markBody(g, k, size, { border: k === 'me' ? null : ROLE_BORDER[it.role || it.r.role] });
      const tx = el('text', { fill: pal(k)[1], y: ty.toFixed(1), 'font-size': (label.length > 2 ? size * 0.72 : size * 0.98).toFixed(1) }, g); tx.textContent = label;
      if (it.r.dead === sec) killedBadge(g, size);
      stepBadges(g, stepIcons(k, turns[0], sec, it.role || it.r.role), size);   // what they declared on that step, as in the live view
    });
  });
  if (S.routesOn) drawRouteArrows(routes.map(r => ({ key: r.key, steps: pathSteps(r.path).filter(x => inRng(x.t) && (inRng(x.t0) || !x.t0)) })), rpos, marks, true);   // both ends are in the turns shown; the start sector (turn 0) counts as turn 1
}
/* eliminated / escaped badge on a player's icon in the strip and the sheet */
function outMark(k) {
  const o = k === 'me' ? ({ dead: 'killed', escaped: 'escaped', trapped: 'trapped' })[S.over] || (S.reborn ? 'conv' : '') : k.startsWith('u:') ? (tablePlayers()[k.slice(2)] || {}).out || ((tablePlayers()[k.slice(2)] || {}).conv ? 'conv' : '') : null;
  if (!o) return '';
  if (o === 'conv') return `<i class="omark conv" title="${t('Killed as a Human: now an Alien')}">${gico('claws', 16)}</i>`;   // still playing, so no cross
  return o === 'escaped' ? `<i class="omark esc" title="${t('escaped')}">${ico('check', 12)}</i>` : `<i class="omark dead" title="${t(o === 'trapped' ? 'trapped' : 'eliminated')}">${o === 'trapped' ? ico('cross', 12) : gico('killed', 16)}</i>`;
}
/* banner under the top bar while following a player */
function followBar() { followBar0(); const bar = $('#followbar'), mk = $('#mkbar'); if (bar && mk) mk.style.top = bar.hidden ? '' : (bar.offsetTop + bar.offsetHeight + 6) + 'px'; }   // the strip starts under the banner
function followBar0() {
  const bar = $('#followbar'); if (!bar) return;
  const picked = T.focusSet || [];
  if (picked.length > 1 && S.role) {
    bar.hidden = false; bar.style.setProperty('--fc', pal(picked[0])[0]);
    bar.textContent = t('Showing {n} players', { n: picked.length }); return;
  }
  const k = T.focus;
  if (!k || !S.role) { bar.hidden = true; return; }
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
/* ---- companion: what the other players declare, and map notes ----
   The companion is the paper sheet: the player writes down what the others announce. Each declaration goes into the
   log like a table announcement, so the markers, the follow zone and the table log all work from it. */
const DECL = [['noise', 'noise-here', 'Noise'], ['attack', '', 'Attack'], ['silence', 'silence', 'Silence'], ['secure', '', 'Silent Sector'], ['item', '', 'Item']];
const nameOfKey = k => (knownPlayers().find(([x]) => x === k) || [0, '?'])[1];
function declare(kind, sector, item) {
  const turn = T.markTurn || S.turn, who = nameOfKey(T.markKey), ids = [];
  const add = e => { const x = Object.assign({ id: uid(), by: '', who, turn, sector: null, at: Date.now(), mine: false }, e); S.log.unshift(x); ids.push(x.id); };
  if (kind === 'noise') add({ kind: 'noise', sector, text: 'noise' });
  else if (kind === 'attack') add({ kind: 'attack', sector, text: 'attack' });
  else if (kind === 'silence') add({ kind: 'silence', text: 'silence' });
  else if (kind === 'secure') add({ kind: 'silence', text: 'secure' });
  else if (kind === 'item') {
    add({ kind: 'item', text: item });
    if (item === 'attack' && sector) add({ kind: 'attack', sector, text: 'attack' });
    if (item === 'spotlight' && sector) add({ kind: 'spot', sector, text: 'spot' });
  }
  T.markStack = (T.markStack || []).concat([ids]); buzz(); save(); render(); paintOverlay();
}
/* tapping the sector of a declaration again removes it */
function markSector(sec) {
  const kind = T.markKind || 'noise', turn = T.markTurn || S.turn, who = nameOfKey(T.markKey);
  const [k, item] = kind.split(':'), want = k === 'item' ? (item === 'attack' ? 'attack' : 'spot') : k;
  const hit = S.log.find(e => !e.mine && e.who === who && e.turn === turn && e.sector === sec && e.kind === want);
  if (hit) {
    const gone = new Set([hit.id]); if (k === 'item') { const it = S.log.find(e => e.kind === 'item' && !e.mine && e.who === who && e.turn === turn && e.text === item); if (it) gone.add(it.id); }
    S.log = S.log.filter(e => !gone.has(e.id)); buzz(); save(); render(); paintOverlay(); return;
  }
  declare(k, sec, item);
  if (k === 'item') T.markKind = 'noise';
}
function undoDeclaration() {
  const ids = (T.markStack || []).pop(); if (!ids) return;
  S.log = S.log.filter(e => !ids.includes(e.id)); save(); render(); paintOverlay();
}
function markBanner() {
  const who = T.markKey ? nameOfKey(T.markKey) : null, kind = T.markKind || 'noise', onSector = kind === 'noise' || kind === 'attack' || kind.startsWith('item:');
  const chip = ([k, ic, n]) => `<button class="dchip" data-act="markkind" data-k="${k}" aria-pressed="${kind === k || (k === 'item' && kind.startsWith('item:'))}">${gico(k === 'attack' ? 'claws' : k === 'secure' ? 'silent' : k === 'item' ? 'teleport' : ic, 26)}<span>${t(n)}</span></button>`;
  return `<div class="banner mark"><div>${!who ? t('Pick the player in the strip on the left, or add one with +.') : onSector ? t('{p}: tap the sector on the map. Tap again to remove it.', { p: esc(who) }) : t('{p}: tap what they declared.', { p: esc(who) })}</div>
    <div class="dchips" role="group" aria-label="${t('What they declared')}">${DECL.map(chip).join('')}</div>
    <div class="row tight"><span class="mturn">${t('Turn')} <button class="btn" data-act="mturn" data-d="-1" aria-label="−">−</button><b>${T.markTurn || S.turn}</b><button class="btn" data-act="mturn" data-d="1" aria-label="+">+</button></span><button class="btn" data-act="markundo" ${(T.markStack || []).length ? '' : 'disabled'}>${t('Undo')}</button><button class="btn primary" data-act="markmode">${t('Done')}</button></div></div>`;
}
function markItemSheet() {
  dlg.innerHTML = `<h2>${t('Item played')}</h2><div class="stack">${Object.keys(ITEMS).map(k => `<button class="btn withico" data-act="markitem" data-i="${k}">${gico(k, 38)}<span>${t(ITEMS[k][0])}<small>${t(ITEMS[k][1])}</small></span></button>`).join('')}</div><div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
const STICKER_PATH = { alert: 'M12 4v10M12 19v.01', ask: 'M9 9a3 3 0 116 0c0 2-3 2.2-3 5M12 19v.01', alien: 'M12 4c4 0 7 3 7 7 0 4-3 8-7 9-4-1-7-5-7-9 0-4 3-7 7-7zM8.5 11l2.5 1M15.5 11L13 12', crew: 'M12 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7zM5 20c0-4 3-6 7-6s7 2 7 6', skull: 'M12 4c4 0 7 3 7 7 0 2-1 3-2 4v3H7v-3c-1-1-2-2-2-4 0-4 3-7 7-7zM9.5 11.5v.01M14.5 11.5v.01M10 20v-2M14 20v-2', star: 'M12 4l2.5 5 5.5.8-4 3.9.9 5.5-4.9-2.6L7.1 19.2 8 13.7 4 9.8 9.5 9z' };
const STICKERS = Object.keys(STICKER_PATH), LEGACY_STICKER = { '❗': 'alert', '❓': 'ask', '👽': 'alien', '🧑': 'crew', '☠️': 'skull', '⭐': 'star' };
const stickerKey = k => STICKER_PATH[k] ? k : LEGACY_STICKER[k] || 'alert';
const stickerIco = (k, s = 24) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${STICKER_PATH[stickerKey(k)]}"/></svg>`;
function paintNotes() {
  const g = $('#notes'); if (!g) return; g.textContent = '';
  if (!S.role) return;
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
/* a Character's own symbol, without the printed hexagon, fitted to a square: drawn in the player's colour square */
const GLYPH_BOX = new Map();
function charGlyph(ch, size = 18) {
  const n = CHAR_ICON[ch], art = n && GI_ART[n]; if (!art) return '';
  const head = art.slice(0, art.indexOf('>') + 1), paths = (art.match(/<path[^>]*>/g) || []).filter(x => !/#231f20/.test(x) && !(/fill="none"/.test(x) && x.length > 600)).map(x => x.replace(/#44aae4|#ed1570/g, 'currentColor')).join('');
  if (!GLYPH_BOX.has(n)) {   // measured once: every symbol gets the same margin, none is cut
    let vb = '-30 -28 60 56';
    try {
      const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('style', 'position:absolute;width:0;height:0;visibility:hidden'); s.innerHTML = head + paths + '</g>'; document.body.appendChild(s);
      const g = s.firstElementChild, b = g.getBBox(), m = g.transform.baseVal.consolidate().matrix, w = b.width * m.a, h = b.height * m.d, sz = Math.max(w, h) * 1.14, cx = b.x * m.a + m.e + w / 2, cy = b.y * m.d + m.f + h / 2; s.remove();
      if (sz > 0) vb = [cx - sz / 2, cy - sz / 2, sz, sz].map(v => v.toFixed(2)).join(' ');
    } catch (_) { /* no layout yet: the default box */ }
    GLYPH_BOX.set(n, vb);
  }
  return `<svg class="glyph" viewBox="${GLYPH_BOX.get(n)}" width="${size}" height="${size}" aria-hidden="true">${head}${paths}</g></svg>`;
}
/* a player as a small bubble (colour square, ? or Character, faction outline): the same sign in the log, the sheet and the filters */
function miniBubble(k) {
  const f = factOf(k), known = k !== 'me' && !!f.role, ch = k === 'me' ? (S.reborn ? '' : S.char) : f.char;
  return `<span class="mb${known ? ' known' : ''}" style="--c:${pal(k)[0]};--t:${pal(k)[1]};--b:${borderOf(k)}">${ch && CHAR_ICON[ch] ? charGlyph(ch, 14) : k === 'me' ? '' : '?'}</span>`;
}
/* the last thing a player did, as the game's icon, and the turn */
function lastAct(k) {
  const e = S.log.find(x => playerKey(x) === k && ['noise', 'silence', 'attack', 'spot', 'item', 'hatch', 'reveal', 'out'].includes(x.kind)); if (!e) return '';
  const ic = e.kind === 'out' ? gico(String(e.text).startsWith('escaped') ? 'pod-green' : 'killed', 18) : logIcon(e, 18);
  return ic ? `<span class="pa" title="${esc(entryText(e))}">${ic}<i>${esc(e.turn)}</i></span>` : '';
}
const pCompact = () => { if (T.pcompact === undefined) { try { T.pcompact = localStorage.getItem('eftaios.pcompact') === '1'; } catch (_) { T.pcompact = false; } } return T.pcompact; };
/* the player whose turn it is, as a bubble key */
function curKey() {
  const u = S.hot ? (window.Hot && Hot.curId && Hot.curId()) : T.turnState && T.turnState.uid;
  return !u || gameOver() ? '' : u === myId() ? 'me' : 'u:' + u;
}
/* the players in the strip, in turn order, me in my own seat */
function stripPlayers() {
  const ps = knownPlayers(), ord = tableOrder(), me = [['me', t('Me')]];
  if (!S.role || ord.indexOf(myId()) < 0) return me.concat(ps);
  const byKey = new Map(ps), out = [];
  ord.forEach(u => { if (u === myId()) out.push(me[0]); else if (byKey.has('u:' + u)) out.push(['u:' + u, byKey.get('u:' + u)]); });
  ps.forEach(([k, n]) => { if (!out.some(o => o[0] === k)) out.push([k, n]); });
  return out;
}
/* one player in the strip: outline = faction (thick: everybody knows it; thin: your guess), the square shows ? or the
   Character, then the last action and the cards. Tapping the square guesses the faction (full view only), the rest picks the player for the map. */
function playerBubble(k, n) {
  const f = factOf(k), known = k !== 'me' && !!f.role, guess = !known && k !== 'me' && !!(S.sus && S.sus[k]), picked = (T.focusSet || []).includes(k), any = (T.focusSet || []).length;
  const ch = k === 'me' ? (S.reborn ? '' : S.char) : f.char, sq = ch && CHAR_ICON[ch] ? charGlyph(ch, pCompact() ? 20 : 18) : k === 'me' ? '' : '?';
  const cn = digital() ? (cardCounts()[k] || {}).down || 0 : null, out = outMark(k), act = out && !/conv/.test(out) ? `<span class="pa">${out}</span>` : lastAct(k);   // out of the game: that is the status
  const cls = `pb${known ? ' known' : guess ? ' guess' : ''}${picked ? ' picked' : any ? ' off' : ''}${out ? ' isout' : ''}${k === curKey() ? ' cur' : ''}`, st = `--c:${pal(k)[0]};--t:${pal(k)[1]};--b:${borderOf(k)}`;
  const why = known ? ' · ' + t(f.role === 'alien' ? 'Alien: the table has seen it' : 'Human: the table has seen it') : '', label = esc(n) + esc(why) + (out ? ' · ' + t(/esc/.test(out) ? 'escaped' : /conv/.test(out) ? 'Killed as a Human: now an Alien' : 'eliminated') : '');
  const tick = picked ? `<span class="ptick">${ico('check', 11)}</span>` : '';
  const cards = cn === null ? '' : `<span class="pcd" title="${esc(t('{n} cards face down', { n: cn }))}"><i></i>${cn}</span>`;
  if (pCompact()) return `<button data-act="pfocus" data-k="${esc(k)}" aria-pressed="${picked}" aria-label="${label}" title="${esc(n)}" class="${cls} mini" style="${st}"><span class="psq">${sq}</span>${cards}${act}${tick}</button>`;
  const sqEl = known || k === 'me' ? `<span class="psq">${sq}</span>` : `<button class="psq" data-act="pguess" data-k="${esc(k)}" aria-label="${esc(t('Your suspicion'))}: ${esc(n)}">${sq}</button>`;
  return `<div class="${cls}" style="${st}">${sqEl}<button class="pbody" data-act="pfocus" data-k="${esc(k)}" aria-pressed="${picked}" aria-label="${label}" title="${esc(n)}">${picked ? `<span class="pnm">${esc(shortName(n))}</span>` : ''}${act}<span class="psp"></span>${cards}</button>${tick}</div>`;
}
/* the faction guess: three big buttons beside the bubble */
function guessPop(k, from) {
  closeGuess(); const st = $('#stage'); if (!st || !from) return;
  const r = from.getBoundingClientRect(), s = st.getBoundingClientRect(), g = suspicion(k), d = document.createElement('div');
  d.id = 'guesspop'; d.className = 'guesspop'; d.setAttribute('role', 'group'); d.setAttribute('aria-label', t('Your suspicion'));
  d.innerHTML = [['', '?', 'u'], ['human', t('Human'), 'h'], ['alien', t('Alien'), 'a']].map(([v, l, c]) => `<button data-act="sus" data-k="${esc(k)}" data-v="${v}" class="${c}" aria-pressed="${g === v}"><i></i>${l}</button>`).join('');
  st.appendChild(d);
  const left = r.right - s.left + 10, top = Math.max(4, Math.min(st.clientHeight - d.offsetHeight - 4, r.top - s.top + r.height / 2 - d.offsetHeight / 2));
  d.style.left = Math.min(left, st.clientWidth - d.offsetWidth - 4) + 'px'; d.style.top = top + 'px';
  setTimeout(() => document.addEventListener('pointerdown', closeGuessOut, true), 0);
}
function closeGuessOut(e) { if (!e.target.closest('#guesspop')) closeGuess(); }
function closeGuess() { const d = $('#guesspop'); if (d) d.remove(); document.removeEventListener('pointerdown', closeGuessOut, true); }
function renderMkBar() {
  const bar = $('#mkbar'); if (!bar) return;
  const ps = S.role ? knownPlayers() : [];
  const manual = S.track === 'manual';
  if (!ps.length && !manual) { bar.hidden = true; return; }
  bar.hidden = false; bar.classList.toggle('compact', !T.markMode && pCompact()); bar.classList.toggle('marking', !!T.markMode);
  const turns = `<button class="mkt" data-act="mkall" aria-pressed="${!!T.rng}" aria-label="${t('Turn slider')}"><b>${T.rng ? (T.rng[0] === T.rng[1] ? 'T' + T.rng[0] : T.rng[0] + '–' + T.rng[1]) : mkN() || t('All')}</b><span>${T.rng ? t('turns') : mkN() === 1 ? t('turn') : t('turns')}</span></button>`;
  const mark = manual ? `<button class="mkh" data-act="markmode" aria-pressed="${!!T.markMode}" aria-label="${t('Record what the other players declare')}">${ico('pencil', 20)}</button>` : '';
  if (T.markMode) {
    bar.innerHTML = turns + mark + ps.map(([k, n]) => `<button data-act="markwho" data-k="${esc(k)}" aria-pressed="${T.markKey === k}" aria-label="${esc(n)}" title="${esc(n)}">${dotIcon(k)}<span>${esc(shortName(n))}</span></button>`).join('') +
      (!Sync.code && !S.hot && ps.length < 7 ? `<button class="mkt" data-act="addplayer" aria-label="${t('Add player')}"><b>+</b></button>` : '');
    return;
  }
  const nT = T.rng ? T.rng[1] - T.rng[0] + 1 : (mkN() || Math.max(1, S.turn));
  const turnsBtn = `<button class="mkh" data-act="mkall" aria-pressed="${!!T.rng}" aria-label="${t('Turn slider')}: ${nT}"><b>${nT}</b></button>`;
  const head = `<div class="mkhead">${turnsBtn}<button class="mkh" data-act="pshowall" aria-pressed="${!(T.focusSet || []).length}" aria-label="${t('Show all')}">${ico('eye', 20)}</button><button class="mkh" data-act="pcompact" aria-pressed="${pCompact()}" aria-label="${t(pCompact() ? 'Expand the players' : 'Compress the players')}">${ico(pCompact() ? 'expandr' : 'collapsel', 20)}</button><button class="mkh" data-act="routes" aria-pressed="${!!S.routesOn}" aria-label="${t('Show the routes')}">${ROUTE_ICO}</button>${mark}</div>`;
  bar.innerHTML = head + stripPlayers().map(([k, n]) => playerBubble(k, n)).join('');
}
function follow(k) { followSet(k ? [k] : []); }
/* the players picked on the bar: one player shows only them; several show exactly those; none shows everybody */
function followSet(keys) {
  T.focusSet = keys.slice(); T.focus = keys.length === 1 ? keys[0] : null; paintOverlay();
  if (!keys.length) return;
  const secs = [];
  keys.forEach(k => {
    if (k === 'me') return secs.push(...S.path.map(p => p.pos), ...ownSteps().bluffs.map(b => b.sector));
    const fz = followZone(k); secs.push(...trackOf(k).map(v => v.sector), ...(fz ? [...fz.zone.keys()] : []));
  });
  frameSectors(secs);
}
/* tapping a player on the bar adds or removes them from the picked set */
function pickPlayer(k) {
  const cur = T.focusSet || [];
  followSet(cur.includes(k) ? cur.filter(x => x !== k) : cur.concat([k]));
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
  paintMoveBtns();
  mapwrap.style.willChange = 'transform'; clearTimeout(applyView.t); applyView.t = setTimeout(() => { mapwrap.style.willChange = 'auto'; }, 220);
}
function fit() {
  const r = stageRect(); if (!r.width) return;
  fitK = Math.min(r.width / mapW, r.height / mapH) * 0.98; view.k = fitK;
  view.x = (r.width - mapW * fitK) / 2; view.y = (r.height - mapH * fitK) / 2; applyView();
  fitView = { k: view.k, x: view.x, y: view.y }; stageSize = [r.width, r.height];
}
function zoomAt(f, cx, cy) {
  const k = Math.max(fitK * 0.7, Math.min(fitK * 9, view.k * f)), s = k / view.k;
  view.x = cx - (cx - view.x) * s; view.y = cy - (cy - view.y) * s; view.k = k; applyView();
}
function focusOn(id) {
  const p = parseId(id); if (!p) return; const r = stageRect(), h = hexPos(T.map, p[0], p[1]);
  view.k = Math.max(view.k, Math.min(fitK * 2.2, 2.2)); view.x = r.width / 2 - h.x * view.k; view.y = r.height / 2 - h.y * view.k; applyView();
}

/* ---------------- notes: stamps and drawings on the map ----------------
   The annotate bar stays open until you press Done. Stamp: tap to place as many as you like. Pen: free lines.
   Line: a straight line. Eraser: tap or drag over a stamp or line. Clear all removes everything. */
// the colours of the game: Alien red, Human blue, Undecided yellow, the eight players' colours, black and white
const ANNO_COLORS = ['#ff3b30', '#2f7dff', '#ffd23f', ...PALETTE.map(p => p[0]), '#000000', '#ffffff'];
const ANNO_TOOLS = [['stamp', 'Stamp', 'M12 3l2.6 5.6 6 .7-4.4 4.1 1.2 6L12 16.4 6.6 19.4l1.2-6L3.4 9.3l6-.7z'], ['pen', 'Pen', 'M4 20c3-1 5-4 6-7 1-3 3-5 6-6M14 5l5 5'], ['line', 'Line', 'M5 19L19 5M4 20h2v-2M18 6h2V4'], ['text', 'Text', 'M5 6V4h14v2M12 4v16M9 20h6'], ['move', 'Hand', 'M8 13V6.5a1.5 1.5 0 013 0V11m0-5.5a1.5 1.5 0 013 0V11m0-3.5a1.5 1.5 0 013 0V15a6 6 0 01-6 6h-1a6 6 0 01-4.6-2.2L4 15.500a1.500 1.500 0 012.300-1.900L8 15'], ['rect', 'Rectangle', 'M4 6h16v12H4z'], ['ellipse', 'Ellipse', 'M3 12a9 6.5 0 1 0 18 0a9 6.5 0 1 0-18 0'], ['erase', 'Eraser', 'M4 16l8-8 6 6-5 5H8zM14 19h6']];
const annoSvg = (d, s = 20) => `<svg class="ico" viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
function renderAnnot() {
  const bar = $('#annotbar'); if (!bar) return; const a = T.annot;
  bar.hidden = !a; const b = document.querySelector('[data-act=annot]'); if (b) b.setAttribute('aria-pressed', !!a);
  if (!a) return;
  bar.innerHTML = `<div class="atools" role="group" aria-label="${t('Tools')}">${ANNO_TOOLS.map(([k, n, d]) => `<button data-act="atool" data-t="${k}" aria-pressed="${a.tool === k}" aria-label="${t(n)}">${annoSvg(d, 20)}<span>${t(n)}</span></button>`).join('')}
      <button data-act="aundo" aria-label="${t('Undo')}">${ico('undo', 18)}</button><button class="danger" data-act="aclear" aria-label="${t('Clear all')}">${ico('cross', 18)}</button><button class="done" data-act="adone">${t('Done')}</button></div>
    <div class="aopts">${a.tool === 'stamp' ? STICKERS.map(s => `<button class="as" data-act="astamp" data-s="${s}" aria-pressed="${a.icon === s}" aria-label="${s}">${stickerIco(s, 22)}</button>`).join('') + '<i></i>' : ''}${a.tool === 'erase' ? `<small>${t('Tap or drag over a stamp or a line to erase it')}</small>` : a.tool === 'move' ? `<small>${t('Drag a stamp, text or line to move it. Drag the empty map to pan')}</small>` : ANNO_COLORS.map(c => `<button class="ac" data-act="acolor" data-c="${c}" style="--c:${c}" aria-pressed="${a.color === c}" aria-label="${c}"></button>`).join('')}</div>`;
}
const mapPt = e => { const r = stageRect(); return [(e.clientX - r.left - view.x) / view.k, (e.clientY - r.top - view.y) / view.k]; };
function paintAnnos() {
  const g = $('#annos'); if (!g) return; g.textContent = '';
  (S.annos || []).forEach(n => annoShape(g, n));
  if (T.stroke && T.stroke.pts) annoShape(g, { type: T.stroke.tool === 'rect' || T.stroke.tool === 'ellipse' ? 'shape' : 'line', kind: T.stroke.tool, color: T.annot ? T.annot.color : '#fff', pts: T.stroke.pts, prev: true });
}
/* the outline of a drawn rectangle or ellipse (from one corner to the opposite one), as a closed polyline */
function shapeOutline(n) {
  const [a, b = a] = n.pts;   // while dragging the far corner is still the start point
  if (n.kind === 'rect') return [[a[0], a[1]], [b[0], a[1]], [b[0], b[1]], [a[0], b[1]], [a[0], a[1]]];
  const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2, rx = Math.abs(b[0] - a[0]) / 2, ry = Math.abs(b[1] - a[1]) / 2;
  const out = Array.from({ length: 49 }, (_, i) => { const t = i / 48 * 2 * Math.PI; return [cx + rx * Math.cos(t), cy + ry * Math.sin(t)]; });
  return out;
}
function annoShape(g, n) {
  if (n.type === 'shape') { const o = shapeOutline(n); el('path', { d: 'M' + o.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L') + 'Z', class: 'aline', stroke: n.color, fill: 'none' }, g); return; }
  if (n.type === 'stamp') {
    const s = el('g', { class: 'astamp', transform: `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})` }, g);
    el('rect', { x: -7, y: -7, width: 14, height: 14, rx: 3.4, fill: n.color }, s);
    el('path', { d: STICKER_PATH[stickerKey(n.icon)], class: 'sglyph', transform: 'translate(-5.4 -5.4) scale(.45)' }, s);
  } else if (n.type === 'text') {
    const x = el('text', { x: n.x.toFixed(1), y: n.y.toFixed(1), class: 'atext', fill: n.color, 'text-anchor': 'middle', 'dominant-baseline': 'central' }, g); x.textContent = n.text;
  } else {
    el('path', { d: 'M' + n.pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L'), class: 'aline', stroke: n.color, fill: 'none' }, g);
  }
}
function segDist(p, a, b) { const dx = b[0] - a[0], dy = b[1] - a[1], l2 = dx * dx + dy * dy || 1, t_ = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)); return Math.hypot(p[0] - a[0] - t_ * dx, p[1] - a[1] - t_ * dy); }
function annoNear(n, p, R_) {
  if (n.type === 'stamp') return Math.hypot(n.x - p[0], n.y - p[1]) < 9 + R_ / 2;
  if (n.type === 'text') return Math.abs(n.x - p[0]) < n.text.length * 2.6 + 3 && Math.abs(n.y - p[1]) < 7;
  if (n.type === 'shape') { const o = shapeOutline(n); return o.some((q, j) => j && segDist(p, o[j - 1], q) < R_); }
  return n.pts.some((q, j) => j && segDist(p, n.pts[j - 1], q) < R_) || (n.pts.length === 1 && Math.hypot(n.pts[0][0] - p[0], n.pts[0][1] - p[1]) < R_);
}
function annoHit(p) {
  const R_ = 6 / Math.max(0.6, view.k / (fitK || 1)), list = S.annos || [];
  for (let i = list.length - 1; i >= 0; i--) if (list[i].type !== 'line' && annoNear(list[i], p, R_)) return i;
  for (let i = list.length - 1; i >= 0; i--) if (list[i].type === 'line' && annoNear(list[i], p, R_)) return i;
  return -1;
}
function textDlg(title, init, ok) {
  dlg.innerHTML = `<h2>${esc(title)}</h2><input id="d-txt" maxlength="40" value="${esc(init || '')}" style="width:100%;box-sizing:border-box;margin:8px 0"><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn primary" id="d-yes">OK</button></div>`;
  dlg.showModal(); const inp = $('#d-txt'); inp.focus(); inp.select();
  const go = () => { const v = inp.value.trim(); closeDlg(); ok(v); };
  $('#d-no').onclick = closeDlg; $('#d-yes').onclick = go; inp.onkeydown = ev => { if (ev.key === 'Enter') go(); };
}
function annoText(e) {
  const p = mapPt(e), list = S.annos = S.annos || [], i = annoHit(p), old = i >= 0 && list[i].type === 'text' ? list[i] : null, color = T.annot.color;
  textDlg(t('Text note'), old ? old.text : '', v => {
    if (old) { if (v) old.text = v; else list.splice(list.indexOf(old), 1); }
    else if (v) list.push({ type: 'text', text: v, color, x: +p[0].toFixed(1), y: +p[1].toFixed(1) });
    save(); paintAnnos();
  });
}
function annoErase(p, all) {
  const R_ = 8 / Math.max(0.6, view.k / (fitK || 1)), list = S.annos || []; let hit = false;
  for (let i = list.length - 1; i >= 0; i--) {
    if (annoNear(list[i], p, R_)) { list.splice(i, 1); hit = true; if (!all) break; }
  }
  const notes = S.notes || [];
  for (let i = notes.length - 1; i >= 0; i--) { const q = parseId(notes[i].sector), h = q && hexPos(T.map, q[0], q[1]); if (h && Math.hypot(h.x - 11 - p[0], h.y - 11 - p[1]) < 10) { notes.splice(i, 1); hit = true; if (!all) break; } }
  if (hit) { save(); paintAnnos(); paintNotes(); }
  return hit;
}
function annoStart(e) {
  const p = mapPt(e), a = T.annot; try { stage.setPointerCapture(e.pointerId); } catch (_) { /* noop */ }
  T.stroke = { tool: a.tool, pts: [p], start: p };
  if (a.tool === 'erase') annoErase(p, true);
  paintAnnos();
}
function annoMove(e) {
  const p = mapPt(e), s = T.stroke;
  if (s.tool === 'erase') { annoErase(p, true); return; }
  if (s.tool === 'move') {
    const n = S.annos[s.idx], dx = p[0] - s.last[0], dy = p[1] - s.last[1]; s.last = p; if (!n) return;
    if (n.pts) n.pts = n.pts.map(q => [+(q[0] + dx).toFixed(1), +(q[1] + dy).toFixed(1)]); else { n.x = +(n.x + dx).toFixed(1); n.y = +(n.y + dy).toFixed(1); }
    s.did = true; paintAnnos(); return;
  }
  if (s.tool === 'line' || s.tool === 'rect' || s.tool === 'ellipse') s.pts = [s.start, p];
  else { const l = s.pts[s.pts.length - 1]; if (Math.hypot(p[0] - l[0], p[1] - l[1]) > 2.2) s.pts.push(p); }
  paintAnnos();
}
function annoEnd() {
  const s = T.stroke; T.stroke = null; if (!s) return;
  if (s.tool === 'move') { if (s.did) save(); paintAnnos(); return; }
  if (s.tool !== 'erase') {
    const pts = s.pts.map(p => [+p[0].toFixed(1), +p[1].toFixed(1)]), len = pts.reduce((m, p, i) => i ? m + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) : 0, 0);
    if (s.tool === 'rect' || s.tool === 'ellipse') {
      const a = pts[0], b = pts[pts.length - 1];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 5) { (S.annos = S.annos || []).push({ type: 'shape', kind: s.tool, color: T.annot.color, pts: [a, b] }); save(); }
    } else if (len > 5) { (S.annos = S.annos || []).push({ type: 'line', color: T.annot.color, pts: pts.length > 160 ? pts.filter((_, i) => i % 2 === 0 || i === pts.length - 1) : pts }); save(); }
  }
  paintAnnos();
}
function annoStamp(e) {
  const p = mapPt(e); (S.annos = S.annos || []).push({ type: 'stamp', icon: T.annot.icon, color: T.annot.color, x: +p[0].toFixed(1), y: +p[1].toFixed(1) });
  save(); paintAnnos(); buzz();
}
const annoActions = {
  annot() { T.annot = T.annot ? null : { tool: 'stamp', icon: 'alert', color: ANNO_COLORS[2] }; T.stroke = null; renderAnnot(); paintAnnos(); },
  adone() { T.annot = null; T.stroke = null; renderAnnot(); paintAnnos(); },
  atool(b) { T.annot.tool = b.dataset.t; renderAnnot(); },
  astamp(b) { T.annot.icon = b.dataset.s; renderAnnot(); },
  acolor(b) { T.annot.color = b.dataset.c; renderAnnot(); },
  aundo() { if ((S.annos || []).length) { S.annos.pop(); save(); paintAnnos(); } },
  aclear() { if (!(S.annos || []).length && !(S.notes || []).length) return toast(t('Nothing to erase')); confirmDlg(t('Erase everything?'), t('All your stamps, drawings and notes on the map will be removed.'), () => { S.annos = []; S.notes = []; save(); paintAnnos(); paintNotes(); }); }
};

/* pointer: pan, pinch, tap */
const ptrs = new Map(); let drag = null, moved = false, pinch0 = null;
const onMapUi = e => !!(e.target.closest && e.target.closest('button, .mkbar, .zoom, .inspect, .followbar, .annotbar'));
stage.addEventListener('pointerdown', e => {
  if (onMapUi(e)) return;
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  const lmb = e.pointerType !== 'mouse' || e.button === 0;   // the middle and right mouse buttons always pan
  if (!lmb) e.preventDefault();
  if (T.annot && lmb && ptrs.size === 1 && ['pen', 'line', 'rect', 'ellipse', 'erase'].includes(T.annot.tool)) { annoStart(e); drag = null; return; }
  if (T.annot && lmb && ptrs.size === 1 && T.annot.tool === 'move') {
    const p = mapPt(e), idx = annoHit(p);
    if (idx >= 0) { try { stage.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } T.stroke = { tool: 'move', idx, last: p }; drag = null; return; }
  }
  if (ptrs.size === 2 && T.stroke) { T.stroke = null; paintAnnos(); }
  if (ptrs.size === 1) { drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, target: e.target, lmb }; moved = false; }
  else if (ptrs.size === 2) {
    const [a, b] = [...ptrs.values()], r = stageRect();
    pinch0 = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, vx: view.x, vy: view.y, cx: (a.x + b.x) / 2 - r.left, cy: (a.y + b.y) / 2 - r.top }; moved = true;
  }
});
stage.addEventListener('pointermove', e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (T.stroke && ptrs.size === 1) { annoMove(e); return; }
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
stage.addEventListener('contextmenu', e => { if (T.annot) e.preventDefault(); });
const endPtr = e => {
  if (!ptrs.has(e.pointerId)) return; ptrs.delete(e.pointerId);
  if (T.stroke) { if (e.type === 'pointerup' && ptrs.size === 0) annoEnd(e); else { T.stroke = null; paintAnnos(); } }
  if (e.type === 'pointerup' && ptrs.size === 0 && !moved && drag) { if (T.annot) { if (drag.lmb) { if (T.annot.tool === 'stamp') annoStamp(e); else if (T.annot.tool === 'text') annoText(e); } } else { const g = drag.target.closest && drag.target.closest('[data-id]'); if (g) onCell(g.dataset.id); } }
  if (ptrs.size === 0) { drag = null; pinch0 = null; }
};
stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
stage.addEventListener('wheel', e => { if (onMapUi(e)) return; e.preventDefault(); const r = stageRect(); zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
let fitDone = false, fitView = null, stageSize = null;
/* the map follows its stage: refit when the view was still the fitted one, otherwise keep the same map point in the centre
   (a phone turned sideways, a resized window, the panel folded away) */
new ResizeObserver(() => {
  if (!T.map) return;
  const r = stageRect(); if (!r.width) return;
  if (!fitDone) { fit(); fitDone = true; stageSize = [r.width, r.height]; return; }
  if (stageSize && Math.abs(r.width - stageSize[0]) < 1 && Math.abs(r.height - stageSize[1]) < 1) return;
  const was = stageSize || [r.width, r.height]; stageSize = [r.width, r.height];
  const untouched = fitView && Math.abs(view.k - fitView.k) < 1e-6 && Math.abs(view.x - fitView.x) < 0.5 && Math.abs(view.y - fitView.y) < 0.5;
  if (untouched) fit(); else { fitK = Math.min(r.width / mapW, r.height / mapH) * 0.98; view.x += (r.width - was[0]) / 2; view.y += (r.height - was[1]) / 2; applyView(); }
}).observe(stage);

/* ---------------- game logic ---------------- */
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36);
const PUBLIC = ['noise', 'attack', 'spot', 'silence', 'hatch', 'item', 'reveal', 'out'];
function say(text, kind, sector, extra = {}) {
  const e = Object.assign({ id: uid(), by: myId() || '', turn: S.turn, who: S.name || t('Me'), kind, sector: sector || null, text: text || kind, mine: !S.hot, at: Date.now() }, extra);
  /* the checkpoint goes out before the announcement, so a crash cannot leave the table ahead of the seat */
  if (S.online && Sync.code) flushSeat();
  S.log.unshift(e);
  if (window.Sync && Sync.code && (PUBLIC.includes(kind) || killOf(e))) Sync.push({ id: e.id, by: Sync.uid, turn: e.turn, who: e.who, kind, sector: e.sector || '', text: e.text, at: e.at, n: e.n || 0, ok: e.ok ? 1 : 0 });
  if (S.log.length > 400) S.log.length = 400;
}
/* the printed icons for what a player declared on one turn, for the marker of that step (at most two):
   an attack, then items, then Silence or Silent Sector, then Noise. A bluffed Noise is a "Noise in any sector". */
function stepIcons(key, turn, here, role) {
  if (key === 'bluff') return ['noise-any'];
  const out = [], add = n => { if (n && !out.includes(n)) out.push(n); }, es = S.log.filter(e => e.turn === turn && playerKey(e) === key);
  es.filter(e => e.kind === 'attack' && e.sector === here).forEach(() => add((key === 'me' ? S.role : role || factOf(key).role) === 'human' || es.some(x => x.kind === 'item' && x.text === 'attack') ? 'attack' : 'claws'));   // a Human attacks with the Attack card, an Alien with claws
  es.filter(e => e.kind === 'item' && GI_ART[e.text]).forEach(e => add(e.text));
  es.filter(e => e.kind === 'silence').forEach(e => add(e.text === 'secure' ? 'silent' : 'silence'));
  if (es.some(e => e.kind === 'noise' && (key !== 'me' || e.sector === here))) add('noise-here');
  return out.slice(0, 3);
}
/* the icons of a step stacked down the right of the marker (one sits at the top); the killed badge is on the left, so nothing overlaps */
function stepBadges(g, icons, size) {
  const n = icons.length, w = size * (n > 2 ? 1.5 : 1.9), h = w * 0.92;
  icons.forEach((nm, j) => { const cy = n === 1 ? -size * 0.9 : (j - (n - 1) / 2) * h * 1.04; el('use', { href: '#gi-' + nm, x: (size * 0.95 - w / 2).toFixed(1), y: (cy - h / 2).toFixed(1), width: w.toFixed(1), height: h.toFixed(1) }, g); });
}
/* the printed icon that goes with a log line, if there is one */
function logIcon(e, w = 18) {
  if (e.kind === 'noise') return gico('noise-here', w);
  if (e.kind === 'silence') return gico(e.text === 'secure' ? 'silent' : 'silence', w);
  if (e.kind === 'attack') return gico(S.log.some(x => x.kind === 'item' && x.text === 'attack' && x.turn === e.turn && playerKey(x) === playerKey(e)) ? 'attack' : 'claws', w);
  if (e.kind === 'reveal') { const i = typeof revealInfo === 'function' && revealInfo(e); if (i && CHAR_ICON[i.char]) return gico(CHAR_ICON[i.char], w); }
  if (e.kind === 'reveal' && String(e.text).startsWith('Id|')) return '';
  if (e.kind === 'reveal') return gico(e.text === 'Sensor' ? 'sensor' : e.text === 'Invisible Alien' || e.text === 'Brute Alien' || e.text === 'Identity' ? 'killed' : 'spotlight', w);
  if (e.kind === 'spot') return gico('spotlight', w);
  if (e.kind === 'item') return gico(e.text, w);
  if (e.kind === 'hatch' && e.n) return gico(e.ok ? 'pod-green' : 'pod-red', w);
  if (e.kind === 'out' && String(e.text).startsWith('killed') || killOf(e)) return gico('killed', w);
  return '';
}
/* an 'info' line written by the attacker when someone dies: "kill|victim|role" */
const killOf = e => (e && e.kind === 'info' && String(e.text).startsWith('kill|')) ? String(e.text).split('|')[1] : '';
/* announcements are rendered from structured data so each player sees them in their own language */
function entryText(e) {
  const s = e.sector;
  if (e.kind === 'noise') return t('Noise in Sector {s}', { s });
  if (e.kind === 'attack') { if (typeof digital === 'function' && !digital()) return t('Attack in Sector {s}', { s }); const card = S.log.some(x => x.turn === e.turn && playerKey(x) === playerKey(e) && ((x.kind === 'item' && x.text === 'attack') || (x.kind === 'reveal' && String(x.text).startsWith('Id|human')))); return t('Attack in Sector {s}', { s }) + (playerKey(e) === 'me' ? '' : card ? ' · ' + t('Attack card') : ' · ' + t('Alien')); }
  if (e.kind === 'spot') return t('Spotlight on Sector {s}', { s });
  if (e.kind === 'silence') return t(e.text === 'secure' ? 'Silent Sector' : 'Silence in all Sectors');
  if (e.kind === 'hatch' && e.n) return t(e.ok ? 'Escape Pod {n}: escaped' : 'Escape Pod {n}: damaged', { n: e.n });
  if (e.kind === 'item') return t('plays {i}', { i: t(((typeof ITEMS !== 'undefined' && ITEMS[e.text]) || [e.text])[0]) });
  if (e.kind === 'reveal' && String(e.text).startsWith('Id|')) { const [, role, ch] = e.text.split('|'); return t('identity revealed') + ': ' + roleLabel(role, ch); }
  if (e.kind === 'reveal') return e.text === 'Invisible Alien' || e.text === 'Brute Alien' ? t('{c}: identity revealed', { c: t(e.text) }) : e.text === 'Identity' ? t('identity revealed') : t('Position revealed: {s}', { s });
  if (killOf(e)) { const [, , role] = String(e.text).split('|'); return t('killed {p}', { p: killOf(e) }) + (role ? ' (' + t(role === 'alien' ? 'Alien' : 'Human') + ')' : '') + (s ? ' ' + t('in Sector {s}', { s }) : ''); }
  if (e.kind === 'out') { const [why, role, ch] = String(e.text).split('|'); return t(why === 'escaped' ? 'escaped' : why === 'trapped' ? 'is trapped and out of the game' : 'was eliminated') + ' (' + t(role === 'alien' ? 'Alien' : 'Human') + (ch ? ', ' + t(ch) : '') + ')' + (why === 'killed' && role === 'human' ? ' · ' + t('restarts as an Alien') : ''); }
  return t(e.text);
}
function toast(msg) { const el = $('#toast'); el.textContent = msg; el.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => el.hidden = true, 2600); }
/* a bot takes its time: a visible "thinking" phase (the lines do not depend on the bot's role or cards, so they give nothing away).
   cover = hide the screen while a bot thinks (several people share the device). window.__botPace scales the time (0 = none, for tests). */
const BOT_LINES = ['Reading the announcements…', 'Placing the other players on the map…', 'Weighing the options…', 'Choosing a sector…'];
function botThinking(name, ms, cover) {
  const pace = typeof window.__botPace === 'number' ? window.__botPace : 1; ms = Math.round(ms * pace);
  if (ms <= 0) return Promise.resolve();
  return new Promise(res => {
    const bar = $('#botthink'), stage = $('#stage'); let i = 0;
    const draw = () => { bar.innerHTML = `<span class="bt-dots" aria-hidden="true"><i></i><i></i><i></i></span><span><b>${esc(name)}</b><small>${t(BOT_LINES[Math.min(i, BOT_LINES.length - 1)])}</small></span>`; };
    bar.className = 'botthink' + (cover ? ' cover-all' : ''); draw(); bar.hidden = false; if (stage) stage.classList.add('thinking'); document.body.classList.add('botturn');
    const tick = setInterval(() => { i++; draw(); }, Math.max(350, ms / BOT_LINES.length));
    setTimeout(() => { clearInterval(tick); bar.hidden = true; if (stage) stage.classList.remove('thinking'); document.body.classList.remove('botturn'); res(); }, ms);
  });
}
const buzz = () => { try { navigator.vibrate && navigator.vibrate(15); } catch (_) { /* noop */ } };
function selectCell(id) { T.sel = id; refreshReach(); render(); paintCells(); }
/* sectors I may move to: lit only while it is my turn and I have not moved yet */
const canMoveNow = () => S.phase === 'move' && !S.over && !!S.role && (typeof myTurn !== 'function' || myTurn()) && !(typeof gameOver === 'function' && gameOver());
function refreshReach() { T.reach = canMoveNow() ? reachable(T.map, S.pos, allowance(), S.role) : new Map(); }
const roomUrl = () => location.origin + location.pathname + '?room=' + Sync.code;
const actions = {
  hide() { $('#cover').hidden = false; },
  unhide() { $('#cover').hidden = true; },
  zin() { const r = stageRect(); zoomAt(1.4, r.width / 2, r.height / 2); },
  zout() { const r = stageRect(); zoomAt(1 / 1.4, r.width / 2, r.height / 2); },
  fit, focus() { S.pos && focusOn(S.pos); },
  tab(b) { tabClick(b.dataset.tab); },
  addann() { addDlg(); },
  clearlog() { confirmDlg(t('Clear all announcements?'), t('The history on this device will be erased.'), () => { S.log = []; afterChange(); }); },
  rematch() { Sync.rematch().then(ok => { if (!ok) toast(t('Could not start another game.')); }); },
  newgame() {
    const host = !!(Sync.code && Sync.isHost());
    const [title, body] = S.hot ? ['Close this game?', 'The pass-and-play game ends for everyone.'] : !Sync.code ? ['Start a new game?', 'Your route, notes and role will be erased.'] : host ? ['Close this game?', 'The game ends for everyone. You can then create a new one.'] : ['Leave this game?', 'You leave the game. Your route and notes on this device are erased.'];
    confirmDlg(t(title), t(body), async () => {
      if (S.hot) Hot.clear();
      if (host) await Sync.closeRoom().catch(() => {});
      Sync.leave(true); resetToWelcome('welcome');
    });
  },
  map(b) { actions.ovclose(); const m = T.maps.find(x => x.id === b.dataset.id); if (!m || m === T.map) return; confirmDlg(t('Switch map?'), t('Your position resets to the start sector of the new map.'), () => { T.map = m; S.mapId = m.id; S.pos = find(m, S.role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }]; T.sel = null; S.phase = 'move'; S.res = null; buildMap(); afterChange(); }); },
  share() { const url = roomUrl(), data = { title: 'EFTAIOS', text: t('Join my game: {c}', { c: Sync.code }), url }; if (navigator.share) navigator.share(data).catch(() => {}); else copyText(url, t('Link copied')); },
  qr() { qrDlg(); },
  lang(b) { setLang(b.dataset.l); },
  mapstyle(b) { setMapStyle(b.dataset.v); b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b)); },
  cancelpick() { T.pick = null; paintCells(); render(); },
  pickno() { if (T.pick) T.pick.sel = null; paintCells(); render(); },
  pickyes() { const p = T.pick; if (!p || !p.sel) return; T.pick = null; paintCells(); p.cb(p.sel); },
  noop() { },
  sus(b) { closeGuess(); const k = b.dataset.k, v = b.dataset.v; S.sus = S.sus || {}; if (v) S.sus[k] = v; else delete S.sus[k]; save(); render(); paintOverlay(); },
  pfocus(b) { closeGuess(); pickPlayer(b.dataset.k); },
  pguess(b) { const open = $('#guesspop'); if (open && open.querySelector(`[data-k="${CSS.escape(b.dataset.k)}"]`)) return closeGuess(); guessPop(b.dataset.k, b.closest('.pb')); },
  pshowall() { closeGuess(); followSet([]); },
  pcompact() { T.pcompact = !pCompact(); try { localStorage.setItem('eftaios.pcompact', T.pcompact ? '1' : '0'); } catch (_) { /* per device only */ } closeGuess(); paintOverlay(); },
  unfollow() { follow(null); },
  follow(b) { setTab('play'); follow(b.dataset.k); },
  markmode() { T.markMode = !T.markMode; T.markTurn = S.turn; T.markKind = 'noise'; T.markStack = []; T.focus = null; T.focusSet = []; if (T.markMode && !T.markKey) { const ps = knownPlayers(); if (ps.length === 1) T.markKey = ps[0][0]; } render(); paintOverlay(); },
  markwho(b) { T.markKey = b.dataset.k; render(); paintOverlay(); },
  markkind(b) {
    const k = b.dataset.k, who = T.markKey; if (!who) { toast(t('First pick the player, on the left.')); return; }
    if (k === 'item') { markItemSheet(); return; }
    if (k === 'silence' || k === 'secure') { declare(k); return; }
    T.markKind = k; render();
  },
  markitem(b) {
    const i = b.dataset.i; closeDlg();
    if (i === 'attack' || i === 'spotlight') { T.markKind = 'item:' + i; render(); toast(t('Tap the sector on the map.')); } else declare('item', null, i);
  },
  markundo() { undoDeclaration(); },
  mturn(b) { T.markTurn = Math.max(1, Math.min(MAX_TURN, (T.markTurn || S.turn) + +b.dataset.d)); render(); },
  addplayer() { const n = (prompt(t('Player name')) || '').trim().slice(0, 20); if (!n) return; S.extraPlayers = (S.extraPlayers || []).concat([n]); T.markKey = 'n:' + n.toLowerCase(); save(); render(); paintOverlay(); },
  noteedit(b) { $('#inspect').hidden = true; noteDlg(b.dataset.s); },
  tsec(b) { T.tableSec = b.dataset.k; render(); },
  rules() { overlay(t('How to play'), rulesHtml()); },
  maps() { overlay(t('Map'), mapsHtml()); },
  ovclose() { const o = $('#overlay'); if (o) o.remove(); },
  revealview(b) { T.showAnn = b.dataset.v === 'ann'; b.parentNode.querySelectorAll('button').forEach(x => x.setAttribute('aria-checked', x === b)); paintOverlay(); },
  routes() { S.routesOn = !S.routesOn; save(); paintOverlay(); const b = document.querySelector('[data-act=routes]'); if (b) b.setAttribute('aria-pressed', !!S.routesOn); toast(t(S.routesOn ? 'Routes shown' : 'Routes hidden')); },
  /* opening the slider shows the span you prefer; closing it keeps the span you left as the number of turns shown on the map */
  mkall() {
    if (T.rng) { const n = T.rng[1] - T.rng[0] + 1; S.mkN = n >= S.turn ? 0 : n; T.rng = null; save(); }
    else { const n = mkN() || Math.max(1, S.turn); T.rng = [Math.max(1, S.turn - n + 1), Math.max(1, S.turn)]; }
    T.rngMax = S.turn; stopPlay(); render(); paintOverlay();
  },
  tlprev() { tlShift(-1); }, tlnext() { tlShift(1); },
  tlall() { T.rng = [1, Math.max(1, S.turn)]; render(); paintOverlay(); },
  tlnow() { T.rng = [Math.max(1, S.turn), Math.max(1, S.turn)]; render(); paintOverlay(); },
  tldecoy() { T.hideDecoy = !T.hideDecoy; paintOverlay(); },
  flag(b) { const s = fakeState(b.dataset.id); setFake(b.dataset.id, s === 'd' ? 'f' : s === 'f' ? '' : 'd'); },
  fakeyes(b) { setFake(b.dataset.id, 'f'); }, fakedub(b) { setFake(b.dataset.id, 'd'); }, fakeno(b) { setFake(b.dataset.id, 'k'); },
  tlplay() { if (T.tlTimer) return stopPlay(); const keep = T.rng.slice(); let n = keep[0]; T.tlTimer = setInterval(() => { T.rng = [n, n]; render(); paintOverlay(); if (++n > S.turn) { stopPlay(); T.rng = keep; render(); paintOverlay(); } }, 900); paintOverlay(); }
};
Object.assign(actions, annoActions);
function copyText(s, msg) { (navigator.clipboard ? navigator.clipboard.writeText(s) : Promise.reject()).then(() => toast(msg), () => toast(s)); }
document.querySelectorAll('.tabs [data-tab]').forEach(b => b.addEventListener('click', () => { tabClick(b.dataset.tab); }));
document.addEventListener('click', e => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const f = actions[b.dataset.act]; if (f) { e.preventDefault(); f(b); }
});

function pickSector(label_, cb, locked) { T.pick = { label: label_, cb, locked: !!locked }; S.tab = 'play'; render(); paintCells(); hdr(); }
function onCell(id) {
  if (T.pick) { T.pick.sel = id; paintCells(); render(); return; }   // nothing is announced until the player confirms on the map
  if (T.markMode) { if (!T.markKey) toast(t('First pick the player, on the left.')); else if ((T.markKind || 'noise') === 'noise' || T.markKind === 'attack' || String(T.markKind).startsWith('item:')) markSector(id); else toast(t('That declaration has no sector. Pick Noise or Attack to mark one.')); return; }
  if (S.role && S.phase === 'move' && !S.over && T.reach.has(id)) { selectCell(id); buzz(); return; }
  T.inspect = id; paintCells();
  const i = $('#inspect'), note = (S.notes || []).find(n => n.sector === id); i.hidden = false;
  const seenHere = S.role ? S.log.filter(e => e.sector === id && ['noise', 'attack', 'spot', 'reveal', 'hatch'].includes(e.kind) && inRng(e.turn)).slice(0, 4).map(e => `<div class="ihere">${dotIcon(playerKey(e))}<b>${esc(e.mine ? t('Me') : e.who)}</b> · ${esc(t('T{n}', { n: e.turn }))} · ${esc(entryText(e))}${fakeState(e.id) === 'f' ? ' · ' + esc(t('marked fake')) : fakeState(e.id) === 'd' ? ' · ' + esc(t('dubious')) : SUGGEST.has(e.id) && !fakeState(e.id) ? ' · ' + esc(t('seems fake')) : ''}${e.mine || e.kind === 'hatch' ? '' : flagBtn(e)}</div>`).join('') : '';
  i.innerHTML = `<b>${'HA1234'.includes(at(T.map, id)) ? '' : id}</b>${esc(typeName(at(T.map, id)))}${note ? `<div class="inote">${stickerIco(note.icon, 18)} ${esc(note.text || '')} <button class="btn" data-act="noteedit" data-s="${id}">${t('Edit')}</button></div>` : ''}${seenHere}`;
  clearTimeout(onCell.h); onCell.h = setTimeout(() => { T.inspect = null; i.hidden = true; paintCells(); }, note || seenHere ? 7000 : 3500);
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
  dlg.innerHTML = `<h2>${t('Join my game')}</h2><p class="dim">${t('Scan with the phone camera, or enter the code in the app.')}</p>
    <div class="qr">${qrSvg(url)}</div><div class="say silent" style="margin:12px 0 0;text-align:center"><small>${t('Game code')}</small><b style="letter-spacing:.3em;color:var(--text)">${esc(Sync.code)}</b></div>
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
      const j = JSON.parse($('#imp').value), list = (j.maps || [j]).map((m, i) => { const p = parseMap(m), clash = !m.id || T.maps.some(x => x.id === m.id && !isCustom(x)); return { id: clash ? 'custom-' + Date.now() + '-' + i : m.id, name: p.name, rows_data: m.rows_data, oddColumnsLower: p.odd }; });
      list.forEach(m => { S.customMaps = S.customMaps.filter(x => x.id !== m.id).concat(m); });
      save(); loadMaps().then(() => { closeDlg(); if ($('#mapman')) mapManager(); toast(t('Map imported')); });
    } catch (e) { $('#imp-err').textContent = t('Could not import: {m}', { m: e.message }); }
  };
}

/* ---------------- panels ---------------- */
function setTab(k) { S.tab = k; T.collapsed = false; applyCollapse(); if (!(T.pick && T.pick.locked)) T.pick = null; save(); render(); paintCells(); hdr(); }   // a sector you must announce (the card is already drawn) waits for you on the Play tab
/* a tap on the tab that is already open hides the panel and leaves only the tab bar; a tap while hidden reopens it on that tab */
function tabClick(k) {
  if (!T.collapsed && S.tab === k) { T.collapsed = true; applyCollapse(); paintCells(); return; }
  setTab(k);
}
function applyCollapse() { document.body.classList.toggle('panel-closed', !!T.collapsed); }
function hdr() {
  document.querySelectorAll('.tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === S.tab)); document.body.dataset.tab = S.tab;
  /* the turn bar only carries what needs an action: a host who is away, paused bots, an idle player. Whose turn it is shows on the player bubbles. */
  const tb = $('#turnbar'); tb.hidden = true;
  if (Sync.code && T.turnState && !(Sync.settings && Sync.settings.status === 'over')) {
    const mine = T.turnState.uid === Sync.uid;
    const bot = typeof Online !== 'undefined' && Online.isBotId(T.turnState.uid);
    const ak = (Sync.settings && Sync.settings.autoKick) || 0;
    const idle = !mine && !bot && ak > 0 && T.turnAt && Date.now() - T.turnAt > ak * 60000 && Sync.isHolder();
    const away = !mine && Sync.leaseLoaded && !Sync.isHolder() && Sync.settings && Sync.settings.status === 'playing' && (!Sync.lease || Sync.now() - (Sync.lease.at || 0) > 45000);
    const html = away ? `<span>${t('The host is away: cards and bots are paused.')}</span><button class="btn" data-act="takeover">${t('Take over')}</button>`
      : bot && !Sync.isHolder() ? `<span>${t('Bots are paused: the host is away.')}</span><button class="btn" data-act="takeover">${t('Take over')}</button>`
      : idle ? `<span>${esc(t('{p} is playing', { p: ((Sync.players[T.turnState.uid] || {}).name) || '?' }))}</span><button class="btn" data-act="kickturn">${t('Remove idle player')}</button>` : '';
    if (html) { tb.hidden = false; tb.className = 'turnbar'; tb.innerHTML = html; }
  }
}
function render() {
  paintMoveBtns();   // the map's commands follow every redraw of the panel that explains them
  const p = $('#panel-body'); let h = '';
  if (T.pick) h = `<div class="banner"><span>${esc(T.pick.sel ? t('Confirm {s} on the map, or tap another sector.', { s: T.pick.sel }) : T.pick.label)}</span>${T.pick.locked ? '' : `<button class="btn" data-act="cancelpick">${t('Cancel')}</button>`}</div>`;
  if (T.markMode && !T.pick) h = markBanner();
  if (T.markMode && !T.pick) { /* marking: banner only */ }
  else if (S.tab === 'play') h += playPanel();
  else if (S.tab === 'table') h += tablePanel();
  else h += morePanel();
  p.innerHTML = h;
  if (typeof gameOver === 'function' && S.role && gameOver()) renderMkBar();   // the end of the game shows every Character in the bubbles, however it was reached
  const rc = $('#room-code'); if (rc) rc.onkeydown = e => { if (e.key === 'Enter') actions.syncjoin(); };
  const sh = $('#sheet'); if (sh) sh.scrollLeft = sh.scrollWidth;   // the sheet opens on the latest turns
}
const RULES = [
  ['Goal', ['<b>Humans</b> reach an Escape Pod. <b>Aliens</b> hunt every Human down.', 'The game ends after 40 rounds, or when the last Human escapes or is killed. Humans still aboard after 40 rounds are eliminated.', '<b>Basic game:</b> your first game. No Items and no Character abilities; Item cards count as Silence. <b>Ultimate game:</b> the complete rules.']],
  ['Your turn', ['<b>Move</b> (mandatory, never ending where you started). Humans 1 sector. Aliens 1–2 sectors, or 1–3 after feeding.', '<b>Secure sector:</b> declare "Silent Sector". Your turn is over.', '<b>Dangerous sector:</b> draw a card: Noise in your sector, Noise in any sector, Silence or an Item (announce Silence).', '<b>Alien attack:</b> after moving, announce the attack instead of drawing. Anyone there (Human or Alien) is killed and reveals their card.']],
  ['Killed', ['A killed <b>Human</b> restarts from the Alien Sector as an Alien, with no abilities or items. A killed <b>Alien</b> is out of the game.']],
  ['Sectors', ['Dangerous: draw a card. Secure: nothing happens.', 'Human and Alien start sectors: nobody may enter or cross them.', 'Escape Pods: Humans only.']]
];
/* full-screen sheet for long content (rules, map list): read without squeezing it into the panel */
function overlay(title, html) {
  actions.ovclose();
  const g = document.createElement('div'); g.id = 'overlay'; g.className = 'gallery'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true'); g.setAttribute('aria-label', title);
  g.innerHTML = `<header><h2>${esc(title)}</h2><button class="icon-btn" data-act="ovclose" aria-label="${t('Close')}">${ico('close')}</button></header><div class="gbody">${html}</div>`;
  document.body.appendChild(g); g.querySelector('[data-act=ovclose]').focus();
}
/* a list of rules with their printed icon: [icon, title, text, tag] */
const RULE_CARDS = [['noise-here', 'Noise in your sector', 'Announce the sector you are in.'], ['noise-any', 'Noise in any sector', 'Announce any sector you like: a bluff is allowed.'], ['silence', 'Silence', 'Announce nothing.'], ['silent', 'Silent Sector', 'A safe sector: you announce "Silent Sector" and no card is drawn.'], ['claws', 'Alien attack', 'After moving, an Alien may announce an attack instead of drawing a card. Everybody in that sector is killed.']];
const RULE_PODS = [['pod-green', 'Green pod', 'You escape and the pod is used up.'], ['pod-red', 'Red pod', 'The pod is damaged and closes for everyone. You stay inside, safe from attacks, and must leave next turn.']];
const RULE_ITEM_MORE = { attack: 'Announce it after moving, instead of drawing a card. Everybody in the sector is killed unless they survive with Defense or Clone.', teleport: 'Play it at the start of your turn: you appear in the Human sector, then move as usual.', adrenaline: 'Play it at the start of your turn: you may move one sector more than usual.', sedatives: 'Play it in a Dangerous Sector: you draw no card this turn.', spotlight: 'Play it after moving. Every player in the named sector or next to it announces their exact sector.', defense: 'Kept face down. If an Alien attacks your sector you survive and the card is used up.', clone: 'If you are attacked you survive, restart from the Human sector and the card is used up.', sensor: 'Pick another player: they must announce their exact sector.', mutation: 'From then on you move and attack as an Alien.', cat: 'Play it when you draw a Noise card: announce a noise in two sectors.' };
const iconList = rows => `<ul class="icol">${rows.map(([ic, title, text, tag]) => `<li>${gico(ic, 40)}<div><b>${t(title)}</b>${tag ? ` <em>${tag}</em>` : ''}<p>${Array.isArray(text) ? text.map(x => t(x)).join(' ') : t(text)}</p></div></li>`).join('')}</ul>`;
const rulesHtml = () => {
  const items = Object.keys(ITEMS).map(k => [k, ITEMS[k][0], RULE_ITEM_MORE[k], t('{n} in the deck', { n: ITEM_COUNTS[k] }) + (['defense', 'clone'].includes(k) ? ' · ' + t('Played automatically') : '')]);
  const chars = role => CHARS[role].map(c => [CHAR_ICON[c] || c, c, ABILITIES[c], UNIQUE_ABIL.includes(c) ? t('Once per game') : '']);
  const sect = (h, intro, list) => `<h4>${t(h)}</h4>${intro ? `<p class="dim">${t(intro)}</p>` : ''}${list}`;
  return `<div class="rules">${RULES.slice(0, 2).map(([h, li]) => `<h4>${t(h)}</h4><ul>${li.map(x => `<li>${t(x)}</li>`).join('')}</ul>`).join('')}
  ${sect('Dangerous Sector cards', '', iconList(RULE_CARDS))}
  ${RULES.slice(2, 4).map(([h, li]) => `<h4>${t(h)}</h4><ul>${li.map(x => `<li>${t(x)}</li>`).join('')}</ul>`).join('')}
  ${sect('Escape Pods', 'Declare which pod you reached, draw an Escape Pod card and reveal it. If every pod is closed, the remaining Humans are eliminated.', iconList(RULE_PODS))}
  ${sect('Items (Ultimate)', 'Silence and Item cards are kept face down. Only Humans use Items; Aliens collect them to look like Humans. Each item is used once.', iconList(items))}
  ${sect('Human Characters', 'Ultimate game only. Each player is dealt one secret Character with a special ability. A Human killed and reborn as an Alien loses it.', iconList(chars('human')))}
  ${sect('Alien Characters', '', iconList(chars('alien')))}
  <p class="dim fine2">${t('A summary of the official rulebook. The rulebook is authoritative.')} ${t('Unofficial fan companion for Escape from the Aliens in Outer Space.')}</p></div>`;
};
const mapsHtml = () => `<div class="ggrid">${T.maps.map(m => `<button class="gcard" data-act="map" data-id="${esc(m.id)}" aria-pressed="${m.id === T.map.id}">${mapPreview(m)}<b>${esc(m.name)}</b></button>`).join('')}</div>`;
const segRow = (label_, act, key, cur, opts) => `<div class="setrow"><span>${t(label_)}</span><div class="seg" role="radiogroup" aria-label="${t(label_)}">${opts.map(([v, l]) => `<button role="radio" data-act="${act}" data-${key}="${v}" aria-checked="${cur === v}">${l}</button>`).join('')}</div></div>`;
function morePanel() {
  const solo = !Sync.code && !S.hot, host = !!(Sync.code && Sync.isHost()), online = !!Sync.code && !S.hot;
  const ng = S.hot ? 'Close game' : 'New game';
  return `<div class="menu">
    <div class="tiles${solo ? '' : ' one'}"><button class="mrow" data-act="rules">${t('How to play')}<i aria-hidden="true">${ico('next', 18)}</i></button>
    ${solo ? `<button class="mrow" data-act="maps">${t('Map')}<i aria-hidden="true">${ico('next', 18)}</i></button>` : ''}</div>
    ${solo ? `<div class="setrow"><span>${t('Turn')}</span><div class="stepper"><button class="btn" data-act="turnminus" aria-label="${t('Previous turn')}">−</button><b>${S.turn}<small>/${MAX_TURN}</small></b><button class="btn" data-act="turnplus" aria-label="${t('Next turn')}">+</button></div></div>` : ''}
    ${segRow('Map style', 'mapstyle', 'v', MAP_STYLE, [['dark', t('Dark')], ['classic', t('Classic')]])}
    ${segRow('Language', 'lang', 'l', LANG, [['en', 'English'], ['it', 'Italiano']])}
    ${segRow('Share anonymous results', 'recshare', 'v', Records.on() ? 'on' : 'off', [['on', t('On')], ['off', t('Off')]])}
    ${Sync.code && Sync.isHost() ? `<button class="mrow" data-act="handover">${t('Hand over hosting')}<i aria-hidden="true">${ico('next', 18)}</i></button>` : ''}
    </div>
    ${online
      ? `<div class="row menuact"><button class="btn" data-act="leavetable">${t('Leave game')}</button>${host ? `<button class="btn danger" data-act="closetable">${t('End game for everyone')}</button>` : ''}</div>`
      : `<div class="row menuact"><button class="btn danger" data-act="newgame">${t(ng)}</button></div>`}`;
}
/* ---------------- boot ---------------- */
function setLang(l) { LANG = l; try { localStorage.setItem('eftaios.lang', l); } catch (_) { /* noop */ } applyStatic(); if (S.stage === 'game' && S.role) { render(); hdr(); paintCells(); } else renderFlow(); }
/* back to the start screen, keeping only the name and custom maps */
function resetToWelcome(stage) { T.homeGames = undefined; T.maps = T.maps.filter(m => !m.shared); const keep = { customMaps: S.customMaps, name: S.name, mapId: S.mapId, mode: S.mode, cards: S.cards }; S = Object.assign(fresh(), keep); S.stage = stage || 'welcome'; T.turnState = null; T.counts = null; Sync.status = 'off'; closeDlg(); save(); boot(); }
function boot() {
  if (S.hot && window.Hot) Hot.rebind();
  const ver = $('#ver'); if (ver) ver.hidden = S.stage !== 'welcome';
  T.pick = null; T.sel = null; T.annot = null; T.stroke = null; renderAnnot();
  const game = S.stage === 'game' && S.role;
  $('#flow').hidden = !!game; $('#app').hidden = !game;
  applyStatic();
  if (!game) { if (S.stage === 'game') S.stage = 'welcome'; renderFlow(); return; }
  T.map = T.maps.find(m => m.id === S.mapId) || T.maps[0]; S.mapId = T.map.id;
  if (!S.pos || !parseId(S.pos)) { S.pos = startSector(T.map, S.role, S.char, S.mode); S.path = [{ turn: 0, pos: S.pos }]; }
  fitDone = false; buildMap(); refreshReach(); render(); paintCells(); hdr();
  requestAnimationFrame(() => { fit(); fitDone = true; if (S.pos) focusOn(S.pos); });
}

/* the deployed build: version.json is stamped by the Pages workflow with the commit */
let loadedBuild = null, updateAsked = false, updateToasted = false;
async function readBuild() { try { const r = await fetch('version.json', { cache: 'no-store' }); return r.ok ? await r.json() : null; } catch (_) { return null; } }
(async () => {
  const v = (await readBuild()) || {}; loadedBuild = v.build || null;
  const el = document.getElementById('ver'); if (el) el.textContent = 'EFTAIOS v' + (v.version || '1.0.0') + (v.build ? ' · ' + v.build : '');
})();
/* a tab or installed app left open keeps running the version it loaded: when a newer build is out, offer the reload
   (a dialog at the start screen, one quiet toast during a game and in the lobby; game and notes are saved either way) */
async function checkForUpdate() {
  if (updateAsked || !loadedBuild) return;
  const v = await readBuild(); if (!v || !v.build || v.build === loadedBuild) return;
  if (S.stage !== 'welcome') { if (!updateToasted) { updateToasted = true; toast(t('A new version is available. Reload when you are between games.')); } return; }
  updateAsked = true;
  dlg.innerHTML = `<h2>${t('New version available')}</h2><p>${t('Reload to get the latest changes. Your game and notes are saved.')}</p><div class="row"><button class="btn" id="d-no">${t('Later')}</button><button class="btn primary" id="d-yes">${t('Reload')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg; $('#d-yes').onclick = () => location.reload();
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForUpdate(); });
setInterval(checkForUpdate, 10 * 60 * 1000);

