'use strict';
/* Game viewer (Admin > Games): looks at finished games after the fact, with everybody's real roles and routes, as the end-of-game screen does.
   Sources: sample games played by the network (nn/games.json, written by the trainer on the owner's PC), the saved Bot test games, the anonymous
   records of players' games, or a game log file from the device ("Save game log"). A game is turned into one shape first:
   { title, map, turns, result: { aliensWin, reason, escaped: [seat] }, seats: [{ name, role0, role, char, over, route: [{ turn, cell, note }] }],
     log: [{ turn, seat, kind, cell, text }] } with cell = row * columns + column. */
const Viewer = (() => {
  let st = { source: '', games: [], error: '', loading: false }, cur = -1, turn = 0;
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
    cur = st.games.length === 1 ? 0 : -1; turn = cur === 0 ? st.games[0].turns : 0; renderFlow();
  }

  /* ---------- drawing ---------- */
  const COLOR = { '.': '#59627a', s: '#ece6d3', H: '#1c5d93', A: '#a53312' };
  const nameOfResult = g => !g.result ? 'unfinished' : (g.result.aliensWin ? 'Aliens win' : 'Humans win') + ' (' + ({ escape: 'a Human escaped', eliminated: 'all Humans eliminated', time: 'time is up' }[g.result.reason] || g.result.reason) + ')';
  function seatAt(g, i, T_) {   // where the seat is at the end of turn T_, and whether it is out of the game by then
    let pos = null, conv = false; const r = g.seats[i].route;
    for (const p of r) { if (p.turn <= T_) { pos = p.cell; } else break; if (p.turn <= T_ && (p.note === 'r' || p.note === 'm') && p.turn > 0) conv = true; }
    const out = g.log.find(e => e.seat === i && e.kind === 'out' && !/^killed\|human/.test(e.text) && e.turn <= T_);
    return { pos, conv, out: out ? out.text.split('|')[0] : '' };
  }
  function svg(g, T_) {
    const map = mapOf(g.map); if (!map) return '<p class="dim">Map not found.</p>';
    const W = HEX * 2 + 1.5 * HEX * (map.cols - 1), Hh = Math.sqrt(3) * HEX * (map.rows + 0.5), P = (c, r) => hexPos(map, c, r);
    let s = '';
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
      const ty = map.grid[r][c]; if (ty === 'x') continue; const { x, y } = P(c, r);
      s += `<polygon points="${hexPts(x, y, HEX - 1)}" fill="${COLOR[ty] || '#1e8a4f'}"/>`;
      if ('1234'.includes(ty)) s += `<text x="${x}" y="${y + 4}" class="vw-n">${ty}</text>`;
    }
    const at = i => { const p = P(i % map.cols, Math.floor(i / map.cols)); return p; };
    for (const e of g.log) if (e.turn === T_ && e.cell !== null && (e.kind === 'noise' || e.kind === 'attack')) { const p = at(e.cell); s += `<circle cx="${p.x}" cy="${p.y}" r="${HEX * 0.85}" class="${e.kind === 'attack' ? 'vw-att' : 'vw-noise'}"/>`; }
    g.seats.forEach((seat, i) => {
      const col = PALETTE[i % PALETTE.length][0], pts = seat.route.filter(p => p.turn <= T_ && p.cell !== null).map(p => { const q = at(p.cell); return q.x.toFixed(1) + ',' + q.y.toFixed(1); });
      if (pts.length > 1) s += `<polyline points="${pts.join(' ')}" fill="none" stroke="${col}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" opacity=".8"/>`;
      const f = seatAt(g, i, T_); if (f.pos === null) return; const q = at(f.pos);
      s += f.out ? `<g class="vw-out"><circle cx="${q.x}" cy="${q.y}" r="9" fill="#111" stroke="${col}" stroke-width="2"/><text x="${q.x}" y="${q.y + 4}" class="vw-x">${f.out === 'escaped' ? '✓' : '✕'}</text></g>`
        : `<circle cx="${q.x}" cy="${q.y}" r="9" fill="${col}" stroke="${f.conv || seat.role === 'alien' && seat.role0 === 'alien' ? '#ff3b30' : '#fff'}" stroke-width="2"/><text x="${q.x}" y="${q.y + 4}" class="vw-t" fill="${PALETTE[i % PALETTE.length][1]}">${i + 1}</text>`;
    });
    return `<svg class="vw-svg" viewBox="0 0 ${W.toFixed(0)} ${Hh.toFixed(0)}" role="img" aria-label="Routes on ${esc(map.name)}">${s}</svg>`;
  }
  function eventText(g, e) {
    const map = mapOf(g.map), cell = e.cell !== null && map ? idOf(map, e.cell) : '';
    const who = 'Seat ' + (e.seat + 1);
    if (e.kind === 'noise') return `${who}: noise in ${cell}`;
    if (e.kind === 'attack') return `${who}: attack in ${cell}`;
    if (e.kind === 'silence') return `${who}: ${e.text === 'secure' ? 'silent sector' : 'silence'}`;
    if (e.kind === 'hatch') return `${who}: escape pod ${e.text === 'ok' || e.text === 'damaged' ? e.text : ''}`;
    if (e.kind === 'out') { const [why, role] = e.text.split('|'); return `${who}: ${why === 'escaped' ? 'escaped' : why === 'trapped' ? 'trapped' : 'killed'} (${role})`; }
    if (e.kind === 'item') return `${who}: plays ${e.text}`;
    if (e.kind === 'reveal') return `${who}: ${e.text.startsWith('Id|') ? 'identity revealed: ' + e.text.slice(3) : e.text}`;
    return `${who}: ${e.kind} ${e.text || ''}`;
  }
  const events = (g, T_) => g.log.filter(e => e.turn === T_).map(e => `<li>${esc(eventText(g, e))}</li>`).join('') || '<li class="dim">Nothing announced.</li>';
  function players(g) {
    return g.seats.map((s, i) => {
      const res = s.over === 'escaped' ? 'escaped' : s.over === 'trapped' ? 'trapped' : s.over === 'dead' ? 'killed' : s.role0 !== s.role ? 'became an Alien' : 'in the game at the end';
      return `<li><span class="vw-dot" style="background:${PALETTE[i % PALETTE.length][0]}"></span><b>${esc(s.name)}</b> <small>${esc(s.role0 === s.role ? s.role : s.role0 + ' → ' + s.role)}${s.char ? ', ' + esc(s.char) : ''} · ${res}</small></li>`;
    }).join('');
  }

  /* ---------- the screen ---------- */
  function html() {
    const tabsB = [['net', 'Network sample games'], ['tests', 'Bot tests'], ['players', 'Players\' games']].map(([k, l]) => `<button class="btn${st.source === k ? ' primary' : ''}" data-act="vwsrc" data-s="${k}">${l}</button>`).join('');
    const bar = `<div class="row two">${tabsB}</div><label class="btn wide vw-file">Open a game log file<input id="vw-file" type="file" accept=".json,application/json" hidden></label>`;
    if (st.loading) return bar + '<p class="dim">Loading…</p>';
    if (cur >= 0 && st.games[cur]) {
      const g = st.games[cur], max = Math.min(g.turns, 40);
      return `${bar}<button class="btn wide" data-act="vwback">← All games (${st.games.length})</button>
        <h3>${esc(g.title)}</h3><p class="dim">${esc(mapOf(g.map) ? mapOf(g.map).name : g.map)} · ${g.seats.length} players · ${g.turns} turns · ${esc(nameOfResult(g))}${g.source ? '<br>' + esc(g.source) : ''}</p>
        <div class="vw-bar"><button class="btn" data-act="vwstep" data-d="-1" aria-label="Previous turn">◀</button><input id="vw-turn" type="range" min="0" max="${max}" value="${Math.min(turn, max)}" aria-label="Turn"><button class="btn" data-act="vwstep" data-d="1" aria-label="Next turn">▶</button></div>
        <p class="dim">Turn <b id="vw-tn">${Math.min(turn, max)}</b> of ${max}. A white ring: a noise this turn; red: an attack; ✓ escaped; ✕ out; red outline: an Alien.</p>
        <div id="vw-map">${svg(g, Math.min(turn, max))}</div>
        <ul class="plist">${players(g)}</ul><h4>This turn</h4><ul id="vw-ev" class="vw-ev">${events(g, Math.min(turn, max))}</ul>`;
    }
    if (st.error) return `${bar}<p class="dim">${esc(st.error)}</p>`;
    if (!st.games.length) return bar + '<p class="dim">Choose where the games come from.</p>';
    return bar + '<ul class="plist adm-list">' + st.games.map((g, i) => `<li class="adm-row"><span class="who"><b>${esc(g.title)}</b><small>${esc(mapOf(g.map) ? mapOf(g.map).name : g.map)} · ${g.seats.length} players · ${g.turns} turns · ${esc(nameOfResult(g))}</small></span><div class="acts"><button class="btn" data-act="vwopen" data-i="${i}">Open</button></div></li>`).join('') + '</ul>';
  }
  function setTurn(n) {
    const g = st.games[cur]; if (!g) return; const max = Math.min(g.turns, 40); turn = Math.max(0, Math.min(max, n));
    const m = document.getElementById('vw-map'), ev = document.getElementById('vw-ev'), tn = document.getElementById('vw-tn'), sl = document.getElementById('vw-turn');
    if (m) m.innerHTML = svg(g, turn); if (ev) ev.innerHTML = events(g, turn); if (tn) tn.textContent = turn; if (sl) sl.value = turn;
  }
  const actions = {
    vwsrc(b) { load(b.dataset.s); },
    vwopen(b) { cur = +b.dataset.i; turn = st.games[cur].turns; renderFlow(); },
    vwback() { cur = -1; renderFlow(); },
    vwstep(b) { setTurn(turn + Number(b.dataset.d)); }
  };
  document.addEventListener('input', e => { if (e.target && e.target.id === 'vw-turn') setTurn(+e.target.value); });
  document.addEventListener('change', e => { const f = e.target && e.target.id === 'vw-file' && e.target.files[0]; if (f) f.text().then(tx => useFile(tx, f.name)); });
  return { html, actions, useFile, setTurn, fromDump, fromRecord, fromNet, parseAny, state: () => ({ st, cur, turn }) };
})();
if (typeof window !== 'undefined') window.Viewer = Viewer;
