'use strict';
/* Everything that happens during a game: turn order, moving, announcing, items, attacks, game over. */
const sayBox = (txt, tone, small, icon) => `<div class="say ${tone || ''}${icon ? ' hasicon' : ''}">${icon || ''}<div><small>${t(small || 'Say aloud')}</small><b>${esc(txt)}</b></div></div>`;
const inRoom = () => !!(Sync.code && T.turnState);
const myTurn = () => !inRoom() || T.turnState.uid === Sync.uid;
const digital = () => !!S.online;
const pname = u => (Sync.players && Sync.players[u] && Sync.players[u].name) || '?';
const gameOver = () => (S.hot ? Hot.isOver() : !!(Sync.settings && Sync.settings.status === 'over'));
const Eng = () => (S.hot ? Hot : Online);
const roleLabel = (role, ch) => t(role === 'alien' ? 'Alien' : 'Human') + (ch ? ', ' + t(ch) : '');

/* ---------------- turn order ---------------- */
function onTurn(v) {
  const prev = T.turnState; T.turnState = v;
  if (S.stage !== 'game' || !v) return;
  S.turn = Math.min(v.n, MAX_TURN);
  const was = prev && prev.uid === Sync.uid && prev.n === v.n;
  if (v.uid === Sync.uid && !was) startMyTurn();
  if (isHost()) { Online.evaluate(); Online.maybeBotTurn(); }
  save(); hdr(); paintCells(); if (S.tab === 'play' || S.tab === 'table') render();
}
function startMyTurn(silent) {
  if (S.over) { endTurn(); return; }
  S.undo = null;
  S.phase = 'move'; S.res = null; S.adr = false; S.cat = false; T.sel = null; refreshReach();
  if (!silent) { toast(t('Your turn!')); buzz(); }
  if (S.pos) focusOn(S.pos);
}
function nextTurn() {
  const ord = (Sync.settings && Sync.settings.order) || [], ts = T.turnState, ps = Sync.players || {};
  if (!ord.length || !ts) return null;
  for (let i = 1; i <= ord.length; i++) {
    const k = ts.idx + i, j = k % ord.length, u = ord[j];
    const out = u === Sync.uid ? !!S.over : !!(ps[u] && ps[u].out);
    if (ps[u] && !out) return { n: ts.n + Math.floor(k / ord.length), idx: j, uid: u };
  }
  return null;
}
function endTurn() {
  if (S.hot) return Hot.endTurn();
  if (inRoom()) {
    const nx = nextTurn(); S.phase = 'move'; S.res = null; T.sel = null;
    if (nx) Sync.setTurn(nx);
    afterChange(); return;
  }
  if (S.turn >= MAX_TURN) S.over = 'time'; else { S.turn++; S.phase = 'move'; S.res = null; }
  T.sel = null; afterChange(); if (!S.over) focusOn(S.pos);
}
/* tell the table that I am out of the game, and pass the turn on if it was mine */
function reportOut() {
  if (!Sync.code || S.outSent || !['escaped', 'dead', 'trapped'].includes(S.over)) return;
  S.outSent = true;
  const why = S.over === 'dead' ? 'killed' : S.over;
  Sync.setMe({ out: why, role: S.role, char: S.char || '' });
  Sync.push({ id: uid(), turn: S.turn, who: S.name || t('Me'), kind: 'out', sector: '', text: why + '|' + S.role + '|' + (S.char || ''), at: Date.now() });
  if (inRoom() && T.turnState.uid === Sync.uid) endTurn();
}
function afterChange() {
  if (S.role === 'human' && !S.over && mapHatches().every(n => S.hatches[n])) S.over = 'trapped';
  save(); refreshReach(); render(); paintCells(); hdr();
  if (S.hot) { if (['escaped', 'dead', 'trapped'].includes(S.over) && !S.outSent) Hot.onOut(S.over); }
  else reportOut();
}
function showGameOver() {
  if (!Sync.code) return;
  if (Sync.isHost() && typeof Online !== 'undefined') Online.revealBots();
  if (!S.revealed) { S.revealed = true; Sync.setMe({ role: S.role, char: S.char || '' }); save(); }
  publishRoute();
}
/* my real route goes to the table once the game is over; a refusal (old database rules) is remembered and shown */
async function publishRoute() {
  if (S.routeSent || T.routeBusy || !Sync.code) return; T.routeBusy = true;
  try { await Sync.setMeP({ route: encodeRoute(S.path) }); S.routeSent = true; T.routeErr = false; }
  catch (e) { T.routeErr = String(e && (e.code || e.message) || e); }
  T.routeBusy = false; save(); if (T.routeErr && S.stage === 'game') render();
}
/* a route travels as "turn:sector,turn:sector,…" — published only once the game is over */
const encodeRoute = path => (path || []).map(p => p.turn + ':' + p.pos).join(',').slice(0, 1500);
const decodeRoute = s => String(s || '').split(',').map(x => { const [t_, pos] = x.split(':'); return { turn: +t_, pos }; }).filter(p => p.pos && parseId(p.pos));

/* ---------------- moving & announcing ---------------- */
function confirmMove() {
  if (!myTurn() || !T.sel || !T.reach.has(T.sel)) return;
  S.undo = { pos: S.pos, adr: S.adr };
  S.pos = T.sel; S.path.push({ turn: S.turn, pos: S.pos }); T.sel = null; buzz();
  const ty = at(T.map, S.pos);
  S.phase = 'resolve'; S.res = { stage: '1234'.includes(ty) ? 'pod' : 'choose' };
  T.itemIcon = false; S.adr = false;
  afterChange(); focusOn(S.pos);
}
/* nothing can be undone once something public or random has happened */
const commit = () => { S.undo = null; };
function undoMove() {
  if (!S.undo || S.phase !== 'resolve' || !S.res || !['choose', 'pod'].includes(S.res.stage)) return;
  S.path.pop(); S.pos = S.undo.pos; S.adr = S.undo.adr; S.undo = null; S.phase = 'move'; S.res = null; T.sel = null; T.itemIcon = false;
  afterChange(); focusOn(S.pos); toast(t('Move undone'));
}
const undoBtn = () => (S.undo && S.phase === 'resolve' && S.res && ['choose', 'pod'].includes(S.res.stage)) ? `<button class="btn link wide" data-act="undo">${ico('undo', 18)} ${t('Undo move')}</button>` : '';
function announce(res) { commit(); S.res = Object.assign({ stage: 'done' }, res); afterChange(); }
/* common ending of a Sector card: public announcement, then (maybe) the Item card that was drawn */
async function finishCard(kind, sector, itemId, any) {
  const res = kind === 'silence' ? { say: t('Silence in all Sectors'), tone: 'silent', icon: 'silence', logged: say('', 'silence') }
    : { say: t('Noise in Sector {s}', { s: sector }), tone: 'alert', icon: any ? 'noise-any' : 'noise-here', logged: say('', 'noise', sector) };
  if (itemId) { const m = digital() ? giveItem(itemId) : { text: t('You drew an Item card') }; res.extra = m.text; res.extraIcon = m.icon; }
  announce(res);
}
/* two noises at once (Cat card or the Pilot): both are announced */
function finishTwo(a, b) {
  announce({ say: t('Noise in Sectors {a} and {b}', { a, b }), tone: 'alert', icon: 'noise-any', logged: [say('', 'noise', a), say('', 'noise', b)] });
}

/* ---------------- digital draws ---------------- */
async function drawSector() {
  commit();
  if (myAbil() === 'Captain' && !abUsed(S, 'Captain')) {   // the Captain skips the card the first time
    abUse(S, 'Captain'); star();
    return announce({ say: t('Nothing to announce'), sub: t('Captain: no card the first time.'), tone: 'silent', icon: 'sedatives' });
  }
  S.res = { stage: 'wait' }; afterChange();
  let rep; try { rep = await Eng().request('sector'); } catch (e) { S.res = { stage: 'choose' }; afterChange(); toast(t('The host did not answer. Try again.')); return; }
  let c = rep.card || 'silence', item = c.startsWith('item:') ? c.slice(5) : '';
  if (item && basic()) { c = 'silence'; item = ''; }   // Item cards count as Silence in the Basic game
  const cat = S.cat; S.cat = false;
  if (cat) {
    if (!c.startsWith('noise')) Eng().discard(c);   // a Silence or Item card drawn with the Cat is lost
    if (c === 'noise-self') return pickSector(t('Cat: tap the second sector for your noise'), b => finishTwo(S.pos, b), true);
    return pickSector(t('Cat: tap the first sector for your noise'), a => pickSector(t('Cat: tap the second sector'), b => finishTwo(a, b), true), true);
  }
  if (c === 'noise-self') finishCard('noise', S.pos, '', false);
  else if (c === 'noise-any' || (c === 'silence' && myAbil() === 'Psychic Alien')) pickSector(t('Noise in any sector: tap the sector you announce'), sec => finishCard('noise', sec, '', true), true);
  else finishCard('silence', null, item, false);
}
async function digitalHatch() {
  commit(); S.res = { stage: 'wait' }; afterChange();
  const eng = myAbil() === 'Engineer';
  let rep; try { rep = await Eng().request('hatch', eng ? { two: 1 } : undefined); } catch (e) { S.res = { stage: 'pod' }; afterChange(); toast(t('The host did not answer. Try again.')); return; }
  if (rep.card === 'red') actions.podRed(); else actions.podGreen();
}
/* the Item card I drew goes into my hand (Aliens keep them too, to look like Humans) */
function giveItem(c) { addItem(c); return { text: t('You drew: {i}', { i: t(ITEMS[c][0]) }), icon: c }; }
function addItem(c) { if (ITEMS[c]) { S.items.push(c); save(); if (S.stage === 'game') render(); } }
/* a mark on the movement record for a Character ability */
const star = () => { const p = S.path[S.path.length - 1]; if (p) p.star = 1; };

/* ---------------- items ---------------- */
/* who may play an item: Humans, and an Alien for the one item its Character allows */
const canUse = id => (S.role === 'human' && id !== 'defense' && id !== 'clone') || (S.role === 'alien' && !S.reborn && ALIEN_ITEM[abilOf(S, S.mode)] === id);
const playerPick = (label_, cb) => {
  const ps = Eng().others();
  if (!ps.length) return toast(t('Nobody else is in the game.'));
  dlg.innerHTML = `<h2>${esc(label_)}</h2><div class="stack">${ps.map(([id, n]) => `<button class="btn" data-id="${esc(id)}">${esc(n)}</button>`).join('')}</div><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
  dlg.querySelectorAll('[data-id]').forEach(b => { b.onclick = () => { closeDlg(); cb(b.dataset.id); }; });
};
const seenLines = seen => seen.map(p => `${esc(p.name)}: ${esc(p.ident || p.pos)}`);
function useItem(id) {
  closeDlg();
  if (!canUse(id)) return toast(t('Only Humans can use items'));
  if (!myTurn()) return toast(t('You can use items during your turn'));
  if (!S.items.includes(id)) return;
  commit();
  const dangerous = S.phase === 'resolve' && S.res && S.res.stage === 'choose' && at(T.map, S.pos) === '.';
  if (id === 'defense' || id === 'clone') return toast(t('Played automatically when you are attacked'));
  if (id === 'adrenaline') { if (S.phase !== 'move') return toast(t('Play Adrenaline before you move')); Eng().consumeItem(id); S.adr = true; T.sel = null; afterChange(); return toast(t('You may move one extra sector')); }
  if (id === 'teleport') { Eng().consumeItem(id); S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport' }); T.sel = null; afterChange(); focusOn(S.pos); return toast(S.phase === 'move' ? t('Teleported. Now make your normal move.') : t('Teleported to the Human sector')); }
  if (id === 'sedatives') { if (!dangerous) return toast(t('Use Sedatives instead of drawing a card')); Eng().consumeItem(id); return announce({ say: t('Nothing to announce'), sub: t('Sedatives: no card this turn.'), tone: 'silent', icon: 'sedatives' }); }
  if (id === 'cat') { if (!dangerous && S.phase !== 'move') return toast(t('Play the Cat before you draw a card')); if (S.cat) return toast(t('Cat already played')); Eng().consumeItem(id); S.cat = true; afterChange(); return toast(dangerous ? t('Cat played: now draw your card') : t('Cat played: it applies when you draw a card this turn')); }
  if (id === 'mutation') return confirmDlg(t('Use Mutation?'), t('You become an Alien right here and now. Your abilities are lost.'), () => { Eng().consumeItem(id); becomeAlien(); });
  if (id === 'sensor') return playerPick(t('Sensor: who must reveal their position?'), async who => {
    Eng().consumeItem(id); save(); render();
    const r = await Eng().sensor(who);
    alertHtml(t('Sensor'), r.seen.length ? seenLines(r.seen).join('<br>') : t('No answer from {p}', { p: pname(who) }));
  });
  if (id === 'spotlight') return pickSector(t('Spotlight: tap the sector to name'), async sec => {
    Eng().consumeItem(id); save(); render();
    const r = await Eng().spotlight(sec);
    const lines = r.seen.length ? seenLines(r.seen).join('<br>') : t('Nobody is in that area.');
    alertHtml(t('Spotlight on Sector {s}', { s: sec }), lines);
  }, true);
  if (id === 'attack') { Eng().consumeItem(id); return runAttack(true); }
}
/* a Human turns into an Alien in place (Mutation) */
function becomeAlien() {
  S.role = 'alien'; S.fed = false; S.reborn = true; say('Mutation', 'item'); Eng().mutated && Eng().mutated();
  S.phase = S.phase; T.sel = null; afterChange(); toast(t('You are now an Alien. Hunt the remaining Humans!'));
}
function alertHtml(title, html) { dlg.innerHTML = `<h2>${esc(title)}</h2><p>${html}</p><div class="row"><button class="btn primary" id="d-no">OK</button></div>`; if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg; }

/* digital attack, by an Alien or by a Human with an Attack item */
async function runAttack(fromItem) {
  commit(); const sec = S.pos; say('', 'attack', sec);
  if (!fromItem) { S.res = { stage: 'wait' }; afterChange(); }
  const r = await Eng().attack(sec);
  const lines = [];
  let fed = false;
  for (const h of r.hits) {
    if (h.def) lines.push(t('{p} survived with a Defense card', { p: h.name }));
    else if (h.clone) lines.push(t('{p} survived with a Clone and restarts from the Human sector', { p: h.name }));
    else if (h.reveal) lines.push(t('{p} is immune to attacks: {r}', { p: h.name, r: roleLabel(h.role, h.char) }));
    else { lines.push(t('{p} was killed ({r})', { p: h.name, r: roleLabel(h.role, h.char) }) + (h.conv ? ' ' + t('and restarts as an Alien') : '')); if (h.role === 'human' && S.role === 'alien') fed = true; }
  }
  if (!r.hits.length) lines.push(t('Nobody was in the sector'));
  r.missing.forEach(p => lines.push(t('No answer from {p}', { p })));
  if (fed && !S.fed) { S.fed = true; lines.push(t('You have FED: from now on you move 1, 2 or 3 sectors.')); }
  if (fromItem) { save(); render(); hdr(); alertHtml(t('Attack in Sector {s}', { s: sec }), lines.map(esc).join('<br>')); }
  else announce({ say: t('Attack in Sector {s}', { s: sec }), tone: 'alert', icon: S.role === 'human' ? 'attack' : 'claws', report: lines });
}

/* ---------------- manual (physical card) actions ---------------- */
Object.assign(actions, {
  confirm: confirmMove,
  clearsel() { T.sel = null; afterChange(); },
  noiseHere() { finishCard('noise', S.pos, '', false); },
  noiseAny() { pickSector(t('Tap the sector you announce'), id => finishCard('noise', id, '', true)); },
  silence() { finishCard('silence', null, '', false); },
  quiet() { announce({ say: t('Silent Sector'), tone: 'silent', logged: say('secure', 'silence') }); },   // a Secure sector: public, but different from a Silence card
  drawcard() { drawSector(); },
  hatchdraw() { digitalHatch(); },
  attack() { commit(); if (digital()) runAttack(false); else { S.res = { stage: 'attack' }; afterChange(); } },
  attackDone(b) {
    commit(); const k = b.dataset.k; say('', 'attack', S.pos);
    let sub = t('Anyone in this sector must declare it and is out of the game.');
    if (k === 'human' && S.role === 'alien' && !S.fed) { S.fed = true; sub += ' ' + t('You have FED: from now on you move 1, 2 or 3 sectors.'); }
    announce({ say: t('Attack in Sector {s}', { s: S.pos }), sub, tone: 'alert', icon: S.role === 'human' ? 'attack' : 'claws' });
  },
  podGreen() { commit(); const n = +at(T.map, S.pos); say('', 'hatch', S.pos, { n, ok: 1 }); S.hatches[n] = 1; S.over = 'escaped'; afterChange(); },
  podRed() { commit(); const n = +at(T.map, S.pos); S.hatches[n] = 1; say('', 'hatch', S.pos, { n, ok: 0 }); announce({ say: t('Escape Pod {n}: damaged', { n }), sub: t('Reveal the red card. Nobody can enter this pod again. You cannot be attacked here, but you must leave on your next turn.'), tone: 'alert' }); },
  next: endTurn,
  undo: undoMove,
  enterhatch() { actions.podGreen(); },
  backres() { S.res = { stage: 'choose' }; afterChange(); },
  useitem(b) { useItem(b.dataset.i); },
  itemdlg(b) { itemDlg(b.dataset.i); },
  item(b) { manualItem(b.dataset.i); },
  caught(b) { caughtAction(b.dataset.k); },
  hatch(b) { const n = b.dataset.n; S.hatches[n] = S.hatches[n] ? 0 : 1; afterChange(); },
  turnminus() { S.turn = Math.max(1, S.turn - 1); afterChange(); },
  turnplus() { S.turn = Math.min(MAX_TURN, S.turn + 1); afterChange(); },
  hotgo() { Hot.go(); },
  stay() { // Executive Officer: stay still this turn
    if (at(T.map, S.pos) !== '.' && at(T.map, S.pos) !== 's') return toast(t('You cannot stay in this sector.'));
    abUse(S, 'Executive Officer'); commit(); S.path.push({ turn: S.turn, pos: S.pos, star: 1 }); T.sel = null;
    S.phase = 'resolve'; S.res = { stage: 'choose' }; afterChange();
  },
  lurk() { // Lurking Alien: attack without moving
    S.path.push({ turn: S.turn, pos: S.pos, star: 1 }); T.sel = null; S.phase = 'resolve'; S.res = { stage: 'choose' }; afterChange(); actions.attack();
  },
  copilot() { // Co-pilot: one Teleport, showing who she is
    abUse(S, 'Co-pilot'); commit(); say('Id|' + S.role + '|' + (S.char || ''), 'reveal');
    S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport', star: 1 }); T.sel = null; afterChange(); focusOn(S.pos); toast(t('Teleported to the Human sector'));
  },
  pilot() { abUse(S, 'Pilot'); S.cat = true; star(); afterChange(); toast(t('Cat played: now draw your card')); },
  soldier() { abUse(S, 'Soldier'); star(); runAttack(true); },
  medic() {
    playerPick(t('Medic: who must reveal their identity?'), async who => {
      abUse(S, 'Medic'); say('Id|' + S.role + '|' + (S.char || ''), 'reveal'); star();
      const r = await Eng().medic(who);
      if (r) Sync.code ? Sync.push({ id: uid(), turn: S.turn, who: r.name, kind: 'reveal', text: 'Id|' + r.role + '|' + r.char, sector: '', at: Date.now() }) : null;
      save(); render();
      alertHtml(t('Medic'), esc(r ? r.name + ': ' + roleLabel(r.role, r.char) : '?'));
    });
  },
  skipturn() { confirmDlg(t('Skip {p}?', { p: pname(T.turnState.uid) }), t('Use this when a player is away. Their turn ends now.'), () => { const nx = nextTurn(); if (nx) Sync.setTurn(nx); }); }
});
/* the rules: an item card is revealed to everyone when it is played */
const revealItem = k => toast(t('Show your {i} card to everyone, then discard it', { i: t(ITEMS[k][0]) }));
function manualItem(k) {
  closeDlg(); commit();
  const pub = () => { say(k, 'item'); revealItem(k); };
  if (k === 'adrenaline') { if (S.phase !== 'move' || S.role !== 'human') return toast(t('Play Adrenaline before you move')); S.adr = true; pub(); T.sel = null; afterChange(); return; }
  if (k === 'teleport') { if (S.role !== 'human') return; pub(); S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport' }); T.sel = null; afterChange(); focusOn(S.pos); return; }
  if (k === 'spotlight') return pickSector(t('Spotlight: tap the sector to name'), id => { pub(); say('', 'spot', id); afterChange(); toast(t('Announce: Spotlight on Sector {s}', { s: id })); });
  if (k === 'sedatives') { if (S.phase !== 'resolve' || S.res.stage !== 'choose') return toast(t('Use Sedatives instead of drawing a card')); pub(); return announce({ say: t('Nothing to announce'), sub: t('Sedatives: no card this turn.'), tone: 'silent', icon: 'sedatives' }); }
  if (k === 'attack') { if (S.phase !== 'resolve' || S.res.stage === 'done') return toast(t('Use Attack after moving')); pub(); return actions.attack(); }
  if (k === 'cat') { if (S.phase !== 'resolve' || S.res.stage !== 'choose') return toast(t('Play the Cat before you draw a card')); pub(); return pickSector(t('Cat: tap the first sector for your noise'), a => pickSector(t('Cat: tap the second sector'), b => finishTwo(a, b), true), true); }
  if (k === 'sensor') { pub(); say('', 'info'); return toast(t('Name the player who must announce their position.')); }
  if (k === 'mutation') { pub(); S.role = 'alien'; S.fed = false; S.reborn = true; afterChange(); return toast(t('You are now an Alien. Hunt the remaining Humans!')); }
}
function caughtAction(k) {
  closeDlg();
  if (k === 'become') { S.role = 'alien'; S.fed = false; S.reborn = true; S.items = []; S.pos = find(T.map, 'A'); S.path.push({ turn: S.turn, pos: S.pos, note: 'reborn' }); say('Eliminated, continuing as an Alien', 'info'); S.phase = 'move'; S.res = null; T.sel = null; afterChange(); focusOn(S.pos); toast(t('You restart from the Alien Sector as an Alien')); }
  else if (k === 'clone') { S.items = []; S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'clone' }); say('Survived an attack (Clone)', 'info'); S.phase = 'move'; S.res = null; T.sel = null; afterChange(); focusOn(S.pos); toast(t('You restart from the Human sector')); }
  else if (k === 'dead') { say('Eliminated', 'info'); S.over = 'dead'; afterChange(); }
  else if (k === 'survive') { say('Survived an attack (Defense)', 'info'); afterChange(); }
}
function itemsDlg() {
  const it = (k, n, d) => `<button class="btn withico" data-act="item" data-i="${k}">${gico(k, 38)}<span>${t(n)}<small>${t(d)}</small></span></button>`;
  dlg.innerHTML = `<h2>${t('Item played')}</h2><div class="stack">
    ${['adrenaline', 'sedatives', 'teleport', 'spotlight', 'attack', 'cat', 'sensor', 'mutation'].map(k => it(k, ITEMS[k][0], ITEMS[k][1])).join('')}</div>
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
function caughtDlg() {
  const h = S.role === 'human', full = h && !basic();
  dlg.innerHTML = `<h2>${t('I was attacked')}</h2><p class="dim">${full ? t('Play a Defense or Clone card to survive.') : t('You must declare your presence.')}</p><div class="stack">
    ${full ? `<button class="btn ok" data-act="caught" data-k="survive">${t('I survived (Defense card)')}</button><button class="btn ok" data-act="caught" data-k="clone">${t('I survived (Clone): restart from the Human sector')}</button>` : ''}
    ${h ? `<button class="btn danger" data-act="caught" data-k="become">${t('I was killed: I restart from the Alien Sector as an Alien')}</button>` : `<button class="btn danger" data-act="caught" data-k="dead">${t('I was eliminated: out of the game')}</button>`}
  </div><div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
window.itemsDlg = itemsDlg; window.caughtDlg = caughtDlg; window.addItem = addItem;

/* ---------------- panels ---------------- */
const physExtras = () => `<div class="row mini">${basic() || S.role !== 'human' ? '' : `<button class="btn" onclick="itemsDlg()">${t('Item played')}</button>`}<button class="btn" onclick="caughtDlg()">${t('I was attacked')}</button></div>`;
/* the three item slots of the digital game; tap one to read it and use it */
/* the Character abilities that can be used right now (shown in the same row as the items) */
function abilList() {
  if (!digital() || basic() || S.over || (inRoom() && !myTurn())) return [];
  const ab = myAbil(), b = [], once = k => !abUsed(S, k), res = S.res && S.res.stage;
  if (S.phase === 'move' && !T.sel) {
    if (ab === 'Executive Officer' && once(ab) && '.s'.includes(at(T.map, S.pos))) b.push(['stay', 'Stay still']);
    if (ab === 'Co-pilot' && once(ab)) b.push(['copilot', 'Teleport']);
    if (ab === 'Lurking Alien' && '.s'.includes(at(T.map, S.pos))) b.push(['lurk', 'Attack here']);
  }
  if (S.phase === 'resolve' && res === 'choose') {
    if (ab === 'Pilot' && once(ab) && !S.cat && at(T.map, S.pos) === '.') b.push(['pilot', 'Two noises']);
    if (ab === 'Soldier' && once(ab)) b.push(['soldier', 'Attack']);
  }
  if (ab === 'Medic' && once(ab) && S.phase !== 'wait') b.push(['medic', 'Reveal a player']);
  return b;
}
const handHtml = () => {
  if (!digital() || basic()) return '';
  const ab = abilList().map(([a, l]) => `<button class="slot abil" data-act="${a}" aria-label="${esc(t(S.char))}: ${esc(t(l))}" title="${esc(t(S.char))}">${ico('next', 16)}<span>${t(l)}</span></button>`).join('');
  const items = S.items.map(k => `<button class="slot" data-act="itemdlg" data-i="${k}">${gico(k, 28)}<span>${t(ITEMS[k][0])}</span></button>`).join('');
  return `<div class="slots" role="group" aria-label="${t('Your items')}">${ab}${items || (ab ? '' : `<span class="slot empty">${t('No items')}</span>`)}</div>`;
};
function itemDlg(k) {
  const can = canUse(k) && myTurn() && !S.over && !gameOver();
  const why = !canUse(k) ? (k === 'defense' || k === 'clone' ? t('Played automatically when you are attacked') : S.role !== 'human' ? t('Aliens can hold items but not use them') : '') : !myTurn() ? t('You can use items during your turn') : '';
  dlg.innerHTML = `<div class="dlgico">${gico(k, 84)}</div><h2>${t(ITEMS[k][0])}</h2><p>${t(ITEMS[k][1])}</p>${why ? `<p class="dim">${why}</p>` : can ? `<p class="dim">${t('Using it shows the card to everyone.')}</p>` : ''}
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button>${can ? `<button class="btn primary" data-act="useitem" data-i="${k}">${t('Use')}</button>` : ''}</div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
const extras = () => (digital() ? '' : physExtras());
const outBadge = p => p.out === 'escaped' ? `<span class="b-ok">${ico('check', 14)} ${t('escaped')}</span>` : p.out ? `<span class="b-out">${p.out === 'trapped' ? ico('cross', 14) : gico('killed', 18)} ${p.out === 'trapped' ? t('trapped') : t('eliminated')}${p.role ? ' (' + t(p.role === 'alien' ? 'Alien' : 'Human') + ')' : ''}</span>` : '';
/* private suspicion tag for a player: ? / Human (blue) / Alien (red) */
const susBtns = key => key === 'me' ? '' : `<span class="sus" role="group" aria-label="${t('Your suspicion')}">${[['', '?', 'No idea'], ['human', t('H'), 'Suspected Human'], ['alien', t('A'), 'Suspected Alien']].map(([v, l, a]) => `<button data-act="sus" data-k="${esc(key)}" data-v="${v}" class="${v || 'none'}" aria-pressed="${suspicion(key) === v}" aria-label="${t(a)}">${l}</button>`).join('')}</span>`;
const keyOfUid = u => u === Sync.uid ? 'me' : 'u:' + u;
function orderList() {
  const ord = tableOrder(), ps = tablePlayers(), cur = S.hot ? Hot.curId() : T.turnState && T.turnState.uid;
  if (!ord.length) return '';
  return `<ol class="turnlist">${ord.filter(u => ps[u]).map(u => { const k = u === myId() ? 'me' : 'u:' + u; return `<li class="${u === cur ? 'cur' : ''}${ps[u].out ? ' out' : ''}"><span class="mk">${u === cur ? ico('turn', 12) : ''}</span>${dotIcon(k)}<span class="pname">${esc(ps[u].name)}${k === 'me' ? ` <em>${t('(you)')}</em>` : ''}</span>${outBadge(ps[u])}${ps[u].out ? '' : susBtns(k)}</li>`; }).join('')}</ol>`;
}
function waitPanel() {
  const cur = T.turnState;
  return `<h2>${t('{p} is playing', { p: esc(pname(cur.uid)) })}</h2>
    ${orderList()}${handHtml()}`;
}
function overPanel() {
  const m = { escaped: ['Escaped!', 'You left the ship and win. That hatch is now blocked.'], time: ['40 rounds played', 'Humans still on board are eliminated: the Aliens win.'], dead: ['Out of the game', 'You were eliminated. Your Character card is revealed.'], trapped: ['No way out', 'Every Escape Pod is blocked or damaged. You are eliminated.'] }[S.over];
  return `${S.over === 'dead' ? `<div class="dlgico">${gico('killed', 72)}</div>` : ''}<h2>${t(m[0])}</h2><p>${t(m[1])}</p>${inRoom() ? `<p class="dim">${t('You can keep following the game in the Table tab.')}</p>${orderList()}` : `<button class="btn primary big wide" data-act="newgame">${t('New game')}</button>`}`;
}
/* online: tell the player why other routes are missing instead of showing a half-empty map */
function routesNote() {
  if (S.hot || !Sync.code) return '';
  if (T.routeErr) return `<p class="dim hintline">${t('Routes could not be shared.')} <a href="firebase-rules.html" target="_blank" rel="noopener">${t('Update the database rules')}</a></p>`;
  const ps = tablePlayers(), mia = Object.entries(ps).filter(([u, p]) => u !== Sync.uid && !p.route).length;
  return mia ? `<p class="dim hintline" role="status">${t('Waiting for the routes of {n} players…', { n: mia })}</p>` : '';
}
function globalOverPanel() {
  const r = (S.hot ? Hot.result() : Sync.settings.result) || {}, esc_ = r.escaped || [], ps = tablePlayers();
  const why = { time: 'Time is up: 40 turns have been played.', escape: 'The last Human has escaped.', eliminated: 'The last Human was eliminated.' }[r.reason] || '';
  const rows = tableOrder().filter(u => ps[u]).map(u => { const p = ps[u]; return `<li class="${p.out === 'escaped' ? 'ok' : ''}">${dotIcon(u === myId() ? 'me' : 'u:' + u)}<span class="pname">${esc(p.name)}</span><span class="pst">${p.role ? t(p.role === 'alien' ? 'Alien' : 'Human') + (p.char ? ' · ' + t(p.char) : '') : '…'}</span>${outBadge(p) || ''}</li>`; }).join('');
  return `<h2>${t('Game over')}</h2>
    ${sayBox(r.aliensWin ? t('The Aliens win!') : t('The Humans win!'), r.aliensWin ? 'alert' : '', 'Result')}
    <p class="dim">${t(why)}</p>${esc_.length ? `<p>${t('Humans who escaped: {n}', { n: esc_.map(esc).join(', ') })}</p>` : ''}
    ${routesNote()}
    <div class="seg revseg" role="radiogroup" aria-label="${t('Map')}"><button role="radio" data-act="revealview" data-v="real" aria-checked="${!T.showAnn}">${t('Real routes')}</button><button role="radio" data-act="revealview" data-v="ann" aria-checked="${!!T.showAnn}">${t('Announcements')}</button></div>
    <ul class="plist rev">${rows}</ul><button class="btn primary big wide" data-act="newgame">${t('New game')}</button>`;
}

const catNote = () => S.cat ? `<p class="say alert"><b>${t('Cat is ready: two noises when you draw')}</b></p>` : '';
function playPanel() {
  if (T.pick) return '';
  if (gameOver()) return globalOverPanel();
  if (S.over) return overPanel();
  if (inRoom() && !myTurn()) return waitPanel();
  const n = allowance(), alien = S.role === 'alien';
  if (S.phase === 'move') {
    const sel = T.sel;
    return `${catNote()}<h2>${sel ? esc(label(sel)) + ` <span class="dim sub">${esc(typeName(at(T.map, sel)))}</span>` : t('Tap a highlighted sector')}</h2>
      ${sel ? `<div class="row confirmrow"><button class="btn" data-act="clearsel" aria-label="${t('Change')}">${ico('close')}</button><button class="btn primary big" data-act="confirm">${t('Confirm move')}</button></div>` : ''}
      ${handHtml()}${extras()}`;
  }
  const ty = at(T.map, S.pos), r = S.res || { stage: 'choose' };
  const head = `${catNote()}<h2>${esc(label(S.pos))}${'.sHA'.includes(ty) ? ` <span class="dim sub">${esc(typeName(ty))}</span>` : ''}</h2>`;
  if (r.stage === 'wait') return head + `<p class="dim" role="status">${t('Waiting for the host…')}</p>`;
  if (r.stage === 'pod') return head + (digital()
    ? `<p>${t('You reached an Escape Pod. Draw the Escape Pod card.')}</p><button class="btn primary big wide" data-act="hatchdraw">${t('Draw pod card')}</button>`
    : `<p>${t('Declare which pod you reached, then draw an Escape Pod card and reveal it.')}</p><div class="row"><button class="btn ok big" data-act="podGreen">${t('Green: escaped')}</button><button class="btn danger big" data-act="podRed">${t('Red: damaged')}</button></div>`) + undoBtn();
  if (r.stage === 'attack') return head + sayBox(t('Attack in Sector {s}', { s: S.pos }), 'alert', '', gico(S.role === 'human' ? 'attack' : 'claws', 56)) + `<p>${t('Anyone in the sector must declare it. Who was eliminated?')}</p>
      <div class="stack"><button class="btn" data-act="attackDone" data-k="none">${t('Nobody')}</button><button class="btn" data-act="attackDone" data-k="alien">${t('Only Alien(s)')}</button><button class="btn danger" data-act="attackDone" data-k="human">${t('At least one Human')}</button></div>
      <div class="row mini"><button class="btn" data-act="backres">${t('Back')}</button></div>`;
  if (r.stage === 'done') return head + sayBox(r.say, r.tone, '', r.icon && gico(r.icon, 56)) + (r.extra ? sayBox(r.extra, 'alert also', 'Also', r.extraIcon && gico(r.extraIcon, 44)) : '') +
    (r.report ? `<ul class="report">${r.report.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '') + (r.sub ? `<p class="dim">${esc(r.sub)}</p>` : '') +
    `<button class="btn primary big wide" data-act="next">${!inRoom() && S.turn >= MAX_TURN ? t('Finish game') : t('End turn')}</button>${handHtml()}${extras()}`;
  const safe = ty === 's' || ty === 'H' || ty === 'A';
  if (safe) return head + `<p class="dim">${t('Secure sector: no card to draw.')}</p>${sayBox(t('Silent Sector'), 'silent', '', gico('silent', 44))}<div class="row">${alien ? `<button class="btn danger big" data-act="attack">${t('Attack')}</button>` : ''}<button class="btn primary big" data-act="quiet">${t('Declare')}</button></div>${undoBtn()}${handHtml()}${extras()}`;
  if (digital()) return head + `<div class="row">${alien ? `<button class="btn danger big" data-act="attack">${t('Attack')}</button>` : ''}<button class="btn primary big" data-act="drawcard">${t('Draw a card')}</button></div>${undoBtn()}${handHtml()}`;
  return head + `${alien ? `<button class="btn danger wide slim" data-act="attack">${t('Attack this sector')}</button>` : ''}
    <div class="cards3 faces">${[['noiseHere', 'noise-here', 'Noise in your sector'], ['noiseAny', 'noise-any', 'Noise in any sector'], ['silence', 'silence', 'Silence or Item']].map(([a, i, n]) => `<button class="face" data-act="${a}">${gico(i, 40)}<span>${t(n)}</span></button>`).join('')}</div>
    <div class="row tight">${undoBtn()}</div>${extras()}`;
}

const SYNC_MSG = { connecting: 'Connecting…', online: 'Online', offline: 'Offline, will resync', error: 'Connection error', 'bad-code': 'Enter the 4-letter code', 'no-room': 'Table not found' };
function roomBlock() {
  if (!Sync.code) return '';
  return `<div class="roomrow"><div><small>${t('Table code')}</small><b>${esc(Sync.code)}</b><span class="stat-line ${Sync.status}">${t(SYNC_MSG[Sync.status] || 'Online')}</span></div>
    <button class="btn" data-act="qr">${t('QR code')}</button><button class="btn" data-act="share">${t('Share')}</button></div>`;
}
/* what the border of a marker means, and how my own steps look */
const legendHtml = () => {
  const ring = (k, extra = '') => `<svg class="dot" viewBox="-10 -10 20 20" aria-hidden="true"><circle r="9.2" fill="${k === 'me' ? '#fff' : '#0b1222'}"/><circle r="7" fill="${k === 'me' ? '#f5f5f5' : '#3a465e'}" stroke="${BORDER[k]}" stroke-width="3" ${extra}/></svg>`;
  return `<p class="legend">${[['me', 'Me'], ['', 'Unknown'], ['human', 'Human'], ['alien', 'Alien']].map(([k, l]) => `<span>${ring(k)}${t(l)}</span>`).join('')}</p>
  <p class="legend"><span><i class="lc heard"></i>${t('Heard')}</span><span><i class="lc silent"></i>${t('Silent or elsewhere')}</span><span><i class="lc bluff"></i>${t('Bluff (real below)')}</span></p>`;
};
const NEXT_SUS = { '': 'human', human: 'alien', alien: '' };
/* the tracking sheet: one row per player, one column per turn */
function sheetHtml() {
  const rows = [['me', t('Me')]].concat(knownPlayers()), own = ownSteps(), ps = tablePlayers();
  const turns = Array.from({ length: Math.max(1, Math.min(S.turn, MAX_TURN)) }, (_, i) => i + 1);
  const cur = S.hot ? Hot.curId() : T.turnState && T.turnState.uid;
  const cell = (k, n) => {
    if (k === 'me') {
      const step = S.path.filter(p => p.turn === n).pop(), bl = own.bluffs.find(b => b.turn === n);
      if (!step) return '<td class="c none">–</td>';
      if (bl) return `<td class="c bluff" title="${esc(t('Bluff (real below)'))}: ${esc(step.pos)}"><b>${esc(bl.sector)}</b><small>${esc(step.pos)}</small></td>`;
      return `<td class="c ${own.heard.has(n) ? 'heard' : 'silent'}">${esc(step.pos)}${step.star ? '*' : ''}</td>`;
    }
    const v = trackOf(k).filter(x => x.turn === n);
    if (!v.length) return '<td class="c none">–</td>';
    const [f, ink] = pal(k);
    return `<td class="c opp${v.some(x => x.kind === 'attack') ? ' att' : ''}" style="--f:${f};--i:${ink};--b:${borderOf(k)}">${v.map(x => esc(x.sector)).join(' ')}</td>`;
  };
  const body = rows.map(([k, n]) => {
    const u = k.startsWith('u:') ? k.slice(2) : k === 'me' ? myId() : null, p = u && ps[u], g = suspicion(k);
    const guess = k === 'me' ? '' : `<button class="gb ${g || 'none'}" data-act="sus" data-k="${esc(k)}" data-v="${NEXT_SUS[g]}" aria-label="${t('Your suspicion')}: ${t(g === 'human' ? 'Suspected Human' : g === 'alien' ? 'Suspected Alien' : 'No idea')}">${g === 'human' ? t('H') : g === 'alien' ? t('A') : '?'}</button>`;
    return `<tr class="${u && u === cur ? 'cur' : ''}${p && p.out ? ' out' : ''}"><th><span class="who"><button class="name" data-act="follow" data-k="${esc(k)}" aria-label="${t('Follow {p}', { p: esc(n) })}"><span class="dotw">${dotIcon(k)}${outMark(k)}</span><span>${esc(shortName(n))}</span></button>${guess}</span></th>${turns.map(x => cell(k, x)).join('')}</tr>`;
  }).join('');
  return `<div class="sheet${rows.length > 5 ? ' dense' : ''}" id="sheet"><table><thead><tr><th></th>${turns.map(n => `<th>${t('T{n}', { n })}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></div>`;
}
function decksHtml() {
  const c = T.counts || {}; if (!digital() || !c.sector) return '';
  const cell = (k, n) => `<span><b>${c[k].d}</b>/${c[k].d + c[k].x} ${t(n)}</span>`;
  return `<p class="decks1">${t('Cards left')}: ${cell('sector', 'Sector cards')} · ${cell('hatch', 'Escape Pod cards')}</p>`;
}
function tablePanel() {
  const ln = S.log.map(e => { const k = playerKey(e), icon = e.who === t('Game') || e.kind === 'info' && !e.by ? '' : dotIcon(k); return `<li class="${e.kind}${e.mine ? ' mine' : ''}"><time>${t('T{n}', { n: e.turn })}</time><span>${icon}<b>${esc(e.who)}</b> · ${logIcon(e)}${esc(entryText(e))}</span></li>`; }).join('');
  const skip = inRoom() && isHost() && T.turnState.uid !== Sync.uid && !gameOver() ? `<button class="btn wide" data-act="skipturn">${t('Skip {p}?', { p: pname(T.turnState.uid) })}</button>` : '';
  const sec = { players: 'sheet', hatches: 'status' }[T.tableSec] || T.tableSec || 'sheet', hatchAct = digital() ? '' : 'hatch';
  const secs = [['sheet', 'Sheet'], ['log', 'Log'], ['status', 'Status']];
  return `<div class="subtabs" role="tablist">${secs.map(([k, l]) => `<button role="tab" data-act="tsec" data-k="${k}" aria-selected="${sec === k}">${t(l)}</button>`).join('')}</div>
    <div class="tsecs">
    <section class="sec sheetsec${sec === 'sheet' ? ' on' : ''}">${sheetHtml()}${legendHtml()}</section>
    <section class="sec log${sec === 'log' ? ' on' : ''}">${digital() ? '' : `<button class="btn wide" data-act="addann">+ ${t('Record an announcement')}</button>`}
      ${ln ? `<ul class="log">${ln}</ul>${digital() || S.hot ? '' : `<button class="btn link wide" data-act="clearlog">${t('Clear announcements')}</button>`}` : `<p class="dim">${t('No announcements yet.')}</p>`}</section>
    <section class="sec status${sec === 'status' ? ' on' : ''}">${roomBlock()}${skip}<h3>${t('Escape hatches')}${hatchAct ? ` <span class="hint">${t('tap to close or reopen')}</span>` : ''}</h3>
      <div class="hatches compact">${mapHatches().map(n => { const lbl = `${t('Escape Hatch {n}', { n })}: ${S.hatches[n] ? t('Closed') : t('Open')}`; return hatchAct ? `<button data-act="hatch" data-n="${n}" aria-pressed="${!!S.hatches[n]}" aria-label="${lbl}">${n}</button>` : `<span class="hb${S.hatches[n] ? ' closed' : ''}" role="img" aria-label="${lbl}">${n}</span>`; }).join('')}</div>
      ${decksHtml()}</section>
    </div>`;
}

/* ---------------- who am I: Character icon, role and what it can do ---------------- */
const ROLE_HELP = {
  human: ['Reach an Escape Pod before the Aliens find you, within 40 rounds.', 'You move 1 sector per turn. Only Humans can use Items.', 'If an Alien attacks your sector you are killed, and restart from the Alien Sector as an Alien.'],
  alien: ['Hunt the Humans: kill them before they reach an Escape Pod.', 'You move 1 or 2 sectors (3 once you have fed on a Human). After moving you may attack instead of drawing a card.', 'An attack kills everyone in the sector, Aliens included. Keep your identity hidden: bluff like a Human.']
};
/* the Character's icon; a reborn Alien or a Companion player (no Character card in the app) gets one of the role's Characters */
const roleIcon = () => {
  if (S.char && !S.reborn && CHAR_ICON[S.char]) return CHAR_ICON[S.char];
  const l = CHARS[S.role === 'alien' ? 'alien' : 'human'], h = [...(S.name || 'x')].reduce((x, c) => (x * 31 + c.charCodeAt(0)) >>> 0, 7);
  return CHAR_ICON[l[h % l.length]];
};
function roleHtml() {
  const ab = myAbil(), r = S.role || 'human';
  return `<div class="dlgico">${gico(roleIcon(), 84)}</div><h2>${t(S.reborn || !S.char ? (r === 'alien' ? 'Alien' : 'Human') : S.char)}</h2>
    <p class="dim">${t(r === 'alien' ? 'Alien' : 'Human')}${S.reborn ? ' · ' + t('Reborn: no abilities') : ''}</p>
    ${ab && digital() ? `<p><b>${t('Ability')}:</b> ${t(ABILITIES[ab] || '')}</p>` : (basic() ? `<p class="dim">${t('Basic game: no Character abilities.')}</p>` : '')}
    <ul class="rolehelp">${ROLE_HELP[r].map(x => `<li>${t(x)}</li>`).join('')}</ul>`;
}
function roleDlg() { dlg.innerHTML = roleHtml() + `<div class="row"><button class="btn primary" id="d-no">OK</button></div>`; if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg; }
Object.assign(actions, { roledlg: roleDlg });
window.roleHtml = roleHtml;
