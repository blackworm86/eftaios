'use strict';
/* Pass and play: several players share one device with digital cards.
   Each seat keeps its private state (role, route, items, suspicions); the log, hatches, decks and turn are shared.
   Between turns a hand-over screen hides everything until the next player taps their name. */
const Hot = (() => {
  const KEY = 'eftaios.hot';
  const PRIV = ['role', 'char', 'pos', 'path', 'fed', 'adr', 'phase', 'res', 'over', 'items', 'reborn', 'ab', 'cat', 'undo', 'sus', 'shapes', 'mkN', 'annos', 'outSent', 'tab', 'name', 'track', 'marks', 'notes', 'extraPlayers'];
  let H = null;
  const load = () => { try { H = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { H = null; } return H; };
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(H)); } catch (_) { /* full */ } };
  const seat = i => H.seats[i === undefined ? H.cur : i];
  const log = e => H.log.unshift(Object.assign({ id: uid(), turn: H.turn, text: e.kind, sector: null, at: Date.now() }, e));
  const notify = (i, msg) => { (seat(i).notices = seat(i).notices || []).push(msg); };
  const counts = () => { const c = {}; for (const k of ['sector', 'hatch']) c[k] = { d: H.decks[k].draw.length, x: H.decks[k].disc.length }; return c; };

  /* move the private fields between the global S and the current seat */
  function seatOut() { const st = seat().state; PRIV.forEach(k => { st[k] = S[k]; }); H.turn = S.turn; }
  function seatIn() {
    const st = seat().state, keep = S.customMaps;
    S = Object.assign(fresh(), { stage: 'game', hot: true, online: true, mode: H.mode, mapId: H.mapId, customMaps: keep, turn: H.turn }, st);
    S.log = H.log; S.hatches = H.hatches; T.counts = counts();
  }
  function saveAll() { if (!H) return; seatOut(); store(); save(); }

  function out(i, why) {
    const st = seat(i).state;
    log({ by: seat(i).id, who: seat(i).name, kind: 'out', text: (why === 'dead' ? 'killed' : why) + '|' + st.role + '|' + (st.reborn ? '' : st.char || '') });
    H.last = why === 'escaped' ? 'escaped' : 'lost';
  }
  function evaluate() {
    if (H.result) return;
    const humans = H.seats.filter(s => s.role0 === 'human');
    const aboard = humans.filter(s => !s.state.over && s.state.role === 'human'), escaped = humans.filter(s => s.state.over === 'escaped');
    let r = null;
    if (!aboard.length) r = { aliensWin: H.last !== 'escaped', reason: H.last === 'escaped' ? 'escape' : 'eliminated' };
    else if (H.turn > MAX_TURN) r = { aliensWin: true, reason: 'time' };
    if (r) { r.escaped = escaped.map(s => s.name); H.result = r; H.passing = false; }
  }

  function showPass() {
    const el = $('#pass'); if (!H || !H.passing || H.result) { el.hidden = true; return; }
    if (soloPerson()) { H.passing = false; store(); el.hidden = true; afterPass(); return; }
    const s = seat();
    el.innerHTML = `<div><div class="cover-ico">⬢</div><p class="dim">${t('Turn {n} of {m}', { n: H.turn, m: MAX_TURN })}</p>
      <h2>${t('Pass the device to')}</h2><p class="passname">${dotIcon('u:' + s.id, true)}${esc(s.name)}</p>
      <p class="dim">${t('Nobody else should look at the screen.')}</p>
      <button class="btn primary big" data-act="hotgo">${t("I'm {p}: start my turn", { p: esc(s.name) })}</button></div>`;
    el.hidden = false;
  }
  function afterPass() {
    const s = seat(), msgs = [];
    if (!s.seen) { s.seen = true; msgs.push(`<p>${t('Your secret role')}:</p>${roleHtml()}`); }
    (s.notices || []).forEach(m => msgs.push(`<p>${esc(m)}</p>`)); s.notices = [];
    const since = H.log.filter(e => e.at > (s.seenAt || 0) && e.by && e.by !== s.id && RECAP.includes(e.kind)).slice(0, 14).reverse();
    if (s.seenAt && since.length) msgs.push(`<p class="dim">${t('Since your last turn')}:</p><ul class="recap">${since.map(e => `<li>${dotIcon(playerKey(e))}<b>${esc(e.who)}</b> · ${logIcon(e)}${esc(entryText(e))}${powerNote(e)}</li>`).join('')}</ul>`);
    s.seenAt = Date.now();
    store();
    if (msgs.length) alertHtml(s.name, msgs.join(''));
  }

  /* next seat still in the game after the current one (a new round starts when the order wraps) */
  function advance() {
    const n = H.seats.length;
    for (let i = 1; i <= n; i++) { const j = (H.cur + i) % n; if (!H.seats[j].state.over) { if (j <= H.cur) H.turn++; return j; } }
    return -1;
  }
  const isBot = i => !!H.seats[i].bot;
  /* play every bot seat from `next` on, until it is a person's turn or the game ends */
  async function runBots(next) {
    let guard = 0;
    while (!H.result && next >= 0 && H.turn <= MAX_TURN && isBot(next) && guard++ < 2000) {
      H.cur = next; const st = seat().state; st.phase = 'move'; st.res = null; st.undo = null;
      if (!st.over) await Bot.turn(botCtx());
      evaluate(); if (H.result) break; next = advance();
    }
    if (!H.result && (next < 0 || H.turn > MAX_TURN)) evaluate();
    if (!H.result && next >= 0) { H.cur = next; H.passing = true; const st = seat().state; st.phase = 'move'; st.res = null; st.adr = false; st.undo = null; }
    if (H.result && isBot(H.cur)) { const p = H.seats.findIndex(s => !s.bot); if (p >= 0) H.cur = p; }   // the result is shown from a person's seat
    T.counts = counts();
  }
  /* what a bot may do: the same actions a player has, nothing more */
  const botCtx = () => ({
    H: { seats: H.seats.map(s => ({ id: s.id, name: s.name })), log: H.log, turn: H.turn, mode: H.mode },   // public view only
    me: seat(), idx: H.cur, log, out,
    think: ms => botThinking(seat().name, ms, !soloPerson()),
    closeHatch(n) { H.hatches[n] = 1; },
    draw(type, two) { const d = H.decks[type]; if (type === 'hatch') return drawPod(d, two).card; const r = deckDraw(d); if (discardable(r.card)) d.disc.push(r.card); if (r.reshuffled) log({ who: t('Game'), kind: 'info', text: RESHUFFLED[type] }); return r.card || ''; },
    discard(id) { H.decks.sector.disc.push(id); },
    mutated() { H.last = 'lost'; },
    sensor: async id => sensorCore(id),
    medic: async id => api.medic(id),
    attack: sector => attackCore(sector, H.cur),
    spotlight: sector => spotCore(sector, H.cur)
  });
  /* only one person left at the device: no need to hide the screen between turns */
  const soloPerson = () => H.seats.filter(s => !s.bot && !s.state.over).length <= 1;
  const RECAP = ['noise', 'silence', 'attack', 'spot', 'hatch', 'item', 'reveal', 'out'];

  /* resolve an attack in a sector by seat `by`: everyone else standing there is hit */
  function attackCore(sector, by) {
    const hits = [];
    H.seats.forEach((s, i) => {
      const st = s.state; if (i === by || st.over || st.pos !== sector) return;
      const r = resolveHit(st, H.mode, H.turn); if (r.immune) return;
      const nm = { name: s.name }, role0 = st.role;
      if (r.def) { log({ by: s.id, who: s.name, kind: 'item', text: 'defense' }); notify(i, t('You were attacked, but your Defense card saved you!')); }
      else if (r.clone) { log({ by: s.id, who: s.name, kind: 'item', text: 'clone' }); notify(i, t('You were attacked, but your Clone saved you! You restart from the Human sector.')); }
      else if (r.reveal) { log({ by: s.id, who: s.name, kind: 'reveal', text: 'Brute Alien' }); notify(i, t('You were attacked: you are immune, and your identity is revealed.')); }
      else if (r.conv) { log({ by: s.id, who: s.name, kind: 'out', text: 'killed|human|' + (r.char || '') }); H.last = 'lost'; notify(i, t('You were killed and restart from the Alien Sector as an Alien.')); }
      else { st.over = 'dead'; st.outSent = true; out(i, 'dead'); notify(i, t('You were attacked and eliminated!')); }
      hits.push(Object.assign(nm, r));
    });
    evaluate(); T.counts = counts();
    return hits;
  }
  /* Spotlight named by seat `by`: everyone in the sector or next to it reveals their position */
  function spotCore(sector, by) {
    const q = parseId(sector), seen = [];
    H.seats.forEach((s, i) => {
      const st = s.state; if (st.over || !q) return;
      const inRange = st.pos === sector || neighbors(T.map, q[0], q[1]).some(([a, b]) => cid(a, b) === st.pos);
      if (!inRange) return;
      if (abilOf(st, H.mode) === 'Invisible Alien' && i !== by) { seen.push({ name: s.name, ident: roleLabel(st.role, st.char) }); log({ by: s.id, who: s.name, kind: 'reveal', text: 'Invisible Alien' }); return; }
      seen.push({ name: i === by ? t('You') : s.name, pos: st.pos });
      log({ by: s.id, who: s.name, kind: 'reveal', text: 'Spotlight', sector: st.pos });
      if (i !== by) notify(i, t('Spotlight! Your position was revealed: {p}', { p: st.pos }));
    });
    return seen;
  }

  /* Sensor named by seat `by`: one player announces the exact position (an Invisible Alien shows its identity instead) */
  function sensorCore(id) {
    const i = H.seats.findIndex(s => s.id === id), s = H.seats[i], st = s && s.state;
    if (!st || st.over) return { seen: [], missing: [] };
    if (abilOf(st, H.mode) === 'Invisible Alien') { log({ by: s.id, who: s.name, kind: 'reveal', text: 'Invisible Alien' }); notify(i, t('Sensor! Your identity was revealed.')); return { seen: [{ name: s.name, ident: roleLabel(st.role, st.char) }], missing: [] }; }
    log({ by: s.id, who: s.name, kind: 'reveal', text: 'Sensor', sector: st.pos }); notify(i, t('Sensor! Your position was revealed: {p}', { p: st.pos }));
    return { seen: [{ name: s.name, pos: st.pos }], missing: [] };
  }
  const api = {
    others: () => H.seats.filter((s, i) => i !== H.cur && !s.state.over).map(s => [s.id, s.name]),
    curId: () => (H ? seat().id : null),
    order: () => (H ? H.seats.map(s => s.id) : []),
    counts: () => (H ? counts() : null),
    isOver: () => !!(H && H.result),
    /* everything about the game, for the saved log: every seat's real route, role, items, and the shared log */
    dump() { if (!H) return null; return { mode: H.mode, map: H.mapId, turn: H.turn, result: H.result, hatches: H.hatches, decksLeft: counts(), log: H.log,
      seats: H.seats.map((s, i) => { const st = i === H.cur ? S : s.state; return { id: s.id, name: s.name, bot: s.bot || null, role0: s.role0, role: st.role, char: st.char || '', reborn: !!st.reborn, over: st.over || null, items: st.items, ab: st.ab, path: st.path }; }) }; },
    /* every seat's real route and final role — only once the game is over */
    routes() { if (!H || !H.result) return {}; const o = {}; H.seats.forEach((s, i) => { const st = i === H.cur ? S : s.state; o[s.id] = { path: st.path || [], role: st.role }; }); return o; },
    result: () => (H && H.result) || {},
    publicPlayers() {
      const o = {}; if (!H) return o;
      H.seats.forEach((s, i) => {
        const st = i === H.cur ? S : s.state, out_ = st.over === 'dead' ? 'killed' : st.over === 'time' ? '' : st.over || '';
        o[s.id] = { name: s.name, out: out_ || undefined, conv: st.role !== s.role0 || undefined, role: (out_ || H.result) ? s.role0 : undefined, char: (out_ || H.result) ? st.char : undefined };
      });
      return o;
    },
    rebind() { if (!load()) { S.hot = false; S.stage = 'welcome'; return; } S.log = H.log; S.hatches = H.hatches; T.counts = counts(); },
    async start(names, mapId, mode, track, bots, setup) {   // setup (admin bot tests): per seat { role, char, items } instead of the random deal
      const deal = dealRoles(names.length), keep = S.customMaps, map = T.maps.find(m => m.id === mapId) || T.maps[0];
      H = { mode, mapId: map.id, turn: 1, cur: 0, passing: true, log: [], hatches: { 1: 0, 2: 0, 3: 0, 4: 0 }, result: null, last: '',
        decks: { sector: deckNew(SECTOR_DECK), hatch: deckNew(HATCH_DECK) }, seats: [] };
      names.forEach((name, i) => {
        const o = setup && setup[i] && setup[i].role ? setup[i] : null, { role, char } = o || deal[i], pos = startSector(map, role, char, mode);
        H.seats.push({ id: 'h' + i, name, bot: (bots && bots[i]) || undefined, role0: role, seen: false, notices: [], state: { name, role, char, pos, path: [{ turn: 0, pos }], fed: false, adr: false, phase: 'move', res: null, over: null, items: o && o.items ? o.items.slice() : [], undo: null, sus: {}, shapes: {}, mkN: 5, outSent: false, tab: 'play', track: track === 'manual' ? 'manual' : 'auto' } });
      });
      T.map = map; S = Object.assign(fresh(), { customMaps: keep });
      S.log = H.log; S.hatches = H.hatches;   // bots read hatches and the log before the first person's turn
      if (seat().bot) await runBots(0);
      seatIn(); store(); save(); boot(); showPass();
    },
    showPass,
    go() { H.passing = false; store(); $('#pass').hidden = true; afterPass(); if (S.pos) focusOn(S.pos); },
    async endTurn() {
      seatOut(); evaluate();
      await runBots(H.result ? -1 : advance());
      store(); seatIn(); save(); boot(); showPass();
    },
    /* the current seat went out of the game (escaped / trapped) during its own turn */
    onOut(why) { if (S.outSent) return; S.outSent = true; seatOut(); out(H.cur, why); evaluate(); store(); if (!H.result) api.endTurn(); else { seatIn(); boot(); } },
    clear() { H = null; try { localStorage.removeItem(KEY); } catch (_) { /* noop */ } },

    /* --- the same interface as the online dealer --- */
    async request(type, extra) {
      if (type === 'discard') { H.decks.sector.disc.push(extra.card); saveAll(); return {}; }
      const d = H.decks[type]; let card;
      if (type === 'hatch') card = drawPod(d, extra && extra.two).card;
      else { const r = deckDraw(d); card = r.card; if (discardable(card)) d.disc.push(card); if (r.reshuffled) log({ who: t('Game'), kind: 'info', text: RESHUFFLED[type] }); }
      T.counts = counts(); saveAll();
      return { type, card: card || '' };
    },
    discard(id) { H.decks.sector.disc.push(id); T.counts = counts(); saveAll(); },
    consumeItem(id) {
      const i = S.items.indexOf(id); if (i < 0) return;
      S.items.splice(i, 1); T.counts = counts();
      log({ by: api.curId(), who: S.name, kind: 'item', text: id }); saveAll();
    },
    async attack(sector) { seatOut(); const hits = attackCore(sector, H.cur); store(); save(); return { hits, missing: [] }; },
    /* Sensor: one player announces the exact position */
    async sensor(id) { seatOut(); const r = sensorCore(id); store(); save(); return r; },
    /* Medic: a player must show who they are */
    async medic(id) {
      const s = H.seats.find(x => x.id === id), st = s && s.state; if (!st) return null;
      log({ by: s.id, who: s.name, kind: 'reveal', text: 'Id|' + st.role + '|' + (st.char || '') });
      return { name: s.name, role: st.role, char: st.char || '' };
    },
    mutated() { H.last = 'lost'; saveAll(); },
    async spotlight(sector) { seatOut(); const seen = spotCore(sector, H.cur); store(); save(); return { seen, missing: [] }; }
  };
  return api;
})();
window.Hot = Hot;
