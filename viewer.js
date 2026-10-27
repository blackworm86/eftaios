'use strict';
/* Game viewer (Admin > Games): looks at finished games after the fact, with everybody's real roles and routes, as the end-of-game screen does.
   Sources: sample games played by the network (nn/games.json, written by the trainer on the owner's PC), the saved Bot test games, the anonymous
   records of players' games, or a game log file from the device ("Save game log"). A game is turned into one shape first:
   { title, map, turns, result: { aliensWin, reason, escaped: [seat] }, seats: [{ name, role0, role, char, over, route: [{ turn, cell, note }] }],
     log: [{ turn, seat, kind, cell, text }] } with cell = row * columns + column. */
const Viewer = (() => {
  let st = { source: '', games: [], error: '', loading: false }, cur = -1, turn = 0, focus = -1, vb = { x: 0, y: 0, w: 1, h: 1 };
  const mapOf = id => (typeof T !== 'undefined' ? T.maps : []).find(m => m.id === id);
  const cellOf = (map, id) => { const q = parseId(id); return q ? q[1] * map.cols + q[0] : null; };
  const idOf = (map, i) => cid(i % map.cols, Math.floor(i / map.cols));

  /* ---------- the sources, each into the one shape ---------- */
  function fromNet(g, k, src) {   // rl/eftaios_rl/samples.py
    return { title: `Network game ${k + 1}`, source: src, map: g.map, turns: g.turns, result: { aliensWin: g.result.aliens_win, reason: g.result.reason, escaped: g.result.escaped },
      seats: g.seats.map((s, i) => ({ name: 'Seat ' + (i + 1), role0: s.role0, role: s.role, char: s.char, over: s.over, route: s.route.map(([turn, cell, note]) => ({ turn, cell, note })) })),
      log: g.log.map(([turn, seat, kind, cell, text]) => ({ turn, seat, kind, cell, text })) };
  }
  function fromDump(d, title) {   // Hot.dump() / "Save game log" / a Bot test record
    const map = mapOf(d.map); if (!map || !d.seats || !d.log) return null;
    const idx = Object.fromEntries(d.seats.map((s, i) => [s.id, i])), byName = Object.fromEntries(d.seats.map((s, i) => [s.name, i]));
    return { title, map: d.map, turns: d.turn, result: d.result ? { aliensWin: !!d.result.aliensWin, reason: d.result.reason, escaped: (d.result.escaped || []).map(n => byName[n]).filter(i => i !== undefined) } : null,
      seats: d.seats.map((s, i) => ({ name: s.name || 'Seat ' + (i + 1), bot: s.bot, role0: s.role0, role: s.role, char: s.char, over: s.over, route: (s.path || []).map(p => ({ turn: p.turn, cell: cellOf(map, p.pos), note: (p.note || '')[0] || '' })) })),
      log: d.log.slice().reverse().filter(e => e.by in idx).map(e => ({ turn: e.turn, seat: idx[e.by], kind: e.kind, cell: e.sector ? cellOf(map, e.sector) : null, text: String(e.text || '') })) };
  }
  function fromRecord(r, title) {   // the anonymous game records (records.js)
    const g = JSON.parse(r.game), map = mapOf(g.map); if (!map) return null;
    return { title, map: g.map, turns: g.turns, result: g.result ? { aliensWin: !!g.result.aliensWin, reason: g.result.reason, escaped: g.result.escaped || [] } : null,
      seats: g.seats.map((s, i) => ({ name: (s.kind === 'human' ? 'Person ' : s.kind[0].toUpperCase() + s.kind.slice(1) + ' bot ') + (i + 1), role0: s.role0, role: s.role, char: s.char, over: s.over,
        route: String(s.route || '').split(',').filter(Boolean).map(x => { const [turn, pos, note] = x.split(':'); return { turn: +turn, cell: cellOf(map, pos), note: note || '' }; }) })),
      log: g.log.map(e => ({ turn: e.t, seat: e.s, kind: e.k, cell: e.c ? cellOf(map, e.c) : null, text: e.x })) };
  }
  /* whatever a file or a record holds: a list of games */
  function parseAny(j, name) {
    if (j && j.format === 1 && Array.isArray(j.games)) return j.games.map((g, k) => fromNet(g, k, j.source));
    if (j && j.game && typeof j.game === 'object' && j.game.seats) return [fromDump(j.game, name + (j.test ? ': ' + j.test : ''))].filter(Boolean);   // tests/play-logs files
    if (j && j.seats && j.log) return [fromDump(j, name)].filter(Boolean);
    return [];
  }

  /* ---------- loading ---------- */
  async function load(source) {
    st = { source, games: [], error: '', loading: true }; cur = -1; renderFlow();
    try {
      if (source === 'net') {
        const r = await fetch('nn/games.json', { cache: 'no-cache' });
        if (!r.ok) throw new Error('There are no sample games yet: press 7 in the trainer menu on your PC.');
        st.games = parseAny(await r.json(), 'Network');
      } else if (source === 'tests') {
        const recs = Object.entries(await Sync.adminList('bottests')).sort((a, b) => b[1].at - a[1].at);
        st.games = recs.map(([, r]) => fromDump(JSON.parse(r.game), `${r.test} (${r.rating}/5)`)).filter(Boolean);
      } else if (source === 'players') {
        const recs = Object.entries(await Sync.adminList('gameRecords')).sort((a, b) => b[1].at - a[1].at);
        st.games = recs.map(([, r], k) => fromRecord(r, 'Player game ' + (k + 1))).filter(Boolean);
      }
      if (!st.games.length && !st.error) st.error = 'No games here yet.';
    } catch (e) { st.error = e.message || String(e); }
    st.loading = false; renderFlow();
  }
  function useFile(text, name) {
    try { st = { source: 'file', games: parseAny(JSON.parse(text), name || 'File'), error: '', loading: false }; } catch (e) { st = { source: 'file', games: [], error: 'That file is not a game log.', loading: false }; }
    if (!st.games.length && !st.error) st.error = 'No game found in that file.';
    if (st.games.length === 1) open(0); else { cur = -1; renderFlow(); }
  }

  /* ---------- drawing ---------- */
  const COLOR = { '.': '#59627a', s: '#ece6d3', H: '#1c5d93', A: '#a53312' };
  const nameOfResult = g => !g.result ? 'unfinished' : (g.result.aliensWin ? 'Aliens win' : 'Humans win') + ' (' + ({ escape: 'a Human escaped', eliminated: 'all Humans eliminated', time: 'time is up' }[g.result.reason] || g.result.reason) + ')';
  function seatAt(g, i, T_) {   // where the seat is at the end of turn T_, and whether it is out of the game by then
    let pos = null, conv = false;
    for (const p of g.seats[i].route) { if (p.turn <= T_) { pos = p.cell; if ((p.note === 'r' || p.note === 'm') && p.turn > 0) conv = true; } else break; }
    const out = g.log.find(e => e.seat === i && e.kind === 'out' && !/^killed\|human/.test(e.text) && e.turn <= T_);
    return { pos, conv, out: out ? out.text.split('|')[0] : '' };
  }
  const dims = map => ({ W: HEX * 2 + 1.5 * HEX * (map.cols - 1), H: Math.sqrt(3) * HEX * (map.rows + 0.5) });
  /* the view box that shows every sector the game used, with some margin; the whole map when there is nothing to fit */
  function fitBox(g, whole) {
    const map = mapOf(g.map), { W, H } = dims(map); if (whole) return { x: 0, y: 0, w: W, h: H };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of g.seats) for (const p of s.route) if (p.cell !== null) { const q = hexPos(map, p.cell % map.cols, Math.floor(p.cell / map.cols)); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    if (x0 > x1) return { x: 0, y: 0, w: W, h: H };
    const m = HEX * 2.2, w = Math.max(x1 - x0 + 2 * m, W * 0.35), h = Math.max(y1 - y0 + 2 * m, H * 0.35), r = W / H;   // keep the map's proportions
    let bw = Math.max(w, h * r), bh = bw / r; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    bw = Math.min(bw, W); bh = Math.min(bh, H);
    return { x: Math.min(Math.max(cx - bw / 2, 0), W - bw), y: Math.min(Math.max(cy - bh / 2, 0), H - bh), w: bw, h: bh };
  }
  /* the inside of the map picture for turn T_ */
  function svgInner(g, T_) {
    const map = mapOf(g.map), P = (c, r) => hexPos(map, c, r), full = dims(map).W, zoomed = vb.w < full * 0.55;
    let s = '';
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
      const ty = map.grid[r][c]; if (ty === 'x') continue; const { x, y } = P(c, r);
      s += `<polygon points="${hexPts(x, y, HEX - 1)}" fill="${COLOR[ty] || '#1e8a4f'}"/>`;
      if ('1234'.includes(ty)) s += `<text x="${x}" y="${y + 5}" class="vw-n">${ty}</text>`;
      else if (zoomed) s += `<text x="${x}" y="${y + 3}" class="vw-id">${cid(c, r)}</text>`;   // sector names once you have zoomed in
    }
    const at = i => P(i % map.cols, Math.floor(i / map.cols));
    for (const e of g.log) if (e.turn === T_ && e.cell !== null && (e.kind === 'noise' || e.kind === 'attack')) { const p = at(e.cell); s += `<circle cx="${p.x}" cy="${p.y}" r="${HEX * 0.9}" class="${e.kind === 'attack' ? 'vw-att' : 'vw-noise'}"/>`; }
    // routes: the last three turns strong, older steps faint; a focused player is drawn alone
    g.seats.forEach((seat, i) => {
      const dim = focus >= 0 && focus !== i, col = PALETTE[i % PALETTE.length][0], pts = seat.route.filter(p => p.turn <= T_ && p.cell !== null);
      for (let k = 1; k < pts.length; k++) {
        const a = at(pts[k - 1].cell), b = at(pts[k].cell), recent = pts[k].turn > T_ - 3;
        s += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${col}" stroke-width="${recent ? 4.5 : 2.5}" stroke-linecap="round" opacity="${dim ? 0.12 : recent ? 0.95 : 0.4}"/>`;
      }
    });
    // markers: seats on the same sector are spread around its middle
    const byCell = new Map();
    g.seats.forEach((seat, i) => { const f = seatAt(g, i, T_); if (f.pos === null) return; f.i = i; (byCell.get(f.pos) || byCell.set(f.pos, []).get(f.pos)).push(f); });
    for (const [cell, list] of byCell) {
      const q = at(cell), k = list.length, ring = k === 1 ? 0 : HEX * (k <= 3 ? 0.42 : 0.55), rad = k === 1 ? HEX * 0.52 : HEX * (k <= 3 ? 0.36 : 0.3);
      list.forEach((f, n) => {
        const ang = -Math.PI / 2 + 2 * Math.PI * n / k, x = q.x + ring * Math.cos(ang), y = q.y + ring * Math.sin(ang), col = PALETTE[f.i % PALETTE.length][0], seat = g.seats[f.i];
        const dim = focus >= 0 && focus !== f.i, alien = f.conv || seat.role0 === 'alien';
        s += f.out ? `<g opacity="${dim ? 0.3 : 1}"><circle class="vw-m" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="#111" stroke="${col}" stroke-width="2.5"/><text x="${x.toFixed(1)}" y="${(y + rad * 0.38).toFixed(1)}" class="vw-x" style="font-size:${(rad * 1.2).toFixed(1)}px">${f.out === 'escaped' ? '✓' : '✕'}</text></g>`
          : `<g opacity="${dim ? 0.3 : 1}"><circle class="vw-m" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${col}" stroke="${alien ? '#ff3b30' : '#fff'}" stroke-width="2.5"/><text x="${x.toFixed(1)}" y="${(y + rad * 0.38).toFixed(1)}" class="vw-t" fill="${PALETTE[f.i % PALETTE.length][1]}" style="font-size:${(rad * 1.15).toFixed(1)}px">${f.i + 1}</text></g>`;
      });
    }
    return s;
  }
  const vbText = () => `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`;
  function eventText(g, e) {
    const map = mapOf(g.map), cell = e.cell !== null && map ? idOf(map, e.cell) : '';
    if (e.kind === 'noise') return `noise in ${cell}`;
    if (e.kind === 'attack') return `attack in ${cell}`;
    if (e.kind === 'silence') return e.text === 'secure' ? 'silent sector' : 'silence';
    if (e.kind === 'hatch') return 'escape pod ' + (e.text === 'damaged' ? 'damaged' : e.text === 'ok' ? 'worked' : '');
    if (e.kind === 'out') { const [why, role] = e.text.split('|'); return `${why === 'escaped' ? 'escaped' : why === 'trapped' ? 'trapped' : 'killed'} (${role})`; }
    if (e.kind === 'item') return `plays ${e.text}`;
    if (e.kind === 'reveal') return e.text.startsWith('Id|') ? 'identity revealed: ' + e.text.slice(3).replace('|', ', ') : e.text;
    return `${e.kind} ${e.text || ''}`;
  }
  const events = (g, T_) => g.log.filter(e => e.turn === T_).map(e => `<li><span class="vw-dot" style="background:${PALETTE[e.seat % PALETTE.length][0]}"></span><b>${e.seat + 1}</b> ${esc(eventText(g, e))}</li>`).join('') || '<li class="dim">Nothing announced.</li>';
  function players(g) {
    return g.seats.map((s, i) => {
      const res = s.over === 'escaped' ? 'escaped' : s.over === 'trapped' ? 'trapped' : s.over === 'dead' ? 'killed' : s.role0 !== s.role ? 'became an Alien' : 'in the game at the end';
      const alien = s.role === 'alien';
      return `<li class="vw-p${focus === i ? ' on' : ''}" data-act="vwfocus" data-i="${i}" role="button" tabindex="0"><span class="vw-dot" style="background:${PALETTE[i % PALETTE.length][0]}"></span><b>${i + 1}</b> ${esc(s.name)}<br><small class="${alien ? 'vw-al' : ''}">${esc(s.role0 === s.role ? s.role : s.role0 + ' → ' + s.role)}${s.char ? ', ' + esc(s.char) : ''} · ${res}</small></li>`;
    }).join('');
  }

  /* ---------- the screen ---------- */
  function html() {
    const tabsB = [['net', 'Network games'], ['tests', 'Bot tests'], ['players', 'Players\' games']].map(([k, l]) => `<button class="btn${st.source === k ? ' primary' : ''}" data-act="vwsrc" data-s="${k}">${l}</button>`).join('');
    const bar = `<div class="row two">${tabsB}</div><label class="btn wide vw-file">Open a game log file<input id="vw-file" type="file" accept=".json,application/json" hidden></label>`;
    if (st.loading) return bar + '<p class="dim">Loading…</p>';
    if (cur >= 0 && st.games[cur]) {
      const g = st.games[cur], max = Math.min(g.turns, 40), tt = Math.min(turn, max);
      return `${bar}<button class="btn wide" data-act="vwback">← All games (${st.games.length})</button>
        <h3>${esc(g.title)}</h3><p class="dim">${esc(mapOf(g.map) ? mapOf(g.map).name : g.map)} · ${g.seats.length} players · ${g.turns} turns<br><b>${esc(nameOfResult(g))}</b>${g.source ? '<br>' + esc(g.source) : ''}</p>
        <div class="vw-bar"><button class="btn" data-act="vwstep" data-d="-1" aria-label="Previous turn">◀</button><input id="vw-turn" type="range" min="0" max="${max}" value="${tt}" aria-label="Turn"><button class="btn" data-act="vwstep" data-d="1" aria-label="Next turn">▶</button></div>
        <p class="vw-turn">Turn <b id="vw-tn">${tt}</b> / ${max}</p>
        <div class="vw-wrap" id="vw-map"><svg id="vw-svg" class="vw-svg" viewBox="${vbText()}" role="img" aria-label="Routes"><g id="vw-g">${svgInner(g, tt)}</g></svg>
          <div class="vw-zoom"><button class="btn" data-act="vwzoom" data-f="0.6" aria-label="Zoom in">+</button><button class="btn" data-act="vwzoom" data-f="1.6" aria-label="Zoom out">−</button><button class="btn" data-act="vwfit" data-w="0" aria-label="Fit the routes">⤢</button><button class="btn" data-act="vwfit" data-w="1" aria-label="Whole map">▦</button></div></div>
        <p class="dim vw-key">Drag to move, pinch or + − to zoom. Rings: white = noise this turn, red = attack. ✓ escaped, ✕ out. Red outline = Alien. Tap a player to follow only that player.</p>
        <h4>Players</h4><ul class="vw-pl" id="vw-pl">${players(g)}</ul><h4>Turn ${tt}</h4><ul id="vw-ev" class="vw-ev">${events(g, tt)}</ul>`;
    }
    if (st.error) return `${bar}<p class="dim">${esc(st.error)}</p>`;
    if (!st.games.length) return bar + '<p class="dim">Choose where the games come from.</p>';
    return bar + '<ul class="plist adm-list">' + st.games.map((g, i) => `<li class="adm-row"><span class="who"><b>${esc(g.title)}</b><small>${esc(mapOf(g.map) ? mapOf(g.map).name : g.map)} · ${g.seats.length} players · ${g.turns} turns · ${esc(nameOfResult(g))}</small></span><div class="acts"><button class="btn" data-act="vwopen" data-i="${i}">Open</button></div></li>`).join('') + '</ul>';
  }
  function repaint() {   // only the map and the lists: the slider keeps its place
    const g = st.games[cur]; if (!g) return; const max = Math.min(g.turns, 40), tt = Math.min(turn, max);
    const el = id => document.getElementById(id), gg = el('vw-g'), svgEl = el('vw-svg'), ev = el('vw-ev'), tn = el('vw-tn'), sl = el('vw-turn'), pl = el('vw-pl');
    if (gg) gg.innerHTML = svgInner(g, tt); if (svgEl) svgEl.setAttribute('viewBox', vbText()); if (ev) ev.innerHTML = events(g, tt); if (tn) tn.textContent = tt; if (sl) sl.value = tt; if (pl) pl.innerHTML = players(g);
    const h = document.querySelector('#vw-ev') && document.querySelector('#vw-ev').previousElementSibling; if (h) h.textContent = 'Turn ' + tt;
  }
  function setTurn(n) { const g = st.games[cur]; if (!g) return; turn = Math.max(0, Math.min(Math.min(g.turns, 40), n)); repaint(); }
  function zoom(f, cx, cy) {   // f < 1 zooms in; (cx, cy) in map units stays where it is
    const g = st.games[cur]; if (!g) return; const { W } = dims(mapOf(g.map)), r = vb.h / vb.w, nw = Math.min(W, Math.max(W / 12, vb.w * f)), nh = nw * r;
    cx = cx === undefined ? vb.x + vb.w / 2 : cx; cy = cy === undefined ? vb.y + vb.h / 2 : cy;
    vb = { x: cx - (cx - vb.x) * nw / vb.w, y: cy - (cy - vb.y) * nh / vb.h, w: nw, h: nh }; clampBox(g); repaint();
  }
  function clampBox(g) { const { W, H } = dims(mapOf(g.map)); vb.x = Math.min(Math.max(vb.x, -HEX), W - vb.w + HEX); vb.y = Math.min(Math.max(vb.y, -HEX), H - vb.h + HEX); }
  const open = i => { cur = i; turn = st.games[i].turns; focus = -1; vb = fitBox(st.games[i], false); renderFlow(); };
  const actions = {
    vwsrc(b) { load(b.dataset.s); },
    vwopen(b) { open(+b.dataset.i); },
    vwback() { cur = -1; renderFlow(); },
    vwstep(b) { setTurn(turn + Number(b.dataset.d)); },
    vwzoom(b) { zoom(Number(b.dataset.f)); },
    vwfit(b) { const g = st.games[cur]; if (g) { vb = fitBox(g, b.dataset.w === '1'); repaint(); } },
    vwfocus(b) { focus = focus === +b.dataset.i ? -1 : +b.dataset.i; repaint(); }
  };
  /* moving the picture: one finger or the mouse drags, two fingers pinch, the wheel zooms */
  const ptrs = new Map(); let last = null;
  const onMap = e => e.target && e.target.closest && e.target.closest('#vw-svg');
  const toMap = (e, svgEl) => { const r = svgEl.getBoundingClientRect(); return { x: vb.x + (e.clientX - r.left) / r.width * vb.w, y: vb.y + (e.clientY - r.top) / r.height * vb.h }; };
  document.addEventListener('pointerdown', e => { const s = onMap(e); if (!s) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = null; try { s.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } });
  document.addEventListener('pointermove', e => {
    const s = document.getElementById('vw-svg'); if (!s || !ptrs.has(e.pointerId) || cur < 0) return;
    const prev = ptrs.get(e.pointerId), r = s.getBoundingClientRect(); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { vb.x -= (e.clientX - prev.x) / r.width * vb.w; vb.y -= (e.clientY - prev.y) / r.height * vb.h; clampBox(st.games[cur]); repaint(); }
    else if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (last) { const c = toMap({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, s); zoom(last / d, c.x, c.y); } last = d;
    }
  });
  const end = e => { ptrs.delete(e.pointerId); last = null; };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  document.addEventListener('wheel', e => { const s = onMap(e); if (!s || cur < 0) return; e.preventDefault(); const c = toMap(e, s); zoom(e.deltaY < 0 ? 0.85 : 1.18, c.x, c.y); }, { passive: false });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'vw-turn') setTurn(+e.target.value); });
  document.addEventListener('change', e => { const f = e.target && e.target.id === 'vw-file' && e.target.files[0]; if (f) f.text().then(tx => useFile(tx, f.name)); });
  return { html, actions, useFile, setTurn, zoom, fromDump, fromRecord, fromNet, parseAny, state: () => ({ st, cur, turn, vb, focus }) };
})();
if (typeof window !== 'undefined') window.Viewer = Viewer;
