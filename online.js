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
    const c = {}; for (const k of ['sector', 'item', 'hatch']) c[k] = { d: HD.decks[k].draw.length, x: HD.decks[k].disc.length };
    await Sync.set('counts', c);
  }
  async function loadHost() {
    const v = await Sync.get('hostdata'); if (!v) return null;
    HD = { decks: { sector: norm(v.decks && v.decks.sector), item: norm(v.decks && v.decks.item), hatch: norm(v.decks && v.decks.hatch) }, roles: v.roles || {}, chars: v.chars || {}, seenOut: v.seenOut || {}, last: v.last || '' };
    return HD;
  }

  async function hostReq(req, key) {
    if (!req || done.has(key)) return; done.add(key);
    if (!HD) await hdReady; if (!HD) return;
    const rep = { id: req.id || key, type: req.type };
    if (req.type === 'sector' || req.type === 'item' || req.type === 'hatch') {
      const d = HD.decks[req.type], r = deckDraw(d); rep.card = r.card === null ? '' : r.card;
      if (r.card && req.type !== 'item') d.disc.push(r.card);
      if (r.reshuffled) logGame(RESHUFFLED[req.type]);
      await Sync.set(`secret/${req.uid}/inbox/${key}`, rep);
    } else if (req.type === 'discard' && ITEMS[req.card]) HD.decks.item.disc.push(req.card);
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
    if (ev.by === Sync.uid || S.over || S.stage !== 'game' || Date.now() - ev.at > 60000) return;
    if (ev.replies && ev.replies[Sync.uid]) return;
    const here = S.pos === ev.sector, rep = { in: !!here };
    if (here) {
      if (S.role === 'human' && S.items.includes('defense')) { rep.def = 1; consumeItem('defense'); }
      else {
        rep.killed = 1; rep.role = S.role; rep.char = S.char || '';
        if (infection() && S.role === 'human') { rep.conv = 1; S.role = 'alien'; S.fed = false; S.items = S.items.slice(); Sync.setMe({ conv: true, role: 'human', char: S.char || '' }); Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'out', text: 'killed|human|' + (S.char || ''), sector: '', at: Date.now() }); }
        else { S.over = 'dead'; }
      }
    }
    Sync.set(`attacks/${key}/replies/${Sync.uid}`, rep);
    save(); if (S.over) afterChange(); else { render(); hdr(); }
    if (here && rep.killed) toast(t('You were attacked and eliminated!'));
    else if (here && rep.def) toast(t('You were attacked, but your Defense card saved you!'));
  }
  function onSpot(ev, key) {
    if (!ev || seen.has('s' + key)) return; seen.add('s' + key);
    if (S.over || S.stage !== 'game' || Date.now() - ev.at > 60000) return;
    if (ev.replies && ev.replies[Sync.uid]) return;
    const q = parseId(ev.sector);
    const inRange = !!q && S.pos && (S.pos === ev.sector || neighbors(T.map, q[0], q[1]).some(([a, b]) => cid(a, b) === S.pos));
    const rep = { in: inRange }; if (inRange) rep.pos = S.pos;
    Sync.set(`spots/${key}/replies/${Sync.uid}`, rep);
    if (inRange) { Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'reveal', text: 'Spotlight', sector: S.pos, at: Date.now() }); if (ev.by !== Sync.uid) toast(t('Spotlight! Your position was revealed: {p}', { p: label(S.pos) })); }
  }
  function consumeItem(id) { const i = S.items.indexOf(id); if (i < 0) return; S.items.splice(i, 1); discard(id); Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'item', text: id, sector: '', at: Date.now() }); }
  function discard(id) { Sync.set('requests/' + uid(), { uid: Sync.uid, type: 'discard', card: id, at: Date.now() }).catch(() => {}); }

  const api = {
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
      if (Sync.isHost()) { hdReady = loadHost(); hdReady.then(() => Sync.watchChild('requests', hostReq)); }
    },
    request(type, extra) {
      const id = uid();
      return new Promise((res, rej) => {
        pending[id] = { res };
        Sync.set('requests/' + id, Object.assign({ id, uid: Sync.uid, type, at: Date.now() }, extra || {})).catch(rej);
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
    async spotlight(sector) {
      const id = uid(), expected = aliveOthers().concat(S.over ? [] : [Sync.uid]);
      await Sync.set('spots/' + id, { by: Sync.uid, sector, at: Date.now() });
      const replies = await waitReplies(`spots/${id}/replies`, expected, 8000);
      const seenP = [], missing = [];
      for (const u of expected) { const r = replies[u]; if (!r) missing.push(pname(u)); else if (r.in) seenP.push({ name: u === Sync.uid ? t('You') : pname(u), pos: r.pos }); }
      return { seen: seenP, missing };
    },
    /* host: deal roles, build the decks, then open the game */
    async hostStart(order, first) {
      const n = order.length;
      if (n < 2 || n > 8) return;
      const deal = dealRoles(n);
      HD = { decks: { sector: deckNew(SECTOR_DECK), item: deckNew(ITEM_DECK), hatch: deckNew(HATCH_DECK) }, roles: {}, chars: {}, seenOut: {}, last: '' };
      hdReady = Promise.resolve(HD);
      for (let i = 0; i < n; i++) {
        const { role, char } = deal[i];
        HD.roles[order[i]] = role; HD.chars[order[i]] = char;
        await Sync.set('secret/' + order[i], { role, char });
      }
      await persist(); await Sync.startGame(first, order);
    },
    /* host: decide whether the game is over */
    onPlayers() { api.evaluate(); },
    evaluate() {
      if (!Sync.isHost() || !HD || !Sync.settings || Sync.settings.status !== 'playing') return;
      const ps = Sync.players || {}; let changed = false;
      for (const u of Object.keys(HD.roles)) {
        const p = ps[u]; if (!p) continue;
        const state = p.out || (p.conv ? 'conv' : '');
        if (state && HD.seenOut[u] !== state) { HD.seenOut[u] = state; HD.last = state === 'escaped' ? 'escaped' : 'lost'; changed = true; }
      }
      const humans = Object.keys(HD.roles).filter(u => HD.roles[u] === 'human' && ps[u]);
      const aboard = humans.filter(u => !ps[u].out && !ps[u].conv), escaped = humans.filter(u => ps[u].out === 'escaped');
      let over = null;
      if (Sync.settings.mode === 'basic' && escaped.length) over = { aliensWin: false, reason: 'escape' };
      else if (!aboard.length && humans.length) over = { aliensWin: HD.last !== 'escaped', reason: HD.last === 'escaped' ? 'escape' : 'eliminated' };
      else if (Sync.turn && Sync.turn.n > MAX_TURN) over = { aliensWin: true, reason: 'time' };
      if (changed) persist();
      if (over) Sync.updateSettings({ status: 'over', result: Object.assign(over, { escaped: escaped.map(u => ps[u].name.slice(0, 20)) }) });
    },
    _hd: () => HD
  };
  return api;
})();
