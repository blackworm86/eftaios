'use strict';
/* Game viewer (Admin > Games): every finished game we hold in one list (players' games, saved Bot tests, the network's sample games, files),
   sortable and filtered, and an analysis screen for one game: the map with routes, announcements, cards and powers, a turn slider, per-player
   and whole-game statistics, a timeline and the full log. A game is turned into one shape first:
   { id, title, kind: players|test|network|file, at, map, turns, n, mode, build, result: { aliensWin, reason, escaped: [seat] },
     seats: [{ name, kind: person|bot|network, bot, role0, role, char, over, items, ab, route: [{ turn, cell, note, star }] }],
     log: [{ turn, seat, kind, cell, text }] } with cell = row * columns + column. */
const Viewer = (() => {
  const PAGE = 15, SRC = [['all', 'All'], ['players', 'Players'], ['auto', 'Automated'], ['test', 'Bot tests'], ['network', 'Network'], ['file', 'Files']];
  const ITEM = { adrenaline: ['Adr', '#f59e0b'], sedatives: ['Sed', '#a78bfa'], attack: ['Atk', '#ef4444'], cat: ['Cat', '#f472b6'], spotlight: ['Spo', '#fde047'], teleport: ['Tel', '#22d3ee'],
    defense: ['Def', '#34d399'], clone: ['Clo', '#2dd4bf'], sensor: ['Sen', '#60a5fa'], mutation: ['Mut', '#fb7185'] };
  const NOTE = { t: 'Teleport', s: 'Stayed (Executive Officer)', l: 'Lurked: attacked without moving', m: 'Mutated into an Alien', r: 'Killed: restarted as an Alien', c: 'Clone: restarted at the Human sector' };
  let all = [], loading = false, error = '', f = { src: 'all', res: '', n: '', map: '', sort: 'new', page: 0 };
  let ratio = 23 / 14, mode = 'round', step = 0, cur = null, turn = 0, focus = -1, vb = { x: 0, y: 0, w: 1, h: 1 }, tab = 'turn', pub = false, scope = 'turn', play = null, logF = { seat: -1, kind: '' };
  const layers = { routes: true, noise: true, cards: true, reveals: true, pods: true, names: false, lies: false };
  const mapOf = id => (typeof T !== 'undefined' ? T.maps : []).find(m => m.id === id);
  const cellOf = (map, id) => { const q = id ? parseId(id) : null; return q ? q[1] * map.cols + q[0] : null; };
  const idOf = (map, i) => cid(i % map.cols, Math.floor(i / map.cols));
  const mapName = id => (mapOf(id) ? mapOf(id).name : id);
  const day = at => (at ? new Date(at).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'no date');

  /* ---------- the sources, each into the one shape ---------- */
  function fromNet(g, k, src, made) {   // rl/eftaios_rl/samples.py
    return { title: `Network game ${k + 1}`, kind: 'network', at: made ? Date.parse(String(made).replace(' ', 'T')) || null : null, note: src, map: g.map, turns: g.turns, mode: 'ultimate',
      result: { aliensWin: g.result.aliens_win, reason: g.result.reason, escaped: g.result.escaped },
      seats: g.seats.map((s, i) => ({ name: 'Seat ' + (i + 1), kind: 'network', role0: s.role0, role: s.role, char: s.char, over: s.over, items: [], ab: {}, route: s.route.map(([turn, cell, note]) => ({ turn, cell, note, star: 0 })) })),
      log: g.log.map(([turn, seat, kind, cell, text]) => ({ turn, seat, kind, cell, text })) };
  }
  function fromDump(d, title, kind, at) {   // Hot.dump() / "Save game log" / a Bot test record
    const map = mapOf(d.map); if (!map || !d.seats || !d.log) return null;
    const idx = Object.fromEntries(d.seats.map((s, i) => [s.id, i])), byName = Object.fromEntries(d.seats.map((s, i) => [s.name, i]));
    return { title, kind: kind || 'file', at: at || null, map: d.map, turns: d.turn, mode: d.mode,
      result: d.result ? { aliensWin: !!d.result.aliensWin, reason: d.result.reason, escaped: (d.result.escaped || []).map(n => byName[n]).filter(i => i !== undefined) } : null,
      seats: d.seats.map((s, i) => ({ name: s.name || 'Seat ' + (i + 1), kind: s.bot ? 'bot' : 'person', bot: s.bot, role0: s.role0, role: s.role, char: s.char, over: s.over, items: s.items || [], ab: s.ab || {},
        route: (s.path || []).map(p => ({ turn: p.turn, cell: cellOf(map, p.pos), note: (p.note || '')[0] || '', star: p.star ? 1 : 0 })) })),
      log: d.log.slice().reverse().filter(e => e.by in idx).map(e => ({ turn: e.turn, seat: idx[e.by], kind: e.kind, cell: e.sector ? cellOf(map, e.sector) : null, text: e.kind === 'hatch' ? (e.ok ? 'ok' : 'damaged') : String(e.text || '') })) };
  }
  function fromRecord(r, title, id) {   // the anonymous game records (records.js)
    const g = JSON.parse(r.game), map = mapOf(g.map); if (!map) return null;
    return { title, kind: 'players', dbpath: id ? 'gameRecords/' + id : '', auto: !r.build, at: r.at || null, build: r.build,   // no build number: stored by a script (a test run), not by a person
       map: g.map, turns: g.turns, mode: g.mode || r.mode, result: g.result ? { aliensWin: !!g.result.aliensWin, reason: g.result.reason, escaped: g.result.escaped || [] } : null,
      seats: g.seats.map((s, i) => ({ name: (s.kind === 'human' ? 'Person ' : s.kind[0].toUpperCase() + s.kind.slice(1) + ' bot ') + (i + 1), kind: s.kind === 'human' ? 'person' : 'bot', bot: s.kind === 'human' ? '' : s.kind,
        optout: !!s.optout, role0: s.role0 || '?', role: s.role || '?', char: s.char, over: s.over, items: s.items || [], ab: s.ab || {},
        route: String(s.route || '').split(',').filter(Boolean).map(x => { const [turn, pos, note = ''] = x.split(':'); return { turn: +turn, cell: cellOf(map, pos), note: note.replace('*', ''), star: note.includes('*') ? 1 : 0 }; }) })),
      log: g.log.map(e => ({ turn: e.t, seat: e.s, kind: e.k, cell: e.c ? cellOf(map, e.c) : null, text: e.k === 'hatch' ? (e.ok ? 'ok' : 'damaged') : e.x })) };
  }
  /* whatever a file holds: a list of games */
  function parseAny(j, name) {
    if (j && j.format === 1 && Array.isArray(j.games)) return j.games.map((g, k) => fromNet(g, k, j.source, j.made));
    if (j && j.game && typeof j.game === 'object' && j.game.seats) return [fromDump(j.game, name + (j.test ? ': ' + j.test : ''), 'file', j.at)].filter(Boolean);   // tests/play-logs files
    if (j && j.seats && j.log) return [fromDump(j, name, 'file')].filter(Boolean);
    return [];
  }
  const people = g => g.seats.filter(s => s.kind === 'person').length;
  const typeOf = g => (g.kind === 'players' ? (g.auto ? 'Automated' : people(g) ? 'People' : 'Bots only') : g.kind === 'test' ? 'Test' : g.kind === 'network' ? 'Network' : 'File');
  /* oldest = 1, so a newer game always has the bigger number */
  function number() { [...all].sort((a, b) => (a.at || 0) - (b.at || 0)).forEach((g, i) => { g.no = i + 1; }); }

  /* ---------- loading ---------- */
  async function load() {
    loading = true; error = ''; all = []; cur = null; renderFlow();
    const add = (name, fn) => fn().then(r => { all.push(...r.filter(g => g && g.seats)); }, e => { if (name !== 'net') error += (error ? ' ' : '') + `${name}: ${e.message || e}`; });
    await Promise.all([
      add('net', async () => { const r = await fetch('nn/games.json', { cache: 'no-cache' }); return r.ok ? parseAny(await r.json(), 'Network') : []; }),
      add('Bot tests', async () => Object.values(await Sync.adminList('bottests')).map(r => fromDump(JSON.parse(r.game), `${r.test} (${r.rating}/5)`, 'test', r.at))),
      add('Players\' games', async () => Object.entries(await Sync.adminList('gameRecords')).map(([id, r], k) => fromRecord(r, 'Game ' + (k + 1), id)))
    ]);
    number(); all.forEach(g => { if (g.kind === 'players') g.title = 'Game ' + g.no; else if (g.kind === 'network') g.title = 'Network game ' + g.no; });
    loading = false; renderFlow();
  }
  function useFile(text, name) {
    try { const gs = parseAny(JSON.parse(text), name || 'File'); gs.forEach(g => { g.kind = g.kind === 'network' ? 'network' : 'file'; }); all.push(...gs); number(); if (!gs.length) error = 'No game found in that file.'; else if (gs.length === 1) { open(gs[0]); return; } }
    catch (e) { error = 'That file is not a game log.'; }
    cur = null; f.src = 'all'; renderFlow();
  }

  /* ---------- what happened, worked out from the log ---------- */
  /* Every route point and announcement gets an order number, turn * 100 + seat, so the game can be read one player's turn at a time.
     What happens to someone during another player's turn (killed, saved by a card, shown by a Spotlight) counts at that other player's turn. */
  function prep(g) {
    if (g._steps) return g._steps;
    const own = new Set(), lastAtk = {}, lastCast = {}, ord = (t, i) => t * 100 + i;
    g.log.forEach((e, k) => {
      const a = k > 0 ? g.log[k - 1] : null;
      if (e.kind === 'attack') lastAtk[e.turn] = e;
      if (e.kind === 'item' && (e.text === 'spotlight' || e.text === 'sensor')) lastCast[e.turn] = e;
      let by = e.seat;
      if ((e.kind === 'out' && e.text.startsWith('killed')) || (e.kind === 'item' && (e.text === 'defense' || e.text === 'clone')) || (e.kind === 'reveal' && e.text === 'Brute Alien')) by = lastAtk[e.turn] ? lastAtk[e.turn].seat : by;
      else if (e.kind === 'reveal' && (e.text === 'Spotlight' || e.text === 'Sensor' || e.text === 'Invisible Alien')) by = lastCast[e.turn] ? lastCast[e.turn].seat : by;
      else if (e.kind === 'reveal' && e.text.startsWith('Id|') && a && a.turn === e.turn && a.kind === 'reveal' && a.text.startsWith('Id|') && a.seat !== e.seat) by = a.seat;   // the Medic's target
      e.ord = ord(e.turn, by); if (by !== e.seat && e.kind === 'out') e.atk = by;
      if (['noise', 'silence', 'attack', 'hatch'].includes(e.kind) || (e.kind === 'item' && e.text !== 'defense' && e.text !== 'clone') || (e.kind === 'out' && !e.text.startsWith('killed'))) own.add(e.ord);
    });
    g.seats.forEach((s, i) => s.route.forEach((p, k) => {
      if (p.turn === 0) { p.ord = -1; return; }
      p.ord = ord(p.turn, i);
      if (p.note === 'r' || p.note === 'c') { const prev = s.route[k - 1], hit = prev && g.log.find(e => e.kind === 'attack' && e.turn === p.turn && e.cell === prev.cell); if (hit) p.ord = ord(p.turn, hit.seat); }
      else own.add(p.ord);
    }));
    return (g._steps = [{ t: 0, i: -1, ord: -1 }, ...[...own].sort((a, b) => a - b).filter(o => o >= 100 && o < 4100).map(o => ({ t: Math.floor(o / 100), i: o % 100, ord: o }))]);
  }
  const cutoff = g => { const st = prep(g); return mode === 'step' ? st[Math.min(step, st.length - 1)].ord : turn * 100 + 99; };
  const stepLabel = g => { const st = prep(g), k = Math.min(step, st.length - 1), x = st[k]; return `Step <b>${k}</b> / ${st.length - 1}` + (x.i < 0 ? ': the start' : `: turn ${x.t}, player <b>${x.i + 1}</b> ${esc(g.seats[x.i].name)}`); };
  const posAt = (g, i, o) => { let p = null; for (const q of g.seats[i].route) { if (q.ord <= o) p = q.cell; else break; } return p; };
  function seatAt(g, i, C) {   // where the seat is when the game has got as far as order number C, and whether it is out of the game by then
    let pos = null, conv = false;
    for (const p of g.seats[i].route) { if (p.ord <= C) { pos = p.cell; if ((p.note === 'r' || p.note === 'm') && p.turn > 0) conv = true; } else break; }
    const out = g.log.find(e => e.seat === i && e.kind === 'out' && !/^killed\|human/.test(e.text) && e.ord <= C);
    return { pos, conv, out: out ? out.text.split('|')[0] : '' };
  }
  const side = (g, i, t) => (g.seats[i].role0 === 'alien' || g.seats[i].route.some(p => (p.note === 'r' || p.note === 'm') && p.turn > 0 && p.turn <= t) ? 'alien' : 'human');
  function stats(g) {
    if (g._st) return g._st; prep(g);
    const per = g.seats.map(() => ({ noise: 0, bluff: 0, silence: 0, secure: 0, attack: 0, kills: 0, friendly: 0, saved: 0, items: {}, powers: 0, ids: 0 })), tot = { noise: 0, attack: 0, kills: 0, friendly: 0, items: {}, reveals: 0, pods: [] }, turns = {};
    const row = t => turns[t] || (turns[t] = { noise: 0, attack: 0, item: 0, reveal: 0, out: 0, esc: 0 });
    g.log.forEach((e, k) => {
      const p = per[e.seat]; if (!p) return;
      if (e.kind === 'noise') { p.noise++; tot.noise++; row(e.turn).noise++; const at = posAt(g, e.seat, e.ord); if (e.cell !== null && at !== null && at !== e.cell) p.bluff++; }
      else if (e.kind === 'silence') { p.silence++; if (e.text === 'secure') p.secure++; }
      else if (e.kind === 'attack') {
        p.attack++; tot.attack++; row(e.turn).attack++;
        for (let j = k + 1; j < g.log.length && g.log[j].turn === e.turn && g.log[j].kind !== 'attack'; j++) {
          const o = g.log[j]; if (o.kind === 'item' && (o.text === 'defense' || o.text === 'clone')) per[o.seat].saved++;
          if (o.kind === 'out' && o.text.startsWith('killed') && o.seat !== e.seat) { p.kills++; tot.kills++; if (side(g, e.seat, e.turn) === o.text.split('|')[1]) { p.friendly++; tot.friendly++; } }
        }
      } else if (e.kind === 'item') { p.items[e.text] = (p.items[e.text] || 0) + 1; tot.items[e.text] = (tot.items[e.text] || 0) + 1; row(e.turn).item++; }
      else if (e.kind === 'reveal') { tot.reveals++; row(e.turn).reveal++; if (e.text.startsWith('Id|')) p.ids++; }
      else if (e.kind === 'out') { if (e.text.startsWith('escaped')) row(e.turn).esc++; else row(e.turn).out++; }
      else if (e.kind === 'hatch') tot.pods.push({ turn: e.turn, seat: e.seat, ok: e.text === 'ok' });
    });
    g.seats.forEach((s, i) => { per[i].powers = Object.values(s.ab || {}).reduce((a, b) => a + (+b || 0), 0) || s.route.filter(q => q.star).length; per[i].steps = s.route.filter(q => q.turn > 0).length; per[i].sectors = new Set(s.route.map(q => q.cell)).size; });
    return (g._st = { per, tot, turns });
  }

  /* ---------- drawing the map ---------- */
  const COLOR = { '.': '#59627a', s: '#ece6d3', H: '#1c5d93', A: '#a53312' };
  const nameOfResult = g => !g.result ? 'unfinished' : (g.result.aliensWin ? 'Aliens win' : 'Humans win') + ' (' + ({ escape: 'a Human escaped', eliminated: 'all Humans eliminated', time: 'time is up' }[g.result.reason] || g.result.reason) + ')';
  const dims = map => ({ W: HEX * 2 + 1.5 * HEX * (map.cols - 1), H: Math.sqrt(3) * HEX * (map.rows + 0.5) });
  function fitBox(g, whole) {   // the view box that shows every sector the game used, with some margin
    const map = mapOf(g.map), { W, H } = dims(map); if (whole) return { x: 0, y: 0, w: W, h: H };
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
    for (const s of g.seats) for (const p of s.route) if (p.cell !== null) { const q = hexPos(map, p.cell % map.cols, Math.floor(p.cell / map.cols)); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    if (x0 > x1) return { x: 0, y: 0, w: W, h: H };
    const m = HEX * 2.2, w = Math.max(x1 - x0 + 2 * m, W * 0.35), h = Math.max(y1 - y0 + 2 * m, H * 0.35), r = ratio;   // the picture's own proportions (square on a phone)
    let bw = Math.max(w, h * r), bh = bw / r; const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    bw = Math.min(bw, W); bh = Math.min(bh, H);
    return { x: Math.min(Math.max(cx - bw / 2, 0), W - bw), y: Math.min(Math.max(cy - bh / 2, 0), H - bh), w: bw, h: bh };
  }
  const pill = (x, y, txt, col, op = 1, dark = true) => { const w = txt.length * HEX * 0.3 + HEX * 0.28; return `<g opacity="${op}"><rect x="${(x - w / 2).toFixed(1)}" y="${(y - HEX * 0.24).toFixed(1)}" width="${w.toFixed(1)}" height="${(HEX * 0.48).toFixed(1)}" rx="${(HEX * 0.2).toFixed(1)}" fill="${col}" stroke="#000" stroke-opacity=".55" stroke-width=".8"/><text x="${x.toFixed(1)}" y="${(y + HEX * 0.12).toFixed(1)}" class="vw-pill" style="font-size:${(HEX * 0.34).toFixed(1)}px" fill="${dark ? '#111' : '#fff'}">${esc(txt)}</text></g>`; };
  function svgInner(g, T_) {
    const C = cutoff(g), map = mapOf(g.map), P = (c, r) => hexPos(map, c, r), full = dims(map).W, zoomed = vb.w < full * 0.55, at = i => P(i % map.cols, Math.floor(i / map.cols));
    const col = i => PALETTE[i % PALETTE.length][0], dimmed = i => focus >= 0 && focus !== i;
    const inScope = e => (scope === 'turn' ? (mode === 'step' ? e.ord === C : e.turn === T_) : e.ord <= C), fade = e => (scope === 'turn' ? 1 : Math.max(0.25, 1 - (C - e.ord) / 100 * 0.15));
    let s = '';
    for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) {
      const ty = map.grid[r][c]; if (ty === 'x') continue; const { x, y } = P(c, r);
      s += `<polygon points="${hexPts(x, y, HEX - 1)}" fill="${COLOR[ty] || '#1e8a4f'}"/>`;
      if ('1234'.includes(ty)) s += `<text x="${x}" y="${y + 5}" class="vw-n">${ty}</text>`;
      else if (zoomed || layers.names) s += `<text x="${x}" y="${y + 3}" class="vw-id">${cid(c, r)}</text>`;
    }
    const ev = g.log.filter(e => inScope(e));
    if (layers.pods) for (const e of g.log) if (e.kind === 'hatch' && e.ord <= C && e.cell !== null) { const p = at(e.cell), ok = e.text === 'ok'; s += `<circle cx="${p.x}" cy="${p.y}" r="${HEX * 0.82}" fill="none" stroke="${ok ? '#34d399' : '#ef4444'}" stroke-width="3"/>${pill(p.x, p.y + HEX * 0.95, ok ? 'out' : 'dead', ok ? '#34d399' : '#ef4444')}`; }
    // announcements: a ring in the announcer's colour, numbered; a dashed line to the announcer's real sector when it was a decoy
    for (const e of ev) {
    if (e.kind === 'out' && e.text.startsWith('killed')) { const w = posAt(g, e.seat, e.ord - 1); if (w !== null && !dimmed(e.seat)) { const q = at(w); s += `<g opacity="${fade(e)}"><line x1="${q.x - HEX * .5}" y1="${q.y - HEX * .5}" x2="${q.x + HEX * .5}" y2="${q.y + HEX * .5}" stroke="#ff3b30" stroke-width="4"/><line x1="${q.x + HEX * .5}" y1="${q.y - HEX * .5}" x2="${q.x - HEX * .5}" y2="${q.y + HEX * .5}" stroke="#ff3b30" stroke-width="4"/></g>${pill(q.x, q.y + HEX * 0.75, 'killed ' + (e.seat + 1), '#ff3b30', fade(e), false)}`; } }
      if (e.cell === null || dimmed(e.seat)) continue; const p = at(e.cell), o = fade(e);
      if (layers.noise && (e.kind === 'noise' || e.kind === 'attack')) {
        s += `<circle cx="${p.x}" cy="${p.y}" r="${HEX * (e.kind === 'attack' ? 0.95 : 0.8)}" fill="${e.kind === 'attack' ? '#ef444430' : 'none'}" stroke="${e.kind === 'attack' ? '#ff3b30' : col(e.seat)}" stroke-width="${e.kind === 'attack' ? 3.5 : 2.5}" ${e.kind === 'noise' ? 'stroke-dasharray="5 3"' : ''} opacity="${o}"/>`;
        s += `<text x="${p.x.toFixed(1)}" y="${(p.y - HEX * 0.5).toFixed(1)}" class="vw-lab" fill="${col(e.seat)}" opacity="${o}">${e.seat + 1}</text>`;
        const real = posAt(g, e.seat, e.ord);
        if (layers.lies && e.kind === 'noise' && real !== null && real !== e.cell && !pub) { const q = at(real); s += `<line x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}" stroke="${col(e.seat)}" stroke-width="1.6" stroke-dasharray="2 4" opacity="${o}"/>`; }
      }
      if (layers.reveals && e.kind === 'reveal' && (e.text === 'Spotlight' || e.text === 'Sensor')) s += `<circle cx="${p.x}" cy="${p.y}" r="${HEX * 1.05}" fill="${e.text === 'Spotlight' ? '#fde04730' : 'none'}" stroke="${e.text === 'Spotlight' ? '#fde047' : '#60a5fa'}" stroke-width="3" stroke-dasharray="2 3" opacity="${o}"/>${pill(p.x, p.y + HEX * 0.1, e.text === 'Spotlight' ? 'spot ' + (e.seat + 1) : 'sens ' + (e.seat + 1), e.text === 'Spotlight' ? '#fde047' : '#60a5fa', o)}`;
    }
    if (!pub) {
      if (layers.routes) g.seats.forEach((seat, i) => {
        const pts = seat.route.filter(p => p.ord <= C && p.cell !== null);
        for (let k = 1; k < pts.length; k++) {
          const a = at(pts[k - 1].cell), b = at(pts[k].cell), recent = pts[k].turn > T_ - 3 && (mode === 'round' || pts[k].ord > C - 300), tp = pts[k].note === 't';
          s += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="${tp ? '#22d3ee' : col(i)}" stroke-width="${recent ? 4.5 : 2.5}" stroke-linecap="round" ${tp ? 'stroke-dasharray="6 5"' : ''} opacity="${dimmed(i) ? 0.12 : recent ? 0.95 : 0.4}"/>`;
        }
      });
      // markers: seats on the same sector are spread around its middle
      const byCell = new Map();
      g.seats.forEach((seat, i) => { const fi = seatAt(g, i, C); if (fi.pos === null) return; fi.i = i; (byCell.get(fi.pos) || byCell.set(fi.pos, []).get(fi.pos)).push(fi); });
      for (const [cell, list] of byCell) {
        const q = at(cell), k = list.length, ring = k === 1 ? 0 : HEX * (k <= 3 ? 0.42 : 0.55), rad = k === 1 ? HEX * 0.52 : HEX * (k <= 3 ? 0.36 : 0.3);
        list.forEach((fi, n) => {
          const ang = -Math.PI / 2 + 2 * Math.PI * n / k, x = q.x + ring * Math.cos(ang), y = q.y + ring * Math.sin(ang), seat = g.seats[fi.i], alien = fi.conv || seat.role0 === 'alien';
          s += fi.out ? `<g opacity="${dimmed(fi.i) ? 0.3 : 1}"><circle class="vw-m" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="#111" stroke="${col(fi.i)}" stroke-width="2.5"/><text x="${x.toFixed(1)}" y="${(y + rad * 0.38).toFixed(1)}" class="vw-x" style="font-size:${(rad * 1.2).toFixed(1)}px">${fi.out === 'escaped' ? '✓' : '✕'}</text></g>`
            : `<g opacity="${dimmed(fi.i) ? 0.3 : 1}"><circle class="vw-m" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${rad}" fill="${col(fi.i)}" stroke="${alien ? '#ff3b30' : '#fff'}" stroke-width="2.5"/><text x="${x.toFixed(1)}" y="${(y + rad * 0.38).toFixed(1)}" class="vw-t" fill="${PALETTE[fi.i % PALETTE.length][1]}" style="font-size:${(rad * 1.15).toFixed(1)}px">${fi.i + 1}</text></g>`;
        });
      }
    }
    // Item cards and Character powers: a tag beside the sector where the player ended the turn, stacked when there are several
    if (layers.cards) {
      const tags = new Map(), put = (cell, label, color, o, dark, tip) => { if (cell === null) return; const l = tags.get(cell) || tags.set(cell, []).get(cell); l.push({ label, color, o, dark, tip }); };
      for (const e of g.log) if (e.kind === 'item' && inScope(e) && !dimmed(e.seat)) put(posAt(g, e.seat, e.ord), ITEM[e.text] ? ITEM[e.text][0] : e.text, ITEM[e.text] ? ITEM[e.text][1] : '#ccc', fade(e), true);
      g.seats.forEach((seat, i) => seat.route.forEach(p => {
        if (!inScope(p) || p.cell === null || dimmed(i) || p.turn === 0) return;
        if (p.star) put(p.cell, '★', '#facc15', fade(p), true); else if (p.note === 's' || p.note === 'l') put(p.cell, p.note === 's' ? 'stay' : 'lurk', '#c4b5fd', fade(p), true);
      }));
      for (const e of g.log) if (inScope(e) && !dimmed(e.seat) && e.kind === 'reveal' && (e.text.startsWith('Id|') || e.text === 'Brute Alien' || e.text === 'Invisible Alien')) put(posAt(g, e.seat, e.ord), e.text.startsWith('Id|') ? 'ID ' + (e.text.split('|')[2] || '').slice(0, 3) : e.text.slice(0, 5), '#e5e7eb', fade(e), true);
      for (const [cell, list] of tags) { const q = at(cell); list.forEach((t, n) => { s += pill(q.x + HEX * 0.7, q.y - HEX * 0.7 - n * HEX * 0.55, t.label, t.color, t.o, t.dark); }); }
    }
    return s;
  }
  const vbText = () => `${vb.x.toFixed(1)} ${vb.y.toFixed(1)} ${vb.w.toFixed(1)} ${vb.h.toFixed(1)}`;
  function eventText(g, e) {
    const map = mapOf(g.map), cell = e.cell !== null && map ? idOf(map, e.cell) : '';
    if (e.kind === 'noise') { const real = posAt(g, e.seat, e.ord); return `noise in ${cell}` + (real !== null && e.cell !== null && real !== e.cell ? ` (really in ${idOf(map, real)})` : ''); }
    if (e.kind === 'attack') return `attack in ${cell}`;
    if (e.kind === 'silence') return e.text === 'secure' ? 'silent sector' : 'silence';
    if (e.kind === 'hatch') return 'escape pod ' + (e.text === 'damaged' ? 'damaged' : e.text === 'ok' ? 'worked' : '');
    if (e.kind === 'out') {
      const [why, role] = e.text.split('|');
      if (why !== 'killed') return `${why === 'escaped' ? 'escaped' : 'trapped'} (${role})`;
      const where = posAt(g, e.seat, e.ord - 1);   // where the victim stood when the attack came, before any restart
      return `killed (${role}) ${where !== null && map ? 'in ' + idOf(map, where) : ''}${e.atk !== undefined ? ' by ' + (e.atk + 1) : ''}${role === 'human' ? ' → restarts as an Alien in the Alien sector' : ''}`;
    }
    if (e.kind === 'item') return `plays ${e.text}`;
    if (e.kind === 'reveal') return e.text.startsWith('Id|') ? 'identity revealed: ' + e.text.slice(3).replace('|', ', ') : e.text === 'Spotlight' || e.text === 'Sensor' ? `${e.text}: position shown (${cell})` : e.text;
    return `${e.kind} ${e.text || ''}`;
  }
  const dot = i => `<span class="vw-dot" style="background:${PALETTE[i % PALETTE.length][0]}"></span>`;
  const seatRole = s => (s.role0 === s.role ? s.role : s.role0 + ' → ' + s.role) + (s.char ? ', ' + s.char : '');
  const seatResult = s => (s.over === 'escaped' ? 'escaped' : s.over === 'trapped' ? 'trapped' : s.over === 'dead' ? 'killed' : s.role0 !== s.role ? 'became an Alien' : 'in the game at the end');

  /* ---------- the side panels ---------- */
  const eventsHtml = (g, t) => g.log.filter(e => (mode === 'step' ? e.ord === cutoff(g) : e.turn === t) && (focus < 0 || e.seat === focus)).map(e => `<li>${dot(e.seat)}<b>${e.seat + 1}</b> ${esc(eventText(g, e))}</li>`).join('') || '<li class="dim">Nothing announced.</li>';
  function turnPanel(g, t) {
    const where = g.seats.map((s, i) => { const fi = seatAt(g, i, cutoff(g)); return `<span class="vw-chip${focus === i ? ' on' : ''}" data-act="vwfocus" data-i="${i}" role="button" tabindex="0">${dot(i)}${i + 1} ${fi.pos === null ? '–' : fi.out ? (fi.out === 'escaped' ? '✓' : '✕') : idOf(mapOf(g.map), fi.pos)}</span>`; }).join('');
    return `<p class="dim vw-note">Where everybody is ${mode === 'step' ? 'after this step' : 'at the end of the turn'} (tap to follow one player):</p><div class="vw-chips">${where}</div><h4>${mode === 'step' ? stepLabel(g) : 'Turn ' + t}</h4><ul class="vw-ev">${eventsHtml(g, t)}</ul>`;
  }
  function playersPanel(g) {
    const S_ = stats(g);
    return `<ul class="vw-pl">${g.seats.map((s, i) => {
      const p = S_.per[i], items = Object.entries(p.items).map(([k, n]) => `${k}${n > 1 ? ' ×' + n : ''}`).join(', '), left = (s.items || []).join(', '), pw = Object.entries(s.ab || {}).map(([k, n]) => `${k}${n > 1 ? ' ×' + n : ''}`).join(', ');
      return `<li class="vw-p${focus === i ? ' on' : ''}" data-act="vwfocus" data-i="${i}" role="button" tabindex="0">${dot(i)}<b>${i + 1}</b> ${esc(s.name)}${s.kind === 'person' ? ' <span class="vw-badge people">person</span>' : s.bot ? ` <span class="vw-badge">${esc(s.bot)}</span>` : ''}
        <br><small class="${s.role === 'alien' ? 'vw-al' : ''}">${esc(seatRole(s))} · ${seatResult(s)}</small>
        <small class="vw-nums">${p.steps} moves · ${p.sectors} sectors · ${p.noise} noises${p.bluff ? ` (${p.bluff} decoys)` : ''}${p.attack ? ` · ${p.attack} attacks, ${p.kills} kills${p.friendly ? ` (${p.friendly} friendly)` : ''}` : ''}${p.secure ? ` · ${p.secure} turns in a secure sector` : ''}
        ${items ? '<br>cards played: ' + esc(items) : ''}${left ? '<br>cards kept: ' + esc(left) : ''}${pw ? '<br>powers: ' + esc(pw) : ''}</small></li>`;
    }).join('')}</ul>`;
  }
  function statsPanel(g) {
    const S_ = stats(g), T_ = S_.tot, items = Object.entries(T_.items).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ${n}`).join(', ') || 'none', pods = T_.pods.map(p => `turn ${p.turn}: seat ${p.seat + 1} ${p.ok ? 'escaped' : 'found it damaged'}`).join('; ') || 'none used';
    const bl = S_.per.reduce((a, p) => a + p.bluff, 0), first = g.log.find(e => e.kind === 'attack'), esc_ = g.log.find(e => e.kind === 'out' && e.text.startsWith('escaped'));
    const rows = [['Result', nameOfResult(g)], ['Turns', g.turns], ['Noises announced', `${T_.noise}, of which ${bl} decoys (announced away from the real sector)`], ['Attacks', `${T_.attack}, ${T_.kills} kills${T_.friendly ? `, ${T_.friendly} friendly` : ''}`],
      ['First attack', first ? 'turn ' + first.turn + ', seat ' + (first.seat + 1) : 'none'], ['First escape', esc_ ? 'turn ' + esc_.turn + ', seat ' + (esc_.seat + 1) : 'none'], ['Cards played', items], ['Reveals (Spotlight, Sensor, identities)', T_.reveals], ['Escape pods', pods]];
    const head = ['#', 'Role', 'Moves', 'Noise', 'Decoy', 'Atk', 'Kills', 'Cards', 'Powers'];
    return `<dl class="vw-dl">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('')}</dl><div class="vw-scroll"><table class="vw-tab"><thead><tr>${head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${g.seats.map((s, i) => { const p = S_.per[i];
      return `<tr data-act="vwfocus" data-i="${i}" class="${focus === i ? 'on' : ''}"><td>${dot(i)}${i + 1}</td><td class="${s.role === 'alien' ? 'vw-al' : ''}">${esc(s.role0 === s.role ? s.role : s.role0 + '→' + s.role)}</td><td>${p.steps}</td><td>${p.noise}</td><td>${p.bluff}</td><td>${p.attack}</td><td>${p.kills}</td><td>${Object.values(p.items).reduce((a, b) => a + b, 0)}</td><td>${p.powers}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function timelinePanel(g) {
    const S_ = stats(g), max = Math.min(g.turns, 40), rows = [];
    for (let t = 1; t <= max; t++) { const r = S_.turns[t] || {}; rows.push(`<button class="vw-tl${t === turn ? ' on' : ''}" data-act="vwgo" data-t="${t}"><b>${t}</b><span>${r.noise ? `<i class="n">${r.noise} noise</i>` : ''}${r.attack ? `<i class="a">${r.attack} attack</i>` : ''}${r.item ? `<i class="c">${r.item} card</i>` : ''}${r.reveal ? `<i class="r">${r.reveal} reveal</i>` : ''}${r.out ? `<i class="o">${r.out} out</i>` : ''}${r.esc ? `<i class="e">${r.esc} escaped</i>` : ''}</span></button>`); }
    return `<p class="dim vw-note">Tap a turn to go there.</p><div class="vw-tls">${rows.join('')}</div>`;
  }
  function logPanel(g) {
    const kinds = [...new Set(g.log.map(e => e.kind))], list = g.log.filter(e => (logF.seat < 0 || e.seat === logF.seat) && (!logF.kind || e.kind === logF.kind));
    return `<div class="row two"><select id="vw-lf-seat" aria-label="Player"><option value="-1">All players</option>${g.seats.map((s, i) => `<option value="${i}"${logF.seat === i ? ' selected' : ''}>${i + 1} ${esc(s.name)}</option>`).join('')}</select>
      <select id="vw-lf-kind" aria-label="Kind"><option value="">All events</option>${kinds.map(k => `<option${logF.kind === k ? ' selected' : ''}>${k}</option>`).join('')}</select></div>
      <p class="dim vw-note">${list.length} of ${g.log.length} events. Tap one to go to its turn.</p><ul class="vw-ev vw-log">${list.map(e => `<li data-act="vwgo" data-t="${e.turn}" role="button" tabindex="0"><small>T${e.turn}</small> ${dot(e.seat)}<b>${e.seat + 1}</b> ${esc(eventText(g, e))}</li>`).join('')}</ul>`;
  }
  const panel = g => (tab === 'players' ? playersPanel(g) : tab === 'stats' ? statsPanel(g) : tab === 'time' ? timelinePanel(g) : tab === 'log' ? logPanel(g) : turnPanel(g, Math.min(turn, Math.min(g.turns, 40))));
  function summary(g) {
    const S_ = stats(g);
    return [`${g.title} · ${mapName(g.map)} · ${g.seats.length} players · ${g.turns} turns · ${nameOfResult(g)}`, ...g.seats.map((s, i) => { const p = S_.per[i]; return `${i + 1} ${s.name}: ${seatRole(s)}, ${seatResult(s)}; ${p.noise} noises (${p.bluff} decoys), ${p.attack} attacks, ${p.kills} kills, cards ${JSON.stringify(p.items)}`; })].join('\n');
  }

  /* ---------- the list ---------- */
  function filtered() {
    let l = all.filter(g => (f.src === 'all' || (f.src === 'auto' ? g.auto : f.src === 'players' ? g.kind === 'players' && !g.auto : g.kind === f.src)) && (!f.res || (g.result ? (g.result.aliensWin ? 'aliens' : 'humans') : 'none') === f.res) && (!f.n || String(g.seats.length) === f.n) && (!f.map || g.map === f.map));
    const by = { new: (a, b) => (b.at || 0) - (a.at || 0) || b.no - a.no, old: (a, b) => (a.at || 0) - (b.at || 0) || a.no - b.no, long: (a, b) => b.turns - a.turns, short: (a, b) => a.turns - b.turns, big: (a, b) => b.seats.length - a.seats.length };
    return l.sort(by[f.sort]);
  }
  function listHtml() {
    const list = filtered(), pages = Math.max(1, Math.ceil(list.length / PAGE)); f.page = Math.min(f.page, pages - 1);
    const count = k => all.filter(g => k === 'all' || (k === 'auto' ? g.auto : k === 'players' ? g.kind === 'players' && !g.auto : g.kind === k)).length, sel = (id, cur, opts, label) => `<label class="vw-sel"><small>${label}</small><select data-vwf="${id}">${opts.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
    const maps = [...new Set(all.map(g => g.map))].sort(), sizes = [...new Set(all.map(g => g.seats.length))].sort((a, b) => a - b);
    const chips = SRC.map(([k, l]) => `<button class="btn${f.src === k ? ' primary' : ''}" data-act="vwsrc" data-s="${k}">${l} <small>${count(k)}</small></button>`).join('');
    const filters = `<div class="vw-filters">${sel('sort', f.sort, [['new', 'Newest first'], ['old', 'Oldest first'], ['long', 'Longest'], ['short', 'Shortest'], ['big', 'Most players']], 'Sort')}${sel('res', f.res, [['', 'Any'], ['humans', 'Humans win'], ['aliens', 'Aliens win'], ['none', 'Unfinished']], 'Result')}
      ${sel('n', f.n, [['', 'Any'], ...sizes.map(n => [String(n), n + ' players'])], 'Table')}${sel('map', f.map, [['', 'Any'], ...maps.map(m => [m, mapName(m)])], 'Map')}</div>`;
    const rows = list.slice(f.page * PAGE, (f.page + 1) * PAGE).map(g => `<li class="adm-row vw-row" data-act="vwopen" data-no="${g.no}" role="button" tabindex="0"><span class="vw-no">#${g.no}</span><span class="who"><b>${esc(g.title)}</b> <span class="vw-badge t-${g.kind}">${typeOf(g)}</span>
      <small>${esc(day(g.at))}</small><small>${esc(mapName(g.map))} · ${g.seats.length} players${people(g) ? ` (${people(g)} ${people(g) === 1 ? 'person' : 'people'})` : ''} · ${g.turns} turns</small><small class="${g.result ? (g.result.aliensWin ? 'vw-al' : 'vw-hu') : ''}">${esc(nameOfResult(g))}</small></span></li>`).join('');
    const pager = pages > 1 ? `<div class="vw-pager"><button class="btn" data-act="vwpage" data-d="-1"${f.page === 0 ? ' disabled' : ''}>◀</button><span>Page ${f.page + 1} of ${pages} · ${list.length} games</span><button class="btn" data-act="vwpage" data-d="1"${f.page >= pages - 1 ? ' disabled' : ''}>▶</button></div>` : `<p class="dim vw-note">${list.length} games</p>`;
    const bulk = f.src === 'auto' && list.length ? `<p class="dim vw-note">These records were stored by scripts (tests and tools), not by people: they have no build number. They are safe to delete.</p><button class="btn danger wide" data-act="vwdelall">Delete all ${list.length} automated records</button>` : '';
    return `<div class="vw-chips src">${chips}</div>${bulk}${filters}${rows ? `<ul class="plist adm-list">${rows}</ul>` : '<p class="dim">No games match.</p>'}${pager}`;
  }

  /* ---------- the screen ---------- */
  function html() {
    const bar = `<div class="row two"><button class="btn" data-act="vwreload">${loading ? 'Loading…' : 'Refresh'}</button><label class="btn vw-file">Open a game log file<input id="vw-file" type="file" accept=".json,application/json" hidden></label></div>`;
    if (cur) return analysisHtml(cur);
    if (!loading && !all.length && !error && !T.vwTried) { T.vwTried = true; setTimeout(load, 0); }
    return `${bar}${error ? `<p class="dim">${esc(error)}</p>` : ''}${loading ? '<p class="dim">Loading the games…</p>' : all.length ? listHtml() : '<p class="dim">No games yet.</p>'}`;
  }
  function analysisHtml(g) {
    const max = Math.min(g.turns, 40), tt = Math.min(turn, max), tg = (k, l) => `<label class="vw-tg"><input type="checkbox" data-vwl="${k}"${layers[k] ? ' checked' : ''}><span>${l}</span></label>`;
    const meta = `<span class="vw-badge t-${g.kind}">${typeOf(g)}</span> ${esc(day(g.at))} · ${esc(mapName(g.map))} · ${g.seats.length} players${people(g) ? ` (${people(g)} ${people(g) === 1 ? 'person' : 'people'})` : ''} · ${g.turns} turns${g.mode ? ' · ' + esc(g.mode) : ''}${g.build ? ' · build ' + esc(g.build) : ''}${g.note ? '<br>' + esc(g.note) : ''}`;
    return `<div class="vw-top"><button class="btn" data-act="vwback">← All games (${filtered().length})</button><button class="btn" data-act="vwcopy">Copy summary</button>${g.dbpath ? '<button class="btn danger" data-act="vwdel">Delete</button>' : ''}</div>
      <h3>#${g.no} ${esc(g.title)}</h3><p class="dim vw-meta">${meta}<br><b class="${g.result && g.result.aliensWin ? 'vw-al' : 'vw-hu'}">${esc(nameOfResult(g))}</b></p>
      <div class="vw-main"><div class="vw-stage">
        <div class="vw-bar" id="vw-roundbar"><button class="btn" data-act="vwstep" data-d="-1" aria-label="Previous turn">◀</button><button class="btn" data-act="vwplay" id="vw-playb" aria-label="Play">${play ? '❚❚' : '▶▶'}</button><input id="vw-turn" type="range" min="0" max="${max}" value="${tt}" aria-label="Turn"><button class="btn" data-act="vwstep" data-d="1" aria-label="Next turn">▶</button></div>
        <p class="vw-turn">Turn <b id="vw-tn">${tt}</b> / ${max}</p>
        <div class="vw-bar vw-stepbar"><button class="btn" data-act="vwsstep" data-d="-1" aria-label="Previous step">◀</button><input id="vw-step" type="range" min="0" max="${prep(g).length - 1}" value="${Math.min(step, prep(g).length - 1)}" aria-label="Step: one player's turn at a time"><button class="btn" data-act="vwsstep" data-d="1" aria-label="Next step">▶</button></div>
        <p class="vw-turn vw-steplab" id="vw-sl">${stepLabel(g)}</p>
        <div class="vw-wrap" id="vw-map"><svg id="vw-svg" class="vw-svg" style="aspect-ratio:${ratio}" viewBox="${vbText()}" role="img" aria-label="Map of the game"><g id="vw-g">${svgInner(g, tt)}</g></svg>
          <div class="vw-zoom"><button class="btn" data-act="vwzoom" data-f="0.6" aria-label="Zoom in">+</button><button class="btn" data-act="vwzoom" data-f="1.6" aria-label="Zoom out">−</button><button class="btn" data-act="vwfit" data-w="0" aria-label="Fit the routes">⤢</button><button class="btn" data-act="vwfit" data-w="1" aria-label="Whole map">▦</button></div></div>
        <details class="vw-lay"><summary>Layers and view options</summary><div class="vw-layers">${tg('routes', 'Routes')}${tg('noise', 'Announcements')}${tg('cards', 'Cards &amp; powers')}${tg('reveals', 'Spotlight / Sensor')}${tg('pods', 'Escape pods')}${tg('names', 'Sector names')}${tg('lies', 'Decoy lines')}
          <label class="vw-tg"><input type="checkbox" id="vw-pub"${pub ? ' checked' : ''}><span>Table view (hide real positions)</span></label><label class="vw-tg"><input type="checkbox" id="vw-scope"${scope === 'all' ? ' checked' : ''}><span>Show all turns so far</span></label></div></details>
        <details class="vw-legend"><summary>Legend</summary><p>Numbered markers are the players; red outline = Alien, ✓ escaped, ✕ out. Dashed ring = a noise (colour and number of who announced it), red = attack. Yellow ring = Spotlight, blue = Sensor.
          Tags beside a sector: ${Object.entries(ITEM).map(([k, v]) => `<span class="vw-key" style="background:${v[1]}">${v[0]}</span> ${k}`).join(' · ')} · <span class="vw-key" style="background:#facc15">★</span> a Character power · stay, lurk · ID = identity shown.
          A dashed cyan line is a Teleport. Green or red ring on a pod: it worked or was damaged. Tags sit where the player ended that turn.</p></details>
      </div><div class="vw-side"><div class="seg vw-tabs" role="tablist">${[['turn', 'Turn'], ['players', 'Players'], ['stats', 'Stats'], ['time', 'Timeline'], ['log', 'Log']].map(([k, l]) => `<button role="tab" data-act="vwtab" data-k="${k}" aria-checked="${tab === k}">${l}</button>`).join('')}</div><div id="vw-panel">${panel(g)}</div></div></div>`;
  }
  function paint() {   // the map, the slider and the panel; the slider keeps its place
    const g = cur; if (!g) return; const max = Math.min(g.turns, 40), tt = Math.min(turn, max), el = id => document.getElementById(id);
    if (el('vw-g')) el('vw-g').innerHTML = svgInner(g, tt); if (el('vw-svg')) el('vw-svg').setAttribute('viewBox', vbText());
    if (el('vw-tn')) el('vw-tn').textContent = tt; if (el('vw-turn')) el('vw-turn').value = tt; if (el('vw-panel')) el('vw-panel').innerHTML = panel(g);
    if (el('vw-step')) el('vw-step').value = Math.min(step, prep(g).length - 1); if (el('vw-sl')) el('vw-sl').innerHTML = stepLabel(g);
    const rb = el('vw-roundbar'), sb = document.querySelector('.vw-stepbar'); if (rb) rb.classList.toggle('vw-off', mode === 'step'); if (sb) sb.classList.toggle('vw-off', mode !== 'step');
    const pb = el('vw-playb'); if (pb) pb.textContent = play ? '❚❚' : '▶▶';
  }
  const stop = () => { if (play) { clearInterval(play); play = null; } };
  function setTurn(n) { const g = cur; if (!g) return; mode = 'round'; turn = Math.max(0, Math.min(Math.min(g.turns, 40), n)); const st = prep(g); step = Math.max(0, st.reduce((a, x, k) => (x.t <= turn ? k : a), 0)); paint(); }
  function setStep(k) { const g = cur; if (!g) return; const st = prep(g); mode = 'step'; step = Math.max(0, Math.min(st.length - 1, k)); turn = st[step].t; paint(); }
  function zoom(k, cx, cy) {   // k < 1 zooms in; (cx, cy) in map units stays where it is
    const g = cur; if (!g) return; const { W } = dims(mapOf(g.map)), r = vb.h / vb.w, nw = Math.min(W, Math.max(W / 12, vb.w * k)), nh = nw * r;
    cx = cx === undefined ? vb.x + vb.w / 2 : cx; cy = cy === undefined ? vb.y + vb.h / 2 : cy;
    vb = { x: cx - (cx - vb.x) * nw / vb.w, y: cy - (cy - vb.y) * nh / vb.h, w: nw, h: nh }; clampBox(g); paint();
  }
  function clampBox(g) { const { W, H } = dims(mapOf(g.map)); vb.x = Math.min(Math.max(vb.x, -HEX), W - vb.w + HEX); vb.y = Math.min(Math.max(vb.y, -HEX), H - vb.h + HEX); }
  function open(g) { stop(); ratio = innerWidth < 700 ? 1 : 23 / 14; cur = g; mode = 'round'; turn = g.turns; step = prep(g).length - 1; focus = -1; tab = 'turn'; logF = { seat: -1, kind: '' }; vb = fitBox(g, false); renderFlow(); }
  const actions = {
    vwsrc(b) { f.src = b.dataset.s; f.page = 0; renderFlow(); },
    vwpage(b) { f.page = Math.max(0, f.page + Number(b.dataset.d)); renderFlow(); },
    vwreload() { T.vwTried = true; load(); },
    vwopen(b) { const g = all.find(x => x.no === +b.dataset.no); if (g) open(g); },
    vwback() { stop(); cur = null; renderFlow(); },
    vwstep(b) { stop(); setTurn(turn + Number(b.dataset.d)); },
    vwsstep(b) { stop(); setStep(step + Number(b.dataset.d)); },
    vwgo(b) { stop(); setTurn(+b.dataset.t); },
    vwplay() { if (play) { stop(); paint(); return; } if (mode === 'step') { const n = prep(cur).length - 1; if (step >= n) step = 0; play = setInterval(() => { if (step >= n) { stop(); paint(); return; } setStep(step + 1); }, 600); } else { const max = Math.min(cur.turns, 40); if (turn >= max) turn = 0; play = setInterval(() => { if (turn >= max) { stop(); paint(); return; } setTurn(turn + 1); }, 900); } paint(); },
    vwzoom(b) { zoom(Number(b.dataset.f)); },
    vwfit(b) { if (cur) { vb = fitBox(cur, b.dataset.w === '1'); paint(); } },
    vwfocus(b) { focus = focus === +b.dataset.i ? -1 : +b.dataset.i; paint(); },
    vwtab(b) { tab = b.dataset.k; renderFlow(); },
    async vwdel() { const g = cur; if (!g || !g.dbpath || !confirm('Delete this game record for good?')) return; try { await Sync.setPath(g.dbpath, null); all = all.filter(x => x !== g); cur = null; renderFlow(); } catch (e) { toast('Could not delete: ' + (e.code || e.message) + ' (deploy the new database rules first)'); } },
    async vwdelall() { const l = filtered().filter(g => g.dbpath); if (!l.length || !confirm(`Delete ${l.length} automated game records for good?`)) return; let n = 0; try { for (const g of l) { await Sync.setPath(g.dbpath, null); all = all.filter(x => x !== g); n++; } } catch (e) { toast(`Deleted ${n}, then: ${e.code || e.message} (deploy the new database rules first)`); } renderFlow(); },
    vwcopy() { try { navigator.clipboard.writeText(summary(cur)); toast('Summary copied'); } catch (_) { toast('Could not copy'); } }
  };
  /* moving the picture: one finger or the mouse drags, two fingers pinch, the wheel zooms */
  const ptrs = new Map(); let last = null;
  const onMap = e => e.target && e.target.closest && e.target.closest('#vw-svg');
  const toMap = (e, svgEl) => { const r = svgEl.getBoundingClientRect(); return { x: vb.x + (e.clientX - r.left) / r.width * vb.w, y: vb.y + (e.clientY - r.top) / r.height * vb.h }; };
  document.addEventListener('pointerdown', e => { const s = onMap(e); if (!s) return; ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); last = null; try { s.setPointerCapture(e.pointerId); } catch (_) { /* noop */ } });
  document.addEventListener('pointermove', e => {
    const s = document.getElementById('vw-svg'); if (!s || !ptrs.has(e.pointerId) || !cur) return;
    const prev = ptrs.get(e.pointerId), r = s.getBoundingClientRect(); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { vb.x -= (e.clientX - prev.x) / r.width * vb.w; vb.y -= (e.clientY - prev.y) / r.height * vb.h; clampBox(cur); paint(); }
    else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y); if (last) { const c = toMap({ clientX: (a.x + b.x) / 2, clientY: (a.y + b.y) / 2 }, s); zoom(last / d, c.x, c.y); } last = d; }
  });
  const end = e => { ptrs.delete(e.pointerId); last = null; };
  document.addEventListener('pointerup', end); document.addEventListener('pointercancel', end);
  document.addEventListener('wheel', e => { const s = onMap(e); if (!s || !cur) return; e.preventDefault(); const c = toMap(e, s); zoom(e.deltaY < 0 ? 0.85 : 1.18, c.x, c.y); }, { passive: false });
  document.addEventListener('keydown', e => { if (!cur || !document.getElementById('vw-svg') || /INPUT|SELECT|TEXTAREA/.test((e.target || {}).tagName || '')) return; if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { stop(); const d = e.key === 'ArrowLeft' ? -1 : 1; if (mode === 'step') setStep(step + d); else setTurn(turn + d); } });
  document.addEventListener('input', e => { if (e.target && e.target.id === 'vw-turn') { stop(); setTurn(+e.target.value); } else if (e.target && e.target.id === 'vw-step') { stop(); setStep(+e.target.value); } });
  document.addEventListener('change', e => {
    const t = e.target; if (!t) return;
    const file = t.id === 'vw-file' && t.files[0]; if (file) { file.text().then(tx => useFile(tx, file.name)); return; }
    if (t.dataset && t.dataset.vwf) { f[t.dataset.vwf] = t.value; f.page = 0; renderFlow(); }
    else if (t.dataset && t.dataset.vwl) { layers[t.dataset.vwl] = t.checked; paint(); }
    else if (t.id === 'vw-pub') { pub = t.checked; paint(); } else if (t.id === 'vw-scope') { scope = t.checked ? 'all' : 'turn'; paint(); }
    else if (t.id === 'vw-lf-seat') { logF.seat = +t.value; paint(); } else if (t.id === 'vw-lf-kind') { logF.kind = t.value; paint(); }
  });
  return { html, actions, useFile, setTurn, setStep, steps: g => prep(g), zoom, fromDump, fromRecord, fromNet, parseAny, stats, state: () => ({ all, cur, turn, mode, step, vb, focus, tab, f }) };
})();
if (typeof window !== 'undefined') window.Viewer = Viewer;
