'use strict';
/* Pre-game flow: welcome -> (host setup | join) -> lobby -> game.  Solo play skips the table. */
const MODES = { advanced: ['Advanced game', 'Items and Escape Hatch cards. Play on until every Human has escaped or died.'], basic: ['Basic game', 'No items. The game ends when the first Human reaches a hatch.'], infection: ['Infection scenario', 'Eliminated Humans become Aliens. All hatches open, each works once.'] };
const CARDS = { physical: ['Physical cards', 'You use the real deck. The app tracks routes and turns.'], online: ['Digital cards (full online)', 'No physical pieces. The app deals roles and cards and resolves items and attacks.'] };
const tableMaps = () => T.maps.filter(m => m.official);
const isHost = () => Sync.isHost();
const isOnline = () => !!(Sync.settings && Sync.settings.online);
const orderedIds = () => { const ps = Sync.players || {}, ord = (Sync.settings && Sync.settings.order) || []; const l = ord.filter(u => ps[u]); Object.keys(ps).forEach(u => { if (!l.includes(u)) l.push(u); }); return l; };
const orderedPlayers = () => orderedIds().map(u => [u, Sync.players[u]]);
const langSwitch = () => `<div class="lang-switch" role="group" aria-label="Language">${['en', 'it'].map(l => `<button data-act="lang" data-l="${l}" aria-pressed="${LANG === l}">${l.toUpperCase()}</button>`).join('')}</div>`;
const hero = () => `${langSwitch()}<p class="eyebrow">${t('Companion app · physical game required')}</p>
  <h1>${t('Escape from the')}<br><span class="red">${t('Aliens')}</span> ${t('in Outer Space')}</h1>`;
const nameField = () => `<label class="field"><span>${t('Your name')}</span><input id="flow-name" type="text" maxlength="20" autocomplete="off" placeholder="${t('Player')}" value="${esc(S.name || '')}"></label>`;
const mapSelect = (list, cur) => `<label class="field"><span>${t('Map')}</span><select id="f-map">${list.map(m => `<option value="${esc(m.id)}"${m.id === cur ? ' selected' : ''}>${esc(m.name)}</option>`).join('')}</select></label>
  <p class="dim hintline" id="f-map-desc"></p>`;
const modeSelect = cur => `<label class="field"><span>${t('Rules')}</span><select id="f-mode">${Object.entries(MODES).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${t(v[0])}</option>`).join('')}</select></label>
  <p class="dim hintline" id="f-mode-desc"></p>`;
const cardSelect = cur => `<label class="field"><span>${t('Cards')}</span><select id="f-cards">${Object.entries(CARDS).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${t(v[0])}</option>`).join('')}</select></label>
  <p class="dim hintline" id="f-cards-desc"></p>`;
const myName = () => (S.name || '').trim() || t('Player');
const readName = () => { const el = $('#flow-name'); if (el) S.name = el.value.trim(); return myName(); };

function renderFlow() {
  const card = $('#flow-card'); let h = '';
  const st = S.stage;
  if (st === 'host') {
    h = `${hero()}<h2 class="step2">${t('Host a table')}</h2>${nameField()}${mapSelect(tableMaps(), S.mapId || 'galilei')}${modeSelect(S.mode || 'advanced')}${cardSelect(S.cards || 'physical')}
      <button class="btn primary big wide" data-act="hostcreate">${t('Create table')}</button>${flowStatus()}
      <button class="btn link wide" data-act="back">${t('Back')}</button>`;
  } else if (st === 'solo') {
    h = `${hero()}<h2 class="step2">${t('Play without a table')}</h2>${nameField()}${mapSelect(T.maps, S.mapId || 'galilei')}${modeSelect(S.mode || 'advanced')}
      <fieldset class="roles"><legend>${t('Your secret role card says…')}</legend>
      <button class="role-btn human" data-act="solostart" data-role="human"><b>${t('Human')}</b><small>${t('Reach an escape hatch')}</small></button>
      <button class="role-btn alien" data-act="solostart" data-role="alien"><b>${t('Alien')}</b><small>${t('Hunt the crew')}</small></button></fieldset>
      <button class="btn link wide" data-act="back">${t('Back')}</button>`;
  } else if (st === 'hotsetup') {
    const names = T.hotNames || (T.hotNames = [1, 2, 3, 4].map(i => t('Player {n}', { n: i })));
    h = `${hero()}<h2 class="step2">${t('Pass and play')}</h2><p class="dim hintline">${t('One device, digital cards. Players take turns and hand the device over.')}</p>
      <h3>${t('Players')} (${names.length})</h3><ol class="hotnames">${names.map((n, i) => `<li><input type="text" maxlength="20" data-hn="${i}" value="${esc(n)}" aria-label="${t('Player {n}', { n: i + 1 })}">${names.length > 2 ? `<button class="btn" data-act="hotdel" data-i="${i}" aria-label="${t('Remove')}">✕</button>` : ''}</li>`).join('')}</ol>
      ${names.length < 8 ? `<button class="btn wide" data-act="hotadd">+ ${t('Add player')}</button>` : ''}
      ${mapSelect(T.maps, S.mapId || 'galilei')}${modeSelect(S.mode || 'advanced')}
      <button class="btn primary big wide" data-act="hotstart">${t('Start game')}</button>
      <button class="btn link wide" data-act="back">${t('Back')}</button>`;
  } else if (st === 'lobby') {
    h = lobbyHtml();
  } else {
    h = `${hero()}<p class="lead">${t('Your private navigation computer. Plan your route, track your turns and get the exact words to announce. Cards stay in the box.')}</p>
      ${T.pendingRoom ? `<p class="banner">${t('You are invited to table {c}.', { c: esc(T.pendingRoom) })}</p>` : ''}${nameField()}
      ${T.pendingRoom ? `<button class="btn primary big wide" data-act="joinroom">${t('Join table {c}', { c: esc(T.pendingRoom) })}</button><button class="btn link wide" data-act="ignoreinvite">${t('Not now')}</button>`
      : `<button class="btn primary big wide" data-act="hostsetup">${t('Host a table')}</button>
        <div class="or"><span>${t('or')}</span></div>
        <div class="inline"><input id="join-code" type="text" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="${t('Table code')}" aria-label="${t('Table code')}"><button class="btn" data-act="joinroom">${t('Join')}</button></div>
        <button class="btn wide hotbtn" data-act="hotsetup">${t('Pass and play (one device)')}</button>
        <button class="btn link wide" data-act="solo">${t('Play without a table')}</button>`}
      ${flowStatus()}`;
  }
  const keep = card.scrollTop; card.innerHTML = h;
  const fm = $('#f-map'), fd = $('#f-mode'), fc = $('#f-cards');
  const upd = () => {
    if (fm) { const m = T.maps.find(x => x.id === fm.value); $('#f-map-desc').textContent = m && m.description ? t(m.description) : ''; }
    if (fd) $('#f-mode-desc').textContent = t(MODES[fd.value][1]);
    if (fc) $('#f-cards-desc').textContent = t(CARDS[fc.value][1]);
  };
  if (fm) fm.onchange = () => { S.mapId = fm.value; upd(); if (st === 'lobby') Sync.updateSettings({ map: fm.value }); };
  if (fd) fd.onchange = () => { S.mode = fd.value; upd(); if (st === 'lobby') Sync.updateSettings({ mode: fd.value }); };
  if (fc) fc.onchange = () => { S.cards = fc.value; upd(); if (st === 'lobby') Sync.updateSettings({ online: fc.value === 'online' }); };
  upd();
  const jc = $('#join-code'); if (jc) jc.onkeydown = e => { if (e.key === 'Enter') actions.joinroom(); };
}
const FLOW_MSG = { connecting: 'Connecting…', error: 'Connection error', 'bad-code': 'Enter the 4-letter code', 'no-room': 'Table not found', started: 'That game has already started', closed: 'The host closed this game.', full: 'This table is full (8 players).' };
function flowStatus() { return FLOW_MSG[Sync.status] ? `<p class="dim" role="status">${t(FLOW_MSG[Sync.status])}${Sync.status === 'error' && Sync.lastError ? ` <code>${esc(Sync.lastError)}</code>` : ''}</p>` : ''; }

function lobbyHtml() {
  const st = Sync.settings || {}, host = isHost(), online = isOnline(), players = orderedPlayers();
  const map = T.maps.find(m => m.id === st.map) || T.maps[0], mode = MODES[st.mode] || MODES.advanced, cards = CARDS[online ? 'online' : 'physical'];
  const allReady = players.length >= 2 && players.every(([, p]) => p.ready) && (online ? players.length <= 8 : true);
  const rows = players.map(([id, p], i) => `<li class="${p.ready ? 'ok' : ''}"><span class="num">${i + 1}</span><span class="pname">${esc(p.name)}${id === Sync.uid ? ` <em>${t('(you)')}</em>` : ''}${st.host === id ? ` <em class="hostt">${t('Host')}</em>` : ''}</span>
    <span class="pst">${p.ready ? '✓ ' + t('Ready') : t('Choosing…')}</span>
    ${host ? `<span class="mv"><button data-act="mvup" data-u="${esc(id)}" aria-label="${t('Move up')}" ${i === 0 ? 'disabled' : ''}>▲</button><button data-act="mvdown" data-u="${esc(id)}" aria-label="${t('Move down')}" ${i === players.length - 1 ? 'disabled' : ''}>▼</button></span>` : ''}</li>`).join('');
  const faction = ['human', 'alien'].map(r => `<button class="role-btn ${r}" data-act="faction" data-r="${r}" aria-pressed="${S.myRole === r}"><b>${t(r === 'human' ? 'Human' : 'Alien')}</b></button>`).join('');
  const canReady = online || S.myRole;
  return `${langSwitch()}<p class="eyebrow">${t('Table')}</p>
    <div class="roomcard"><div><small>${t('Table code')}</small><b>${esc(Sync.code || S.room || '')}</b><span class="stat-line ${Sync.status}">${t(SYNC_MSG[Sync.status] || 'Online')}</span></div>
      <div class="row"><button class="btn primary" data-act="qr">${t('QR code')}</button><button class="btn" data-act="share">${t('Share')}</button></div></div>
    <h3>${t('Game')}</h3>
    ${host ? mapSelect(tableMaps(), st.map) + modeSelect(st.mode) + cardSelect(online ? 'online' : 'physical')
      : `<dl class="kv"><dt>${t('Map')}</dt><dd>${esc(map.name)}</dd><dt>${t('Rules')}</dt><dd>${t(mode[0])}</dd><dt>${t('Cards')}</dt><dd>${t(cards[0])}</dd></dl><p class="dim hintline">${t(mode[1])}</p>`}
    <h3>${t('Turn order')} (${players.length}) ${host ? `<button class="mini-link" data-act="shuffleorder">${t('Shuffle')}</button>` : ''}</h3>
    <ul class="plist">${rows}</ul>
    ${host ? `<p class="dim hintline">${t('Use the arrows to set the order of play. The first player starts.')}</p>` : ''}
    ${online ? `<h3>${t('Your faction')}</h3><p class="dim hintline">${t('Roles and cards are dealt automatically when the game starts.')}</p>`
      : `<h3>${t('Your faction')}</h3><p class="dim hintline">${t('Draw your Character card from the physical deck, look at it in secret, then pick it here. Nobody else sees your choice.')}</p>
    <div class="factions" role="group" aria-label="${t('Your faction')}">${faction}</div>`}
    <button class="btn big wide ${S.ready ? 'ok' : 'primary'}" data-act="ready" ${canReady ? '' : 'disabled'}>${S.ready ? '✓ ' + t('Ready (tap to change)') : t("I'm ready")}</button>
    ${host ? `<button class="btn primary big wide startbtn" data-act="startgame" ${allReady ? '' : 'disabled'}>${t('Start game')}</button>
      <p class="dim hintline">${allReady ? t('Everyone is ready.') : players.length < 2 ? t('Waiting for at least one more player.') : t('Waiting for everyone to be ready.')}</p>`
      : `<p class="dim hintline">${S.ready ? t('Waiting for the host to start the game…') : ''}</p>`}
    <button class="btn link wide" data-act="leavelobby">${t('Leave table')}</button>`;
}

async function beginGame() {
  const st = Sync.settings; if (!st || S.stage !== 'lobby' || T.beginning) return;
  T.beginning = true;
  let role = S.myRole, char = '';
  if (st.online) { const sec = await Sync.get('secret/' + Sync.uid); if (sec) { role = sec.role; char = sec.char || ''; } else role = null; }
  T.beginning = false;
  if (!role || !S.ready) { toast(t('The game started without you. Ask the host.')); leaveToWelcome(); return; }
  T.map = T.maps.find(m => m.id === st.map) || T.maps[0];
  const keep = S.customMaps, name = S.name, room = S.room;
  S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, mode: st.mode, role, char, online: !!st.online, name, room, customMaps: keep, tab: 'play' });
  S.pos = find(T.map, role === 'human' ? 'H' : 'A'); S.path = [{ turn: 0, pos: S.pos }];
  T.turnState = Sync.turn || null; if (T.turnState) S.turn = T.turnState.n;
  save(); boot();
  if (S.online && (typeof Online !== 'undefined')) Online.attach();
  if (st.first) alertDlg(t('The game begins!'), t('First player: {p}.', { p: st.first }));
  if (T.turnState && T.turnState.uid === Sync.uid) startMyTurn(true);
}
function leaveToWelcome() { Sync.leave(); S.room = null; S.stage = 'welcome'; S.myRole = null; S.ready = false; save(); renderFlow(); }

function soloStart(role) {
  const id = $('#f-map').value; T.map = T.maps.find(m => m.id === id) || T.maps[0];
  const keep = S.customMaps, name = readName(), mode = $('#f-mode').value;
  S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, role, name: name === t('Player') ? '' : name, mode, customMaps: keep });
  S.pos = find(T.map, role === 'human' ? 'H' : 'A');
  if (!S.pos) { alert(t('This map has no start sector for your role.')); S.stage = 'solo'; S.role = null; return; }
  S.path = [{ turn: 0, pos: S.pos }]; save(); boot();
}

function readHot() { document.querySelectorAll('[data-hn]').forEach(el => { T.hotNames[+el.dataset.hn] = el.value; }); }
function reorder(uid, delta) {
  const ids = orderedIds(), i = ids.indexOf(uid), j = i + delta;
  if (i < 0 || j < 0 || j >= ids.length) return;
  [ids[i], ids[j]] = [ids[j], ids[i]]; Sync.updateSettings({ order: ids });
}
function startTable() {
  const ps = orderedPlayers(); if (ps.length < 2 || !ps.every(([, p]) => p.ready)) return;
  const order = ps.map(([u]) => u), first = ps[0][1].name;
  if (isOnline() && (typeof Online !== 'undefined')) Online.hostStart(order, first); else Sync.startGame(first, order);
}

Object.assign(actions, {
  hostsetup() { readName(); S.stage = 'host'; save(); renderFlow(); },
  hotsetup() { S.stage = 'hotsetup'; save(); renderFlow(); },
  hotadd() { readHot(); if (T.hotNames.length < 8) T.hotNames.push(t('Player {n}', { n: T.hotNames.length + 1 })); renderFlow(); },
  hotdel(b) { readHot(); T.hotNames.splice(+b.dataset.i, 1); renderFlow(); },
  hotstart() { readHot(); const names = T.hotNames.map((n, i) => n.trim().slice(0, 20) || t('Player {n}', { n: i + 1 })); Hot.start(names, $('#f-map').value, $('#f-mode').value); },
  solo() { S.stage = 'solo'; save(); renderFlow(); },
  back() { S.stage = 'welcome'; Sync.status = 'off'; save(); renderFlow(); },
  ignoreinvite() { T.pendingRoom = null; try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ } renderFlow(); },
  async hostcreate() {
    const name = readName(); S.mapId = $('#f-map').value; S.mode = $('#f-mode').value; S.cards = $('#f-cards').value;
    const ok = await Sync.create({ map: S.mapId, mode: S.mode, online: S.cards === 'online' }, { name });
    if (!ok) renderFlow();
  },
  async joinroom() {
    const name = readName(), code = T.pendingRoom || ($('#join-code') || {}).value || '';
    const ok = await Sync.join(code, { name });
    if (!ok) renderFlow();
  },
  faction(b) { S.myRole = b.dataset.r; S.ready = false; Sync.setMe({ ready: false }); save(); renderFlow(); },
  ready() { if (!S.myRole && !isOnline()) return; S.ready = !S.ready; Sync.setMe({ ready: S.ready }); save(); renderFlow(); },
  mvup(b) { reorder(b.dataset.u, -1); },
  mvdown(b) { reorder(b.dataset.u, 1); },
  shuffleorder() { const ids = orderedIds(); for (let i = ids.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [ids[i], ids[j]] = [ids[j], ids[i]]; } Sync.updateSettings({ order: ids }); },
  startgame: startTable,
  leavelobby() { confirmDlg(t('Leave this table?'), t('You will stop receiving announcements.'), leaveToWelcome); },
  solostart(b) { soloStart(b.dataset.role); }
});

/* keep the stored order in line with who is at the table (host only) */
function syncOrder() {
  if (!isHost() || !Sync.settings || Sync.settings.status !== 'lobby') return;
  const want = orderedIds(), have = Sync.settings.order || [];
  if (want.length !== have.length || want.some((u, i) => u !== have[i])) Sync.updateSettings({ order: want });
}

Sync.on({
  status(s) {
    if ((S.stage === 'lobby' || S.stage === 'game') && (s === 'no-room' || s === 'started' || s === 'closed' || s === 'full')) { toast(t(FLOW_MSG[s])); Sync.leave(true); resetToWelcome(); return; }
    if (S.stage === 'game') { if (S.tab === 'table' && !T.editor) render(); } else renderFlow();
  },
  joined(code) {
    S.room = code; if (S.stage !== 'game') { S.stage = 'lobby'; T.pendingRoom = null; try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ } renderFlow(); }
    save(); if (S.stage === 'game') { if (S.online && (typeof Online !== 'undefined')) Online.attach(); if (S.tab === 'table') render(); }
  },
  settings(st) {
    if (st && st.status === 'over' && st.result && st.result.reason === 'closed' && (S.stage === 'lobby' || S.stage === 'game') && !Sync.isHost()) { toast(t('The host closed this game.')); Sync.leave(true); resetToWelcome(); return; }
    if (S.stage === 'lobby') { if (st && st.status === 'playing') beginGame(); else { syncOrder(); renderFlow(); } }
    else if (S.stage === 'game') { if (st && st.status === 'over') showGameOver(); hdr(); if (S.tab === 'play' || S.tab === 'table') render(); }
  },
  players() {
    if (S.stage === 'lobby') { syncOrder(); renderFlow(); }
    else if (S.stage === 'game') { if ((typeof Online !== 'undefined')) Online.onPlayers(); if (S.tab === 'table' || (S.tab === 'play' && !myTurn())) render(); }
  },
  turn(v) { onTurn(v); },
  counts(c) { T.counts = c; if (S.stage === 'game' && S.tab === 'table') render(); },
  entry(e) {
    if (!e || !e.id || S.log.some(x => x.id === e.id)) return;
    S.log.push({ id: e.id, by: e.by || '', turn: e.turn, who: e.who, kind: e.kind, sector: e.sector || null, text: e.text, n: e.n || 0, ok: !!e.ok, mine: false, at: e.at, remote: true });
    S.log.sort((a, b) => b.at - a.at); save(); if (S.stage === 'game') { paintOverlay(); if (S.tab === 'table') render(); }
  },
  hatches(h) { for (const n of [1, 2, 3, 4]) if (h[n] !== undefined) S.hatches[n] = h[n] ? 1 : 0; if (S.stage === 'game') afterChange(); }
});

{ const q = new URLSearchParams(location.search).get('room'); if (q) { const c = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (S.stage === 'game') { try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ } } else T.pendingRoom = c; } }
loadMaps().then(() => {
  boot();
  if (S.hot) Hot.showPass();
  if (S.room && (S.stage === 'lobby' || S.stage === 'game')) Sync.join(S.room, { name: S.name || t('Player') });
  else if (S.stage === 'lobby') { S.stage = 'welcome'; renderFlow(); }
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });
