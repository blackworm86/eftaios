'use strict';
/* Digital-card engine.
   - The HOST device is the dealer: it shuffles the decks, deals roles and answers draw requests.
   - Positions never leave the players' devices. Attacks and Spotlights are broadcast; every device
     answers for itself ("am I in that sector?") and the answers are what the table sees. */
const Online = (() => {
  const pending = {}, seen = new Set(), done = new Set();
  let gen = -1, HD = null, hdReady = null;
  const norm = d => ({ draw: d && d.draw || [], disc: d && d.disc || [] });
  const pack = hd => JSON.parse(JSON.stringify(hd));
  const logGame = text => Sync.push({ id: uid(), turn: S.turn, who: t('Game'), kind: 'info', text, sector: '', at: Date.now() });

  async function persist() {
    await Sync.set('hostdata', pack(HD));
    const c = {}; for (const k of ['sector', 'hatch']) c[k] = { d: HD.decks[k].draw.length, x: HD.decks[k].disc.length };
    await Sync.set('counts', c);
  }
  async function loadHost() {
    const v = await Sync.get('hostdata'); if (!v) return null;
    HD = { decks: { sector: norm(v.decks && v.decks.sector), hatch: norm(v.decks && v.decks.hatch) }, roles: v.roles || {}, chars: v.chars || {}, seenOut: v.seenOut || {}, last: v.last || '', bots: v.bots || {} };
    Object.values(HD.bots).forEach(b => { b.state.items = b.state.items || []; b.state.path = b.state.path || []; });
    return HD;
  }

  async function hostReq(req, key) {
    if (!req || done.has(key)) return; done.add(key);
    if (!HD) await hdReady; if (!HD) return;
    const rep = { id: req.id || key, type: req.type };
    if (req.type === 'sector' || req.type === 'hatch') {
      const d = HD.decks[req.type]; let card;
      if (req.type === 'hatch') card = drawPod(d, req.two).card;
      else { const r = deckDraw(d); card = r.card; if (discardable(card)) d.disc.push(card); if (r.reshuffled) logGame(RESHUFFLED[req.type]); }
      rep.card = card === null ? '' : card;
      await Sync.set(`secret/${req.uid}/inbox/${key}`, rep);
    } else if (req.type === 'discard' && req.card) HD.decks.sector.disc.push(req.card);
    else if (req.type === 'medic') {
      const u = req.target, b = HD.bots[u], p = (Sync.players || {})[u] || {};
      rep.role = b ? b.state.role : (p.conv ? 'alien' : HD.roles[u]); rep.char = b ? (b.state.char || '') : (p.conv ? '' : HD.chars[u] || ''); rep.name = p.name || '?';
      await Sync.set(`secret/${req.uid}/inbox/${key}`, rep);
    }
    await persist(); await Sync.del('requests/' + key);
  }

  const aliveOthers = () => Object.entries(Sync.players || {}).filter(([u, p]) => u !== Sync.uid && !p.out).map(([u]) => u);
  function waitReplies(path, expected, ms) {
    return new Promise(res => {
      let got = {}, fin = false, un = null;
      const end = () => { if (fin) return; fin = true; try { un && un(); } catch (_) { /* noop */ } res(got); };
      if (!expected.length) { fin = true; res({}); return; }
      un = Sync.watch(path, v => { got = v || {}; if (expected.every(u => got[u])) end(); });
      setTimeout(end, ms);
    });
  }
  const label_ = (role, char) => t(role === 'alien' ? 'Alien' : 'Human') + (char ? ', ' + t(char) : '');

  /* ---- victim / target side ---- */
  function onAttack(ev, key) {
    if (!ev || seen.has('a' + key)) return; seen.add('a' + key);
    if (Sync.isHolder()) botsAnswerAttack(ev, key);
    if (ev.by === Sync.uid || S.over || S.stage !== 'game' || Date.now() - ev.at > 60000) return;
    if (ev.replies && ev.replies[Sync.uid]) return;
    let rep = { in: false };
    if (S.pos === ev.sector) {
      const r = resolveHit(S, S.mode, S.turn), me = S.name || t('Me');
      if (!r.immune) {
        rep = Object.assign({ in: true }, r);
        if (r.def) Sync.push({ id: uid(), turn: S.turn, who: me, kind: 'item', text: 'defense', sector: '', at: Date.now() });
        else if (r.clone) Sync.push({ id: uid(), turn: S.turn, who: me, kind: 'item', text: 'clone', sector: '', at: Date.now() });
        else if (r.reveal) Sync.push({ id: uid(), turn: S.turn, who: me, kind: 'reveal', text: 'Brute Alien', sector: '', at: Date.now() });
        else if (r.conv) { Sync.setMe({ conv: true, role: 'human', char: r.char || '' }); Sync.push({ id: uid(), turn: S.turn, who: me, kind: 'out', text: 'killed|human|' + (r.char || ''), sector: '', at: Date.now() }); }
        else if (r.killed) S.over = 'dead';   // eliminated: afterChange reports it to the table (log and map)
      }
    }
    const here = rep.in;
    Sync.set(`attacks/${key}/replies/${Sync.uid}`, rep);
    save(); if (S.over || rep.conv || rep.clone) afterChange(); else { render(); hdr(); }
    if (here && rep.conv) toast(t('You were killed and restart from the Alien Sector as an Alien.'));
    else if (here && rep.killed) toast(t('You were attacked and eliminated!'));
    else if (here && rep.def) toast(t('You were attacked, but your Defense card saved you!'));
    else if (here && rep.clone) toast(t('You were attacked, but your Clone saved you! You restart from the Human sector.'));
    else if (here && rep.reveal) toast(t('You were attacked: you are immune, and your identity is revealed.'));
  }
  function onSpot(ev, key) {
    if (!ev || seen.has('s' + key)) return; seen.add('s' + key);
    if (Sync.isHolder()) botsAnswerSpot(ev, key);
    if (S.over || S.stage !== 'game' || Date.now() - ev.at > 60000) return;
    if (ev.replies && ev.replies[Sync.uid]) return;
    if (ev.target && ev.target !== Sync.uid) return;
    const q = parseId(ev.sector);
    const inRange = ev.target ? true : !!q && S.pos && (S.pos === ev.sector || neighbors(T.map, q[0], q[1]).some(([a, b]) => cid(a, b) === S.pos));
    const rep = { in: inRange }, kindTxt = ev.target ? 'Sensor' : 'Spotlight';
    if (inRange && ev.by !== Sync.uid && abilOf(S, S.mode) === 'Invisible Alien') {
      rep.ident = label_(S.role, S.char); Sync.set(`spots/${key}/replies/${Sync.uid}`, rep);
      Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'reveal', text: 'Invisible Alien', sector: '', at: Date.now() }); toast(t('Your identity was revealed.')); return;
    }
    if (inRange) rep.pos = S.pos;
    Sync.set(`spots/${key}/replies/${Sync.uid}`, rep);
    if (inRange) { Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'reveal', text: kindTxt, sector: S.pos, at: Date.now() }); if (ev.by !== Sync.uid) toast(t(kindTxt + '! Your position was revealed: {p}', { p: label(S.pos) })); }
  }
  function consumeItem(id) { const i = S.items.indexOf(id); if (i < 0) return; S.items.splice(i, 1); Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'item', text: id, sector: '', at: Date.now() }); }
  function discard(id) { Sync.set('requests/' + uid(), { uid: Sync.uid, type: 'discard', card: id, at: Date.now() }).catch(() => {}); }

  /* ---------------- bots (played by the host's device) ----------------
     A bot's private state lives in hostdata, which only the host can read. The bot itself is handed the same
     public view as in pass and play (seat names, announcements, turn, rules) plus its own seat. */
  const isBotId = u => String(u).startsWith('bot_');
  const botPush = (b, e) => Sync.push(Object.assign({ id: uid(), turn: T.turnState ? T.turnState.n : S.turn, who: b.name, sector: '', text: e.kind, at: Date.now(), n: 0, ok: 0 }, e, { by: b.id, n: e.n || 0, ok: e.ok ? 1 : 0 }));
  const botOut = (id, why, st) => Sync.set('players/' + id, Object.assign({}, Sync.players[id] || {}, { out: why === 'dead' ? 'killed' : why, role: st.role0 || st.role, char: st.char || '' }));
  function botsAnswerAttack(ev, key) {
    if (!HD || !HD.bots || Date.now() - ev.at > 60000) return; let changed = false;
    Object.entries(HD.bots).forEach(([id, b]) => {
      const st = b.state; if (id === ev.by || st.over || (ev.replies && ev.replies[id])) return;
      let rep = { in: false };
      if (st.pos === ev.sector) {
        const r = resolveHit(st, S.mode, ev.turn || S.turn);
        if (!r.immune) {
          rep = Object.assign({ in: true }, r); changed = true;
          if (r.def) botPush(b, { kind: 'item', text: 'defense' });
          else if (r.clone) botPush(b, { kind: 'item', text: 'clone' });
          else if (r.reveal) botPush(b, { kind: 'reveal', text: 'Brute Alien' });
          else if (r.conv) { Sync.set('players/' + id, Object.assign({}, Sync.players[id] || {}, { conv: true, role: 'human', char: r.char || '' })); botPush(b, { kind: 'out', text: 'killed|human|' + (r.char || '') }); }
          else { st.over = 'dead'; st.outSent = true; botOut(id, 'dead', st); botPush(b, { kind: 'out', text: 'killed|' + (st.role0 || st.role) + '|' + (st.char || '') }); }
        }
      }
      Sync.set(`attacks/${key}/replies/${id}`, rep);
    });
    if (changed) persist();
  }
  function botsAnswerSpot(ev, key) {
    if (!HD || !HD.bots || Date.now() - ev.at > 60000) return;
    const q = parseId(ev.sector);
    Object.entries(HD.bots).forEach(([id, b]) => {
      const st = b.state; if (st.over || (ev.replies && ev.replies[id]) || (ev.target && ev.target !== id)) return;
      const inRange = ev.target ? true : !!q && (st.pos === ev.sector || neighbors(T.map, q[0], q[1]).some(([a, c]) => cid(a, c) === st.pos));
      if (inRange && id !== ev.by && abilOf(st, S.mode) === 'Invisible Alien') { Sync.set(`spots/${key}/replies/${id}`, { in: true, ident: label_(st.role, st.char) }); botPush(b, { kind: 'reveal', text: 'Invisible Alien' }); return; }
      Sync.set(`spots/${key}/replies/${id}`, inRange ? { in: true, pos: st.pos } : { in: false });
      if (inRange) botPush(b, { kind: 'reveal', text: ev.target ? 'Sensor' : 'Spotlight', sector: st.pos });
    });
  }
  let botBusy = ''; const revealed = new Set();
  /* host: when the turn passes to a bot, play it after a short pause, then pass the turn on */
  function maybeBotTurn() {
    const ts = T.turnState;
    /* the table can be restored (or the host duties re-attached) before the map is on screen:
       running a bot then crashes in its graph */
    if (S.stage !== 'game' || !T.map || !T.map.grid) return;
    if (!Sync.isHolder() || !HD || !ts || !isBotId(ts.uid) || !Sync.settings || Sync.settings.status !== 'playing') return;
    const tag = ts.n + ':' + ts.idx + ':' + ts.uid; if (botBusy === tag) return; botBusy = tag;
    setTimeout(() => playBot(ts, tag).catch(e => { console.warn(e); botBusy = ''; }), 900);
  }
  async function playBot(ts, tag) {
    if (S.stage !== 'game' || !T.map || !T.map.grid || !Sync.isHolder()) { botBusy = ''; return; }   // the lease may have moved to another device during the pause
    const b = HD.bots[ts.uid]; if (!b) return;
    if (!b.state.over) {
      const ord = (Sync.settings && Sync.settings.order) || [];
      const view = { seats: ord.map(u => ({ id: u, name: pname(u) })), log: S.log, turn: ts.n, mode: S.mode };
      await Bot.turn({
        H: view, me: { id: b.id, name: b.name, bot: b.level, state: b.state }, idx: ord.indexOf(b.id),
        think: ms => botThinking(b.name, ms, false),
        log: e => botPush(b, e),
        out: (i, why) => botOut(b.id, why, b.state),
        draw(type, two) { const d = HD.decks[type]; if (type === 'hatch') return drawPod(d, two).card; const r = deckDraw(d); if (discardable(r.card)) d.disc.push(r.card); if (r.reshuffled) logGame(RESHUFFLED[type]); return r.card || ''; },
        discard(id) { HD.decks.sector.disc.push(id); },
        closeHatch(n) { S.hatches[n] = 1; Sync.setHatch(n, 1); },
        async attack(sector) {
          const id = uid(), expected = Object.keys(Sync.players || {}).filter(u => u !== b.id && !Sync.players[u].out);
          await Sync.set('attacks/' + id, { by: b.id, sector, at: Date.now() });
          const replies = await waitReplies(`attacks/${id}/replies`, expected, 8000);
          return expected.map(u => replies[u]).filter(r => r && r.in);
        },
        async spotlight(sector) {
          const id = uid(), expected = Object.keys(Sync.players || {}).filter(u => !Sync.players[u].out);
          await Sync.set('spots/' + id, { by: b.id, sector, at: Date.now() });
          await waitReplies(`spots/${id}/replies`, expected, 8000);
        }
      });
      b.state.adr = false;
    }
    await persist();
    if (!T.turnState || T.turnState.n !== ts.n || T.turnState.uid !== ts.uid || botBusy !== tag) return;
    api.evaluate(); if (Sync.settings.status !== 'playing') return;
    const nx = nextTurn(); if (nx) Sync.setTurn(nx);
  }
  /* host: when the game is over, reveal the bots' roles like everyone else's */
  function revealBots() {
    if (!HD || !HD.bots) return;
    Object.entries(HD.bots).forEach(([id, b]) => {
      const p = Sync.players[id]; if (!p || p.route || revealed.has(id)) return; revealed.add(id);
      Sync.upd('players/' + id, { role: b.state.role, char: b.state.char || '' }).then(() => Sync.upd('players/' + id, { route: encodeRoute(b.state.path) })).catch(e => { revealed.delete(id); console.warn(e); });
    });
  }

  let reqGen = -1, hbTimer = null, hdLoading = false;
  /* one requests listener per table generation: a new join or a new room must attach a fresh one */
  function watchRequests() { if (reqGen === Sync.gen) return; reqGen = Sync.gen; Sync.watchChild('requests', hostReq); }
  /* the lease holder keeps saying it is alive, so the table can tell a gone host from a slow one */
  function startHeartbeat() {
    clearInterval(hbTimer);
    hbTimer = setInterval(() => {
      if (!Sync.code || !Sync.isHolder()) return;
      if (Sync.settings && Sync.settings.status === 'playing') Sync.claimHost().catch(() => {});
    }, 20000);
  }
  /* start (or restart, after a reload) the bot runner on this device if it holds the lease */
  function attachHost() {
    if (!Sync.code || !Sync.isHolder()) return;
    if (!Sync.lease || Sync.lease.uid !== Sync.uid) Sync.claimHost().catch(() => {});
    watchRequests(); startHeartbeat();
    if (HD) { maybeBotTurn(); return; }
    if (hdLoading) return;
    hdLoading = true;
    hdReady = loadHost()
      .catch(e => { console.warn('hostdata', e); return null; })
      .finally(() => { hdLoading = false; });
    hdReady.then(() => { if (HD) maybeBotTurn(); });
  }
  const api = {
    /* host only: the bots' real state, for the saved log */
    dump() { if (!HD) return null; return { decksLeft: { sector: HD.decks.sector.draw.length, hatch: HD.decks.hatch.draw.length }, bots: Object.values(HD.bots).map(b => ({ id: b.id, name: b.name, level: b.level, role: b.state.role, char: b.state.char || '', reborn: !!b.state.reborn, over: b.state.over || null, items: b.state.items, path: b.state.path })) }; },
    attach() {
      if (!Sync.code || gen === Sync.gen) return; gen = Sync.gen;
      Sync.watchChild(`secret/${Sync.uid}/inbox`, (v, key) => {
        if (!v) return;
        const p = pending[v.id];
        if (p) { p.res(v); delete pending[v.id]; }
        else if (v.type === 'item' && v.card && window.addItem) window.addItem(v.card); // late answer: keep the card
        Sync.del(`secret/${Sync.uid}/inbox/${key}`);
      });
      Sync.watchChild('attacks', onAttack);
      Sync.watchChild('spots', onSpot);
      attachHost();
    },
    hostCheck: attachHost,
    request(type, extra) {
      const id = uid();
      return new Promise((res, rej) => {
        pending[id] = { res };
        Sync.set('requests/' + id, Object.assign({ id, uid: Sync.uid, type, at: Date.now() }, extra || {}))
          .catch(rej);
        setTimeout(() => { if (pending[id]) { delete pending[id]; rej(new Error('timeout')); } }, 20000);
      });
    },
    discard, consumeItem,
    async attack(sector) {
      const id = uid(), expected = aliveOthers();
      await Sync.set('attacks/' + id, { by: Sync.uid, sector, at: Date.now() });
      const replies = await waitReplies(`attacks/${id}/replies`, expected, 8000);
      const hits = [], missing = [];
      for (const u of expected) { const r = replies[u]; if (!r) missing.push(pname(u)); else if (r.in) hits.push(Object.assign({ name: pname(u) }, r)); }
      return { hits, missing };
    },
    async sensor(target) {
      const id = uid();
      await Sync.set('spots/' + id, { by: Sync.uid, sector: '-', target, at: Date.now() });
      const replies = await waitReplies(`spots/${id}/replies`, [target], 8000), r = replies[target];
      return { seen: r && r.in ? [{ name: pname(target), pos: r.pos, ident: r.ident }] : [], missing: r ? [] : [pname(target)] };
    },
    async medic(target) { const rep = await api.request('medic', { target }); return { name: rep.name, role: rep.role, char: rep.char }; },
    mutated() { Sync.setMe({ conv: true, role: 'human', char: S.char || '' }); },
    others: () => aliveOthers().map(u => [u, pname(u)]),
    async spotlight(sector) {
      const id = uid(), expected = aliveOthers().concat(S.over ? [] : [Sync.uid]);
      await Sync.set('spots/' + id, { by: Sync.uid, sector, at: Date.now() });
      const replies = await waitReplies(`spots/${id}/replies`, expected, 8000);
      const seenP = [], missing = [];
      for (const u of expected) { const r = replies[u]; if (!r) missing.push(pname(u)); else if (r.in) seenP.push({ name: u === Sync.uid ? t('You') : pname(u), pos: r.pos, ident: r.ident }); }
      return { seen: seenP, missing };
    },
    /* host: deal roles, build the decks, then open the game */
    async hostStart(order, first) {
      const n = order.length;
      if (n < 2 || n > 8) return;
      const deal = dealRoles(n);
      HD = { decks: { sector: deckNew(SECTOR_DECK), hatch: deckNew(HATCH_DECK) }, roles: {}, chars: {}, seenOut: {}, last: '', bots: {} };
      const map = T.maps.find(m => m.id === Sync.settings.map) || T.maps[0];
      hdReady = Promise.resolve(HD);
      for (let i = 0; i < n; i++) {
        const { role, char } = deal[i];
        HD.roles[order[i]] = role; HD.chars[order[i]] = char;
        if (isBotId(order[i])) { const p = Sync.players[order[i]] || {}, pos = startSector(map, role, char, Sync.settings.mode); HD.bots[order[i]] = { id: order[i], name: p.name || 'Bot', level: p.bot || 'normal', state: { role, role0: role, char, pos, path: [{ turn: 0, pos }], items: [], fed: false, adr: false, over: null } }; }
        else await Sync.set('secret/' + order[i], { role, char });
      }
      await persist(); await Sync.startGame(first, order); attachHost();
    },
    /* host: decide whether the game is over */
    onPlayers() { api.evaluate(); },
    evaluate() {
      if (!Sync.isHolder() || !HD || !Sync.settings || Sync.settings.status !== 'playing') return;
      const ps = Sync.players || {}; let changed = false;
      for (const u of Object.keys(HD.roles)) {
        const p = ps[u]; if (!p) continue;
        const state = p.out || (p.conv ? 'conv' : '');
        if (state && HD.seenOut[u] !== state) { HD.seenOut[u] = state; HD.last = state === 'escaped' ? 'escaped' : 'lost'; changed = true; }
      }
      const humans = Object.keys(HD.roles).filter(u => HD.roles[u] === 'human' && ps[u]);
      const aboard = humans.filter(u => !ps[u].out && !ps[u].conv), escaped = humans.filter(u => ps[u].out === 'escaped');
      let over = null;
      if (!aboard.length && humans.length) over = { aliensWin: HD.last !== 'escaped', reason: HD.last === 'escaped' ? 'escape' : 'eliminated' };
      else if (Sync.turn && Sync.turn.n > MAX_TURN) over = { aliensWin: true, reason: 'time' };
      if (changed) persist();
      if (over) { Sync.updateSettings({ status: 'over', result: Object.assign(over, { escaped: escaped.map(u => ps[u].name.slice(0, 20)) }) }); Sync.writeRoomIndex({ status: 'over' }); }
    },
    /* a new game at the same table: forget the old decks, bots and pending replies */
    reset() { HD = null; hdReady = null; botBusy = ''; revealed.clear(); done.clear(); },
    maybeBotTurn, revealBots, isBotId,
    _hd: () => HD
  };
  return api;
})();
