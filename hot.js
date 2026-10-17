'use strict';
/* Pass and play: several players share one device with digital cards.
   Each seat keeps its private state (role, route, items, suspicions); the log, hatches, decks and turn are shared.
   Between turns a hand-over screen hides everything until the next player taps their name. */
const Hot = (() => {
  const KEY = 'eftaios.hot';
  const PRIV = ['role', 'char', 'pos', 'path', 'fed', 'adr', 'phase', 'res', 'over', 'items', 'undo', 'sus', 'shapes', 'mkAll', 'outSent', 'tab', 'name', 'track', 'marks', 'notes', 'extraPlayers'];
  let H = null;
  const load = () => { try { H = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) { H = null; } return H; };
  const store = () => { try { localStorage.setItem(KEY, JSON.stringify(H)); } catch (_) { /* full */ } };
  const seat = i => H.seats[i === undefined ? H.cur : i];
  const log = e => H.log.unshift(Object.assign({ id: uid(), turn: H.turn, text: e.kind, sector: null, at: Date.now() }, e));
  const notify = (i, msg) => { (seat(i).notices = seat(i).notices || []).push(msg); };
  const counts = () => { const c = {}; for (const k of ['sector', 'item', 'hatch']) c[k] = { d: H.decks[k].draw.length, x: H.decks[k].disc.length }; return c; };

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
    log({ by: seat(i).id, who: seat(i).name, kind: 'out', text: (why === 'dead' ? 'killed' : why) + '|' + st.role + '|' + (st.char || '') });
    H.last = why === 'escaped' ? 'escaped' : 'lost';
  }
  function evaluate() {
    if (H.result) return;
    const humans = H.seats.filter(s => s.role0 === 'human');
    const aboard = humans.filter(s => !s.state.over && s.state.role === 'human'), escaped = humans.filter(s => s.state.over === 'escaped');
    let r = null;
    if (H.mode === 'basic' && escaped.length) r = { aliensWin: false, reason: 'escape' };
    else if (!aboard.length) r = { aliensWin: H.last !== 'escaped', reason: H.last === 'escaped' ? 'escape' : 'eliminated' };
    else if (H.turn > MAX_TURN) r = { aliensWin: true, reason: 'time' };
    if (r) { r.escaped = escaped.map(s => s.name); H.result = r; H.passing = false; }
  }

  function showPass() {
    const el = $('#pass'); if (!H || !H.passing || H.result) { el.hidden = true; return; }
    const s = seat();
    el.innerHTML = `<div><div class="cover-ico">⬢</div><p class="dim">${t('Turn {n} of {m}', { n: H.turn, m: MAX_TURN })}</p>
      <h2>${t('Pass the device to')}</h2><p class="passname">${dotIcon('u:' + s.id, true)}${esc(s.name)}</p>
      <p class="dim">${t('Nobody else should look at the screen.')}</p>
      <button class="btn primary big" data-act="hotgo">${t("I'm {p}: start my turn", { p: esc(s.name) })}</button></div>`;
    el.hidden = false;
  }
  function afterPass() {
    const s = seat(), msgs = [];
    if (!s.seen) { s.seen = true; msgs.push(`<p>${t('Your secret role')}:</p>${sayBox(t(S.role === 'alien' ? 'Alien' : 'Human'), S.role === 'alien' ? 'alert' : '', S.char)}`); }
    (s.notices || []).forEach(m => msgs.push(`<p>${esc(m)}</p>`)); s.notices = [];
    store();
    if (msgs.length) alertHtml(s.name, msgs.join(''));
  }

  const api = {
    curId: () => (H ? seat().id : null),
    order: () => (H ? H.seats.map(s => s.id) : []),
    counts: () => (H ? counts() : null),
    isOver: () => !!(H && H.result),
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
    start(names, mapId, mode) {
      const deal = dealRoles(names.length), keep = S.customMaps, map = T.maps.find(m => m.id === mapId) || T.maps[0];
      H = { mode, mapId: map.id, turn: 1, cur: 0, passing: true, log: [], hatches: { 1: 0, 2: 0, 3: 0, 4: 0 }, result: null, last: '',
        decks: { sector: deckNew(SECTOR_DECK), item: deckNew(ITEM_DECK), hatch: deckNew(HATCH_DECK) }, seats: [] };
      names.forEach((name, i) => {
        const { role, char } = deal[i], pos = find(map, role === 'human' ? 'H' : 'A');
        H.seats.push({ id: 'h' + i, name, role0: role, seen: false, notices: [], state: { name, role, char, pos, path: [{ turn: 0, pos }], fed: false, adr: false, phase: 'move', res: null, over: null, items: [], undo: null, sus: {}, shapes: {}, mkAll: false, outSent: false, tab: 'play' } });
      });
      T.map = map; S = Object.assign(fresh(), { customMaps: keep }); seatIn(); store(); save(); boot(); showPass();
    },
    showPass,
    go() { H.passing = false; store(); $('#pass').hidden = true; afterPass(); if (S.pos) focusOn(S.pos); },
    endTurn() {
      seatOut(); evaluate();
      const n = H.seats.length; let next = -1;
      for (let i = 1; i <= n; i++) { const j = (H.cur + i) % n; if (!H.seats[j].state.over) { if (j <= H.cur) H.turn++; next = j; break; } }
      if (next < 0 || H.turn > MAX_TURN) evaluate();
      if (!H.result && next >= 0) { H.cur = next; H.passing = true; const st = seat().state; st.phase = 'move'; st.res = null; st.adr = false; st.undo = null; }
      store(); seatIn(); save(); boot(); showPass();
    },
    /* the current seat went out of the game (escaped / trapped) during its own turn */
    onOut(why) { if (S.outSent) return; S.outSent = true; seatOut(); out(H.cur, why); evaluate(); store(); if (!H.result) api.endTurn(); else { seatIn(); boot(); } },
    clear() { H = null; try { localStorage.removeItem(KEY); } catch (_) { /* noop */ } },

    /* --- the same interface as the online dealer --- */
    async request(type, extra) {
      if (type === 'discard') { if (ITEMS[extra.card]) H.decks.item.disc.push(extra.card); saveAll(); return {}; }
      const d = H.decks[type], r = deckDraw(d);
      if (r.card && type !== 'item') d.disc.push(r.card);
      if (r.reshuffled) log({ who: t('Game'), kind: 'info', text: RESHUFFLED[type] });
      T.counts = counts(); saveAll();
      return { type, card: r.card || '' };
    },
    discard(id) { if (ITEMS[id]) H.decks.item.disc.push(id); T.counts = counts(); saveAll(); },
    consumeItem(id) {
      const i = S.items.indexOf(id); if (i < 0) return;
      S.items.splice(i, 1); H.decks.item.disc.push(id); T.counts = counts();
      log({ by: api.curId(), who: S.name, kind: 'item', text: id }); saveAll();
    },
    async attack(sector) {
      seatOut(); const hits = [];
      H.seats.forEach((s, i) => {
        const st = s.state; if (i === H.cur || st.over || st.pos !== sector) return;
        if (st.role === 'human' && st.items.includes('defense')) {
          st.items.splice(st.items.indexOf('defense'), 1); H.decks.item.disc.push('defense');
          log({ by: s.id, who: s.name, kind: 'item', text: 'defense' }); notify(i, t('You were attacked, but your Defense card saved you!'));
          hits.push({ name: s.name, def: 1 });
        } else {
          hits.push({ name: s.name, killed: 1, role: st.role, char: st.char });
          if (H.mode === 'infection' && st.role === 'human') { st.role = 'alien'; st.fed = false; log({ by: s.id, who: s.name, kind: 'out', text: 'killed|human|' + (st.char || '') }); H.last = 'lost'; notify(i, t('You are now an Alien, moving from where you fell')); }
          else { st.over = 'dead'; st.outSent = true; out(i, 'dead'); notify(i, t('You were attacked and eliminated!')); }
        }
      });
      evaluate(); T.counts = counts(); store(); save();
      return { hits, missing: [] };
    },
    async spotlight(sector) {
      seatOut(); const q = parseId(sector), seen = [];
      H.seats.forEach((s, i) => {
        const st = s.state; if (st.over || !q) return;
        const inRange = st.pos === sector || neighbors(T.map, q[0], q[1]).some(([a, b]) => cid(a, b) === st.pos);
        if (!inRange) return;
        seen.push({ name: i === H.cur ? t('You') : s.name, pos: st.pos });
        log({ by: s.id, who: s.name, kind: 'reveal', text: 'Spotlight', sector: st.pos });
        if (i !== H.cur) notify(i, t('Spotlight! Your position was revealed: {p}', { p: st.pos }));
      });
      store(); save();
      return { seen, missing: [] };
    }
  };
  return api;
})();
window.Hot = Hot;
