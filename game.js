'use strict';
/* Everything that happens during a game: turn order, moving, announcing, items, attacks, game over. */
const sayBox = (txt, tone, small) => `<div class="say ${tone || ''}"><small>${t(small || 'Say aloud')}</small><b>${esc(txt)}</b></div>`;
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
  if (isHost()) { if (S.online) { Online.evaluate(); Online.maybeBotTurn(); } else physicalEnd(); }
  save(); hdr(); paintCells(); if (S.tab === 'play' || S.tab === 'table') render();
}
function physicalEnd() {
  if (!T.turnState || T.turnState.n <= MAX_TURN || !Sync.settings || Sync.settings.status !== 'playing') return;
  const esc_ = Object.values(Sync.players || {}).filter(p => p.out === 'escaped').map(p => p.name.slice(0, 20));
  Sync.updateSettings({ status: 'over', result: { aliensWin: true, reason: 'time', escaped: esc_ } });
}
function startMyTurn(silent) {
  if (S.over) { endTurn(); return; }
  S.undo = null;
  S.phase = 'move'; S.res = null; S.adr = false; T.sel = null; T.itemIcon = false; refreshReach();
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
  if (S.revealed || !Sync.code) return; S.revealed = true;
  if (Sync.isHost() && typeof Online !== 'undefined') Online.revealBots();
  Sync.setMe({ role: S.role, char: S.char || '', route: encodeRoute(S.path) }); save();
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
/* common ending of a Sector card: public announcement, then (maybe) an item */
async function finishCard(kind, sector, hasItem) {
  const res = kind === 'silence' ? { say: t('Silence in all Sectors'), tone: 'silent', logged: say('', 'silence') }
    : { say: t('Noise in Sector {s}', { s: sector }), tone: 'alert', logged: say('', 'noise', sector) };
  if (hasItem) res.extra = digital() ? await drawItemMsg() : t('Draw an Item card (max 3)');
  announce(res);
}
const iconFlag = () => { const on = T.itemIcon && !basic(); T.itemIcon = false; return on; };

/* ---------------- digital draws ---------------- */
async function drawSector() {
  commit(); S.res = { stage: 'wait' }; afterChange();
  let rep; try { rep = await Eng().request('sector'); } catch (e) { S.res = { stage: 'choose' }; afterChange(); toast(t('The host did not answer. Try again.')); return; }
  const c = rep.card || 'silence', item = c.endsWith('-item') && !basic();
  if (c.startsWith('noise-self')) finishCard('noise', S.pos, item);
  else if (c.startsWith('noise-any')) pickSector(t('Noise in any sector: tap the sector you announce'), sec => finishCard('noise', sec, item), true);
  else finishCard('silence', null, false);
}
async function digitalHatch() {
  commit(); S.res = { stage: 'wait' }; afterChange();
  let rep; try { rep = await Eng().request('hatch'); } catch (e) { S.res = { stage: 'pod' }; afterChange(); toast(t('The host did not answer. Try again.')); return; }
  if (rep.card === 'red') actions.podRed(); else actions.podGreen();
}
async function giveItem() { const rep = await Eng().request('item'); if (rep.card) addItem(rep.card); return rep.card; }
async function drawItemMsg() {
  try { const c = await giveItem(); return c ? t('You drew: {i}', { i: t(ITEMS[c][0]) }) : t('No item cards left'); } catch (e) { return t('The host did not answer. Try again.'); }
}
function addItem(c) {
  if (!ITEMS[c]) return;
  if (S.items.length < 3) { S.items.push(c); save(); if (S.stage === 'game') render(); return; }
  const all = S.items.concat([c]); T.handTmp = all; T.lockDlg = true;
  dlg.innerHTML = `<h2>${t('Your hand is full')}</h2><p class="dim">${t('You hold 3 items. Choose one to discard.')}</p><div class="stack">${all.map((k, i) => `<button class="btn" data-act="discardpick" data-i="${i}">${t(ITEMS[k][0])}<small>${t(ITEMS[k][1])}</small></button>`).join('')}</div>`;
  if (!dlg.open) dlg.showModal();
}
dlg.addEventListener('cancel', e => { if (T.lockDlg) e.preventDefault(); });

/* ---------------- items ---------------- */
function useItem(id) {
  closeDlg();
  if (S.role !== 'human') return toast(t('Only Humans can use items'));
  if (!myTurn()) return toast(t('You can use items during your turn'));
  if (!S.items.includes(id)) return;
  commit();
  const dangerous = S.phase === 'resolve' && S.res && S.res.stage === 'choose' && at(T.map, S.pos) === '.';
  if (id === 'defense') return toast(t('Defense is played automatically when you are attacked'));
  if (id === 'adrenaline') { if (S.phase !== 'move') return toast(t('Play Adrenaline before you move')); Eng().consumeItem(id); S.adr = true; T.sel = null; afterChange(); return toast(t('You may move up to 2 sectors')); }
  if (id === 'teleport') { Eng().consumeItem(id); S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport' }); T.sel = null; afterChange(); focusOn(S.pos); return toast(S.phase === 'move' ? t('Teleported. Now make your normal move.') : t('Teleported to the Human sector')); }
  if (id === 'sedatives') { if (!dangerous) return toast(t('Use Sedatives instead of drawing a card')); Eng().consumeItem(id); return announce({ say: t('Nothing to announce'), sub: t('Sedatives: no card this turn.'), tone: 'silent' }); }
  if (id === 'spotlight') return pickSector(t('Spotlight: tap the sector to name'), async sec => {
    Eng().consumeItem(id); save(); render();
    const r = await Eng().spotlight(sec);
    const lines = r.seen.length ? r.seen.map(p => `${esc(p.name)}: ${esc(p.pos)}`).join('<br>') : t('Nobody is in that area.');
    alertHtml(t('Spotlight on Sector {s}', { s: sec }), lines);
  }, true);
  if (id === 'attack') { Eng().consumeItem(id); return runAttack(true); }
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
    else { lines.push(t('{p} was eliminated ({r})', { p: h.name, r: roleLabel(h.role, h.char) })); if (h.role === 'human' && S.role === 'alien' && !infection()) fed = true; }
  }
  if (!r.hits.length) lines.push(t('Nobody was in the sector'));
  r.missing.forEach(p => lines.push(t('No answer from {p}', { p })));
  if (fed && !S.fed) { S.fed = true; lines.push(t('You have FED: from now on you move 1, 2 or 3 sectors.')); }
  if (fromItem) { save(); render(); hdr(); alertHtml(t('Attack in Sector {s}', { s: sec }), lines.map(esc).join('<br>')); }
  else announce({ say: t('Attack in Sector {s}', { s: sec }), tone: 'alert', report: lines });
}

/* ---------------- manual (physical card) actions ---------------- */
Object.assign(actions, {
  confirm: confirmMove,
  clearsel() { T.sel = null; afterChange(); },
  icon() { T.itemIcon = !T.itemIcon; render(); },
  noiseHere() { finishCard('noise', S.pos, iconFlag()); },
  noiseAny() { const f = iconFlag(); pickSector(t('Tap the sector you announce'), id => finishCard('noise', id, f)); },
  silence() { finishCard('silence', null, false); },
  quiet() { announce({ say: t('Nothing to announce'), tone: 'silent' }); },
  drawcard() { drawSector(); },
  hatchdraw() { digitalHatch(); },
  attack() { commit(); if (digital()) runAttack(false); else { S.res = { stage: 'attack' }; afterChange(); } },
  attackDone(b) {
    commit(); const k = b.dataset.k; say('', 'attack', S.pos);
    let sub = t('Anyone in this sector must declare it and is out of the game.');
    if (k === 'human' && S.role === 'alien' && !S.fed && !infection()) { S.fed = true; sub += ' ' + t('You have FED: from now on you move 1, 2 or 3 sectors.'); }
    announce({ say: t('Attack in Sector {s}', { s: S.pos }), sub, tone: 'alert' });
  },
  podGreen() { commit(); const n = +at(T.map, S.pos); say('', 'hatch', S.pos, { n, ok: 1 }); S.hatches[n] = 1; Sync.setHatch(n, 1); S.over = 'escaped'; afterChange(); },
  podRed() { commit(); const n = +at(T.map, S.pos); S.hatches[n] = 1; Sync.setHatch(n, 1); say('', 'hatch', S.pos, { n, ok: 0 }); announce({ say: t('Escape Hatch {n}: damaged', { n }), sub: t('Reveal the red card. Nobody can enter this hatch again.'), tone: 'alert' }); },
  next: endTurn,
  undo: undoMove,
  enterhatch() { actions.podGreen(); },
  backres() { S.res = { stage: 'choose' }; afterChange(); },
  useitem(b) { useItem(b.dataset.i); },
  itemdlg(b) { itemDlg(b.dataset.i); },
  discardpick(b) {
    const all = T.handTmp || []; const [d] = all.splice(+b.dataset.i, 1); S.items = all; T.lockDlg = false; closeDlg();
    if (d) Eng().discard(d); save(); render();
  },
  item(b) { manualItem(b.dataset.i); },
  caught(b) { caughtAction(b.dataset.k); },
  hatch(b) { const n = b.dataset.n; S.hatches[n] = S.hatches[n] ? 0 : 1; Sync.setHatch(n, S.hatches[n]); afterChange(); },
  turnminus() { S.turn = Math.max(1, S.turn - 1); afterChange(); },
  turnplus() { S.turn = Math.min(MAX_TURN, S.turn + 1); afterChange(); },
  hotgo() { Hot.go(); },
  skipturn() { confirmDlg(t('Skip {p}?', { p: pname(T.turnState.uid) }), t('Use this when a player is away. Their turn ends now.'), () => { const nx = nextTurn(); if (nx) Sync.setTurn(nx); }); }
});
function manualItem(k) {
  closeDlg(); commit();
  if (k === 'adrenaline') { if (S.phase !== 'move' || S.role !== 'human') return toast(t('Play Adrenaline before you move')); S.adr = true; say('Adrenaline used', 'info'); T.sel = null; afterChange(); return toast(t('You may move up to 2 sectors')); }
  if (k === 'teleport') { if (S.role !== 'human') return; S.pos = find(T.map, 'H'); S.path.push({ turn: S.turn, pos: S.pos, note: 'teleport' }); say('Teleport used', 'info'); T.sel = null; afterChange(); focusOn(S.pos); return toast(S.phase === 'move' ? t('Teleported. Now make your normal move.') : t('Teleported to the Human sector')); }
  if (k === 'spotlight') return pickSector(t('Spotlight: tap the sector to name'), id => { say('', 'spot', id); afterChange(); toast(t('Announce: Spotlight on Sector {s}', { s: id })); });
  if (k === 'sedatives') { if (S.phase !== 'resolve' || S.res.stage !== 'choose') return toast(t('Use Sedatives instead of drawing a card')); say('Sedatives used', 'info'); return announce({ say: t('Nothing to announce'), sub: t('Sedatives: no card this turn.'), tone: 'silent' }); }
  if (k === 'attack') { if (S.phase !== 'resolve' || S.res.stage === 'done') return toast(t('Use Attack after moving')); return actions.attack(); }
}
function caughtAction(k) {
  closeDlg();
  if (k === 'become') { S.role = 'alien'; S.fed = false; say('Eliminated, continuing as an Alien', 'info'); Sync.setMe({ conv: true }); S.phase = 'move'; S.res = null; T.sel = null; afterChange(); toast(t('You are now an Alien, moving from where you fell')); }
  else if (k === 'dead') { say('Eliminated', 'info'); S.over = 'dead'; afterChange(); }
  else if (k === 'survive') { say('Survived an attack (Defense)', 'info'); afterChange(); }
}
function itemsDlg() {
  const it = (k, n, d) => `<button class="btn" data-act="item" data-i="${k}">${t(n)}<small>${t(d)}</small></button>`;
  dlg.innerHTML = `<h2>${t('Item played')}</h2><div class="stack">
    ${['adrenaline', 'sedatives', 'teleport', 'spotlight', 'attack'].map(k => it(k, ITEMS[k][0], ITEMS[k][1])).join('')}</div>
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
function caughtDlg() {
  const h = S.role === 'human';
  dlg.innerHTML = `<h2>${t('I was attacked')}</h2><p class="dim">${h && !basic() ? t('Play a Defense card to survive.') : t('You must declare your presence.')}</p><div class="stack">
    ${h && !basic() ? `<button class="btn ok" data-act="caught" data-k="survive">${t('I survived (Defense card)')}</button>` : ''}
    <button class="btn danger" data-act="caught" data-k="dead">${t('I was eliminated: out of the game')}</button>
    ${h && infection() ? `<button class="btn danger" data-act="caught" data-k="become">${t('Eliminated: I become an Alien (Infection)')}</button>` : ''}
  </div><div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
window.itemsDlg = itemsDlg; window.caughtDlg = caughtDlg; window.addItem = addItem;

/* ---------------- panels ---------------- */
const physExtras = () => `<div class="row mini">${basic() || S.role !== 'human' ? '' : `<button class="btn" onclick="itemsDlg()">${t('Item played')}</button>`}<button class="btn" onclick="caughtDlg()">${t('I was attacked')}</button></div>`;
/* the three item slots of the digital game; tap one to read it and use it */
const handHtml = () => {
  if (!digital()) return '';
  return `<div class="slots" role="group" aria-label="${t('Your items')}">${[0, 1, 2].map(i => { const k = S.items[i]; return k ? `<button class="slot" data-act="itemdlg" data-i="${k}">${t(ITEMS[k][0])}</button>` : `<span class="slot empty">${t('Empty slot')}</span>`; }).join('')}</div>`;
};
function itemDlg(k) {
  const can = S.role === 'human' && myTurn() && !S.over && !gameOver() && k !== 'defense';
  const why = S.role !== 'human' ? t('Aliens can hold items but not use them') : k === 'defense' ? t('Defense is played automatically when you are attacked') : !myTurn() ? t('You can use items during your turn') : '';
  dlg.innerHTML = `<h2>${t(ITEMS[k][0])}</h2><p>${t(ITEMS[k][1])}</p>${why ? `<p class="dim">${why}</p>` : ''}
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button>${can ? `<button class="btn primary" data-act="useitem" data-i="${k}">${t('Use')}</button>` : ''}</div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
const extras = () => (digital() ? '' : physExtras());
const outBadge = p => p.out === 'escaped' ? `<span class="b-ok">${ico('check', 14)} ${t('escaped')}</span>` : p.out ? `<span class="b-out">${ico('cross', 14)} ${p.out === 'trapped' ? t('trapped') : t('eliminated')}${p.role ? ' (' + t(p.role === 'alien' ? 'Alien' : 'Human') + ')' : ''}</span>` : '';
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
    ${orderList()}${handHtml()}${digital() ? '' : `<div class="row mini"><button class="btn" onclick="caughtDlg()">${t('I was attacked')}</button></div>`}`;
}
function overPanel() {
  const m = { escaped: ['Escaped!', 'You left the ship and win. That hatch is now blocked.'], time: ['39 rounds played', 'Humans still on board are eliminated: the Aliens win.'], dead: ['Out of the game', 'You were eliminated. Your Character card is revealed.'], trapped: ['No way out', 'Every Escape Hatch is blocked or damaged. You are eliminated.'] }[S.over];
  return `<h2>${t(m[0])}</h2><p>${t(m[1])}</p>${inRoom() ? `<p class="dim">${t('You can keep following the game in the Table tab.')}</p>${orderList()}` : `<button class="btn primary big wide" data-act="newgame">${t('New game')}</button>`}`;
}
function globalOverPanel() {
  const r = (S.hot ? Hot.result() : Sync.settings.result) || {}, esc_ = r.escaped || [], ps = tablePlayers();
  const why = { time: 'Time is up: 39 turns have been played.', escape: 'The last Human has escaped.', eliminated: 'The last Human was eliminated.' }[r.reason] || '';
  const rows = tableOrder().filter(u => ps[u]).map(u => { const p = ps[u]; return `<li class="${p.out === 'escaped' ? 'ok' : ''}">${dotIcon(u === myId() ? 'me' : 'u:' + u)}<span class="pname">${esc(p.name)}</span><span class="pst">${p.role ? t(p.role === 'alien' ? 'Alien' : 'Human') + (p.char ? ' · ' + t(p.char) : '') : '…'}</span>${outBadge(p) || ''}</li>`; }).join('');
  return `<h2>${t('Game over')}</h2>
    ${sayBox(r.aliensWin ? t('The Aliens win!') : t('The Humans win!'), r.aliensWin ? 'alert' : '', 'Result')}
    <p class="dim">${t(why)}</p>${esc_.length ? `<p>${t('Humans who escaped: {n}', { n: esc_.map(esc).join(', ') })}</p>` : ''}
    <div class="seg revseg" role="radiogroup" aria-label="${t('Map')}"><button role="radio" data-act="revealview" data-v="real" aria-checked="${!T.showAnn}">${t('Real routes')}</button><button role="radio" data-act="revealview" data-v="ann" aria-checked="${!!T.showAnn}">${t('Announcements')}</button></div>
    <ul class="plist rev">${rows}</ul><button class="btn primary big wide" data-act="newgame">${t('New game')}</button>`;
}

function playPanel() {
  if (T.pick) return '';
  if (gameOver()) return globalOverPanel();
  if (S.over) return overPanel();
  if (inRoom() && !myTurn()) return waitPanel();
  const n = allowance(), alien = S.role === 'alien';
  if (S.phase === 'move') {
    const sel = T.sel;
    return `<h2>${sel ? esc(label(sel)) + ` <span class="dim sub">${esc(typeName(at(T.map, sel)))}</span>` : t('Tap a highlighted sector')}</h2>
      ${sel ? `<div class="row confirmrow"><button class="btn" data-act="clearsel" aria-label="${t('Change')}">${ico('close')}</button><button class="btn primary big" data-act="confirm">${t('Confirm move')}</button></div>` : ''}
      ${handHtml()}${extras()}`;
  }
  const ty = at(T.map, S.pos), r = S.res || { stage: 'choose' };
  const head = `<h2>${esc(label(S.pos))}${'.sHA'.includes(ty) ? ` <span class="dim sub">${esc(typeName(ty))}</span>` : ''}</h2>`;
  if (r.stage === 'wait') return head + `<p class="dim" role="status">${t('Waiting for the host…')}</p>`;
  if (r.stage === 'pod') return head + (basic() || infection()
    ? `<p>${t('You reached an Escape Hatch.')}</p><button class="btn ok big wide" data-act="enterhatch">${t('Enter the Escape Hatch')}</button>`
    : digital()
    ? `<p>${t('You reached an Escape Hatch. Draw the Escape Hatch card.')}</p><button class="btn primary big wide" data-act="hatchdraw">${t('Draw hatch card')}</button>`
    : `<p>${t('Declare which hatch you reached, then draw an Escape Hatch card and reveal it.')}</p><div class="row"><button class="btn ok big" data-act="podGreen">${t('Green: escaped')}</button><button class="btn danger big" data-act="podRed">${t('Red: damaged')}</button></div>`) + undoBtn();
  if (r.stage === 'attack') return head + sayBox(t('Attack in Sector {s}', { s: S.pos }), 'alert') + `<p>${t('Anyone in the sector must declare it. Who was eliminated?')}</p>
      <div class="stack"><button class="btn" data-act="attackDone" data-k="none">${t('Nobody')}</button><button class="btn" data-act="attackDone" data-k="alien">${t('Only Alien(s)')}</button><button class="btn danger" data-act="attackDone" data-k="human">${t('At least one Human')}</button></div>
      <div class="row mini"><button class="btn" data-act="backres">${t('Back')}</button></div>`;
  if (r.stage === 'done') return head + sayBox(r.say, r.tone) + (r.extra ? sayBox(r.extra, 'alert also', 'Also') : '') +
    (r.report ? `<ul class="report">${r.report.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '') + (r.sub ? `<p class="dim">${esc(r.sub)}</p>` : '') +
    `<button class="btn primary big wide" data-act="next">${!inRoom() && S.turn >= MAX_TURN ? t('Finish game') : t('End turn')}</button>${handHtml()}${extras()}`;
  const safe = ty === 's' || ty === 'H' || ty === 'A';
  if (safe) return head + `<p class="dim">${t('Secure sector: no card to draw.')}</p><div class="row">${alien ? `<button class="btn danger big" data-act="attack">${t('Attack')}</button>` : ''}<button class="btn primary big" data-act="quiet">${t('Done')}</button></div>${undoBtn()}${handHtml()}${extras()}`;
  if (digital()) return head + `<div class="row">${alien ? `<button class="btn danger big" data-act="attack">${t('Attack')}</button>` : ''}<button class="btn primary big" data-act="drawcard">${t('Draw a card')}</button></div>${undoBtn()}${handHtml()}`;
  return head + `${alien ? `<button class="btn danger wide slim" data-act="attack">${t('Attack this sector')}</button>` : ''}
    <div class="cards3"><button class="btn" data-act="noiseHere">${t('Noise in your sector')}</button><button class="btn" data-act="noiseAny">${t('Noise in any sector')}</button><button class="btn" data-act="silence">${t('Silence')}</button></div>
    <div class="row tight">${basic() ? '' : `<button class="btn check" data-act="icon" aria-pressed="${!!T.itemIcon}"><i></i>${t('Item icon')}</button>`}${undoBtn()}</div>${extras()}`;
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
      return `<td class="c ${own.heard.has(n) ? 'heard' : 'silent'}">${esc(step.pos)}</td>`;
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
  return `<p class="decks1">${t('Cards left')}: ${cell('sector', 'Sector cards')} · ${cell('item', 'Item cards')} · ${cell('hatch', 'Escape Hatch cards')}</p>`;
}
function tablePanel() {
  const ln = S.log.map(e => { const k = playerKey(e), icon = e.who === t('Game') || e.kind === 'info' && !e.by ? '' : dotIcon(k); return `<li class="${e.kind}${e.mine ? ' mine' : ''}"><time>${t('T{n}', { n: e.turn })}</time><span>${icon}<b>${esc(e.who)}</b> · ${esc(entryText(e))}</span></li>`; }).join('');
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
