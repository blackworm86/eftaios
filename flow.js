'use strict';
/* Pre-game flow: welcome -> (host setup | join) -> lobby -> game.  Solo play skips the table. */
const MODES = { advanced: ['Advanced', 'Items and Escape Hatch cards. Play on until every Human has escaped or died.'], basic: ['Basic', 'No items. The game ends when the first Human reaches a hatch.'], infection: ['Infection', 'Eliminated Humans become Aliens. All hatches open, each works once.'] };
const CARDS = { physical: ['Physical', 'You use the real deck. The app tracks routes and turns.'], online: ['Digital', 'No physical pieces. The app deals roles and cards and resolves items and attacks.'] };
const TRACK = { auto: ['Automatic', 'Announcements of the other players are marked on everyone\'s map automatically.'], manual: ['By hand', 'Like the paper map: each player marks the steps of the others by hand.'] };
const OPTS = { mode: ['Rules', MODES], cards: ['Cards', CARDS], track: ['Tracking', TRACK] };
const tableMaps = () => T.maps.filter(m => m.official);
const isHost = () => Sync.isHost();
const isOnline = () => !!(Sync.settings && Sync.settings.online);
const orderedIds = () => { const ps = Sync.players || {}, ord = (Sync.settings && Sync.settings.order) || []; const l = ord.filter(u => ps[u]); Object.keys(ps).forEach(u => { if (!l.includes(u)) l.push(u); }); return l; };
const orderedPlayers = () => orderedIds().map(u => [u, Sync.players[u]]);
const langSwitch = () => `<div class="lang-switch" role="group" aria-label="Language">${['en', 'it'].map(l => `<button data-act="lang" data-l="${l}" aria-pressed="${LANG === l}">${l.toUpperCase()}</button>`).join('')}</div>`;
const hero = () => `${langSwitch()}<h1>${t('Escape from the')}<br><span class="red">${t('Aliens')}</span> ${t('in Outer Space')}</h1>`;
const BACK_ICO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
/* sub-screens: a compact header with a back button instead of the big title */
const fhead = (title, act = 'back') => `<header class="fhead"><button class="icon-btn" data-act="${act}" aria-label="${t('Back')}">${BACK_ICO}</button><h2>${title}</h2></header>`;
const nameField = () => `<label class="field"><span>${t('Your name')}</span><input id="flow-name" type="text" maxlength="20" autocomplete="off" placeholder="${t('Player')}" value="${esc(S.name || '')}"></label>`;
/* map picker: a preview card; tapping it opens the gallery of every map */
const mapSelect = (list, cur) => {
  T.mapList = list; const m = list.find(x => x.id === cur) || list[0];
  return `<div class="field"><input type="hidden" id="f-map" value="${esc(m.id)}">
    <button type="button" class="mapcard" data-act="mapgallery" aria-haspopup="dialog" aria-label="${t('Map')}: ${esc(m.name)}. ${t('Tap to choose another map')}"><span class="prevbox" id="f-map-prev"></span>
    <span class="mapname"><b id="f-map-name">${esc(m.name)}</b><small id="f-map-desc"></small><i class="chev" aria-hidden="true">${ico('next', 18)}</i></span></button></div>`;
};
const mapInfo = m => [m.author ? t('Map by {a}', { a: m.author }) : '', t('{n} escape hatches', { n: mapHatches(m).length })].filter(Boolean).join(' · ');
function mapGallery() {
  const list = T.mapList || T.maps, cur = ($('#f-map') || {}).value, packs = [];
  list.forEach(m => { const p = m.pack || t('My maps'); if (!packs.includes(p)) packs.push(p); });
  const g = document.createElement('div'); g.id = 'gallery'; g.className = 'gallery'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true');
  g.innerHTML = `<header><h2>${t('Choose a map')}</h2><button class="icon-btn" data-act="gallclose" aria-label="${t('Close')}">${ico('close')}</button></header><div class="gbody">
    ${packs.map(p => `<h3>${esc(p)}</h3><div class="ggrid">${list.filter(m => (m.pack || t('My maps')) === p).map(m => `<button class="gcard" data-act="pickmap" data-id="${esc(m.id)}" aria-pressed="${m.id === cur}">${mapPreview(m)}<b>${esc(m.name)}</b><small>${esc(mapInfo(m))}</small></button>`).join('')}</div>`).join('')}</div>`;
  document.body.appendChild(g);
  const sel = g.querySelector('[aria-pressed=true]'); if (sel) sel.scrollIntoView({ block: 'center' });
}
/* segmented control for one option (rules, cards, tracking); the ⓘ button explains the choices */
const seg = (f, cur) => { const [lbl, set] = OPTS[f]; return `<div class="field"><span class="flabel">${t(lbl)}<button type="button" class="info" data-act="optinfo" data-f="${f}" aria-label="${t('About: {x}', { x: t(lbl) })}">i</button></span>
  <input type="hidden" id="f-${f}" value="${esc(cur)}"><div class="seg" role="radiogroup" aria-label="${t(lbl)}">${Object.entries(set).map(([k, v]) => `<button type="button" role="radio" data-act="seg" data-f="${f}" data-v="${k}" aria-checked="${k === cur}">${t(v[0])}</button>`).join('')}</div></div>`; };
function optInfo(f) {
  const [lbl, set] = OPTS[f];
  dlg.innerHTML = `<h2>${t(lbl)}</h2><dl class="optinfo">${Object.values(set).map(v => `<dt>${t(v[0])}</dt><dd>${t(v[1])}</dd>`).join('')}</dl><div class="row"><button class="btn primary" id="d-no">OK</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
}
const myName = () => (S.name || '').trim() || t('Player');
const readName = () => { const el = $('#flow-name'); if (el) S.name = el.value.trim(); return myName(); };

function renderFlow() {
  const card = $('#flow-card'); let h = '';
  const st = S.stage;
  card.className = 'setup-card' + (st === 'welcome' || !st ? ' home' : '');
  if (st === 'host') {
    h = `${fhead(t('Host a table'))}${nameField()}${mapSelect(tableMaps(), S.mapId || 'galilei')}${seg('mode', S.mode || 'advanced')}${seg('cards', S.cards || 'physical')}${seg('track', S.track || 'auto')}
      <button class="btn primary big wide" data-act="hostcreate">${t('Create table')}</button>${flowStatus()}`;
  } else if (st === 'solo') {
    h = `${fhead(t('Map only'))}${mapSelect(T.maps, S.mapId || 'galilei')}${seg('mode', S.mode || 'advanced')}${seg('track', S.track || 'auto')}
      <fieldset class="roles"><legend>${t('Your Character card')}</legend>
      <button class="role-btn human" data-act="solostart" data-role="human"><b>${t('Human')}</b></button>
      <button class="role-btn alien" data-act="solostart" data-role="alien"><b>${t('Alien')}</b></button></fieldset>`;
  } else if (st === 'hotsetup') {
    const names = T.hotNames || (T.hotNames = [1, 2, 3, 4].map(i => t('Player {n}', { n: i })));
    T.hotBots = T.hotBots || names.map(() => '');
    h = `${fhead(t('Pass and play'))}
      <span class="flabel">${t('Players')} (${names.length}/8)</span><ol class="hotnames seats">${names.map((n, i) => `<li><select data-hb="${i}" aria-label="${t('Who plays seat {n}', { n: i + 1 })}">${BOTSEL.map(([v, l]) => `<option value="${v}"${(T.hotBots[i] || '') === v ? ' selected' : ''}>${t(l)}</option>`).join('')}</select><input type="text" maxlength="20" data-hn="${i}" value="${esc(n)}" aria-label="${t('Player {n}', { n: i + 1 })}">${names.length > 2 ? `<button class="x" data-act="hotdel" data-i="${i}" aria-label="${t('Remove')}">${ico('close', 16)}</button>` : ''}</li>`).join('')}</ol>
      ${names.length < 8 ? `<div class="row two addrow"><button class="btn" data-act="hotadd">+ ${t('Add player')}</button><button class="btn" data-act="hotaddbot">+ ${t('Add bot')}</button></div>` : ''}
      ${T.hotBots.some(Boolean) && T.hotBots.every(Boolean) ? `<p class="dim hintline">${t('At least one seat must be a person.')}</p>` : ''}
      ${mapSelect(T.maps, S.mapId || 'galilei')}${seg('mode', S.mode || 'advanced')}${seg('track', S.track || 'auto')}
      <button class="btn primary big wide" data-act="hotstart">${t('Start game')}</button>`;
  } else if (st === 'lobby') {
    h = lobbyHtml();
  } else {
    h = `${hero()}
      ${T.pendingRoom ? `<p class="banner">${t('You are invited to table {c}.', { c: esc(T.pendingRoom) })}</p>` : ''}${nameField()}
      ${T.pendingRoom ? `<button class="btn primary big wide" data-act="joinroom">${t('Join table {c}', { c: esc(T.pendingRoom) })}</button><button class="btn link wide" data-act="ignoreinvite">${t('Not now')}</button>`
      : `<button class="btn primary big wide" data-act="hostsetup">${t('Host a table')}</button>
        <div class="inline joinrow"><input id="join-code" type="text" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="${t('Table code')}" aria-label="${t('Table code')}"><button class="btn" data-act="joinroom">${t('Join')}</button></div>
        <div class="or"><span>${t('or')}</span></div>
        <div class="row two"><button class="btn" data-act="hotsetup">${t('Pass and play')}<small>${t('One device')}</small></button><button class="btn" data-act="solo">${t('Map only')}<small>${t('No table')}</small></button></div>`}
      ${flowStatus()}`;
  }
  card.innerHTML = h;
  const fm = $('#f-map');
  const upd = () => {
    if (fm && $('#f-map-prev')) { const m = T.maps.find(x => x.id === fm.value); $('#f-map-prev').innerHTML = mapPreview(m); $('#f-map-name').textContent = m ? m.name : ''; $('#f-map-desc').textContent = m ? mapInfo(m) : ''; }
  };
  if (fm) fm.onchange = () => { S.mapId = fm.value; upd(); if (st === 'lobby') Sync.updateSettings({ map: fm.value }); };
  upd();
  const jc = $('#join-code'); if (jc) jc.onkeydown = e => { if (e.key === 'Enter') actions.joinroom(); };
  // a seat switched between person and bot keeps a custom name, but a default name follows the type
  document.querySelectorAll('[data-hb]').forEach(sel => { sel.onchange = () => {
    readHot(); const i = +sel.dataset.hb, n = T.hotNames[i], isDefault = [t('Player {n}', { n: '' }), t('Bot {n}', { n: '' })].some(p => n.startsWith(p) && /\d+$/.test(n));
    if (isDefault) T.hotNames[i] = sel.value ? t('Bot {n}', { n: T.hotBots.slice(0, i + 1).filter(Boolean).length }) : t('Player {n}', { n: i + 1 });
    renderFlow();
  }; });
}
const FLOW_MSG = { connecting: 'Connecting…', error: 'Connection error', 'bad-code': 'Enter the 4-letter code', 'no-room': 'Table not found', started: 'That game has already started', closed: 'The host closed this game.', full: 'This table is full (8 players).' };
function flowStatus() { return FLOW_MSG[Sync.status] ? `<p class="dim" role="status">${t(FLOW_MSG[Sync.status])}${Sync.status === 'error' && Sync.lastError ? ` <code>${esc(Sync.lastError)}</code>` : ''}</p>` : ''; }

function lobbyHtml() {
  const st = Sync.settings || {}, host = isHost(), online = isOnline(), players = orderedPlayers();
  const map = T.maps.find(m => m.id === st.map) || T.maps[0];
  const nReady = players.filter(([, p]) => p.ready).length, allReady = players.length >= 2 && nReady === players.length;
  const rows = players.map(([id, p], i) => `<li class="${p.ready ? 'ok' : ''}"><span class="num">${i + 1}</span><span class="pname">${esc(p.name)}${id === Sync.uid ? ` <em>${t('(you)')}</em>` : ''}${st.host === id ? ` <em class="hostt">${t('Host')}</em>` : ''}</span>
    <span class="pst">${p.ready ? ico('check', 14) + ' ' + t('Ready') : ''}</span>
    ${host ? `<span class="mv"><button data-act="mvup" data-u="${esc(id)}" aria-label="${t('Move up')}" ${i === 0 ? 'disabled' : ''}>${ico('up')}</button><button data-act="mvdown" data-u="${esc(id)}" aria-label="${t('Move down')}" ${i === players.length - 1 ? 'disabled' : ''}>${ico('down')}</button></span>` : ''}</li>`).join('');
  const faction = ['human', 'alien'].map(r => `<button class="role-btn ${r}" data-act="faction" data-r="${r}" aria-pressed="${S.myRole === r}"><b>${t(r === 'human' ? 'Human' : 'Alien')}</b></button>`).join('');
  const canReady = online || S.myRole;
  const kv = `<dl class="kv"><dt>${t('Map')}</dt><dd>${esc(map.name)}</dd><dt>${t('Rules')}</dt><dd>${t(MODES[st.mode || 'advanced'][0])}</dd><dt>${t('Cards')}</dt><dd>${t(CARDS[online ? 'online' : 'physical'][0])}</dd><dt>${t('Tracking')}</dt><dd>${t(TRACK[st.track || 'auto'][0])}</dd></dl>`;
  return `${fhead(t('Table'), 'leavelobby')}
    <div class="roomcard"><div><small>${t('Table code')}</small><b>${esc(Sync.code || S.room || '')}</b><span class="stat-line ${Sync.status}">${t(SYNC_MSG[Sync.status] || 'Online')}</span></div>
      <button class="btn" data-act="qr">${t('QR code')}</button><button class="btn" data-act="share">${t('Share')}</button></div>
    <div class="setcard">${host ? `<input type="hidden" id="f-map" value="${esc(map.id)}"><button type="button" class="mapcard mini" data-act="mapgallery" aria-label="${t('Map')}: ${esc(map.name)}. ${t('Tap to choose another map')}"><span class="prevbox">${mapPreview(map)}</span></button>` : `<span class="prevbox">${mapPreview(map)}</span>`}
      ${kv}${host ? `<button class="btn edit" data-act="lobbyopts">${t('Change')}</button>` : ''}</div>
    <h3>${t('Turn order')} ${host ? `<button class="mini-link" data-act="shuffleorder">${t('Shuffle')}</button>` : ''}</h3>
    <ul class="plist">${rows}</ul>
    ${online ? `<p class="dim hintline">${t('Roles and cards are dealt when the game starts.')}</p>`
      : `<h3>${t('Your faction')} <span class="hint">${t('Draw a Character card in secret')}</span></h3><div class="factions" role="group" aria-label="${t('Your faction')}">${faction}</div>`}
    <div class="row lobbyact"><button class="btn big ${S.ready ? 'ok' : host ? '' : 'primary'}" data-act="ready" ${canReady ? '' : 'disabled'}>${S.ready ? ico('check') + ' ' + t('Ready') : t("I'm ready")}</button>
    ${host ? `<button class="btn primary big startbtn" data-act="startgame" ${allReady ? '' : 'disabled'}>${t('Start game')}<small>${t('{n}/{m} ready', { n: nReady, m: players.length })}</small></button>` : ''}</div>
    ${!host && S.ready ? `<p class="dim hintline center">${t('Waiting for the host to start the game…')}</p>` : ''}`;
}
/* host: change rules, cards and tracking from the lobby */
function lobbyOpts() {
  const st = Sync.settings || {};
  dlg.innerHTML = `<h2>${t('Game options')}</h2>${seg('mode', st.mode || 'advanced')}${seg('cards', st.online ? 'online' : 'physical')}${seg('track', st.track || 'auto')}<div class="row"><button class="btn primary" id="d-no">${t('Done')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = closeDlg;
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
  S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, mode: st.mode, track: st.track || 'auto', role, char, online: !!st.online, name, room, customMaps: keep, tab: 'play' });
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
  const keep = S.customMaps, name = readName(), mode = $('#f-mode').value, track = $('#f-track').value;
  S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, role, name: name === t('Player') ? '' : name, mode, track, customMaps: keep });
  S.pos = find(T.map, role === 'human' ? 'H' : 'A');
  if (!S.pos) { alert(t('This map has no start sector for your role.')); S.stage = 'solo'; S.role = null; return; }
  S.path = [{ turn: 0, pos: S.pos }]; save(); boot();
}

const BOTSEL = [['', 'Person'], ['easy', 'Bot · Easy'], ['normal', 'Bot · Normal'], ['hard', 'Bot · Hard']];
function readHot() { document.querySelectorAll('[data-hn]').forEach(el => { T.hotNames[+el.dataset.hn] = el.value; }); document.querySelectorAll('[data-hb]').forEach(el => { T.hotBots[+el.dataset.hb] = el.value; }); }
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
  mapgallery() { mapGallery(); },
  optinfo(b) { const open = dlg.open && dlg.querySelector('.seg'); optInfo(b.dataset.f); if (open) $('#d-no').onclick = lobbyOpts; },
  lobbyopts() { lobbyOpts(); },
  seg(b) {
    const f = b.dataset.f, v = b.dataset.v, inp = document.getElementById('f-' + f);
    b.parentNode.querySelectorAll('[role=radio]').forEach(x => x.setAttribute('aria-checked', x === b));
    if (inp) inp.value = v;
    if (S.stage === 'lobby' && isHost()) Sync.updateSettings(f === 'cards' ? { online: v === 'online' } : { [f]: v });
    else S[f] = v;
  },
  gallclose() { const g = $('#gallery'); if (g) g.remove(); },
  pickmap(b) { const fm = $('#f-map'); if (fm) { fm.value = b.dataset.id; if (fm.onchange) fm.onchange(); } actions.gallclose(); },
  hostsetup() { readName(); S.stage = 'host'; save(); renderFlow(); },
  hotsetup() { S.stage = 'hotsetup'; save(); renderFlow(); },
  hotadd() { readHot(); if (T.hotNames.length < 8) { T.hotNames.push(t('Player {n}', { n: T.hotNames.length + 1 })); T.hotBots.push(''); } renderFlow(); },
  hotaddbot() { readHot(); if (T.hotNames.length < 8) { T.hotNames.push(t('Bot {n}', { n: T.hotBots.filter(Boolean).length + 1 })); T.hotBots.push('normal'); } renderFlow(); },
  hotdel(b) { readHot(); T.hotNames.splice(+b.dataset.i, 1); T.hotBots.splice(+b.dataset.i, 1); renderFlow(); },
  hotstart() {
    readHot(); if (T.hotBots.every(Boolean)) { toast(t('At least one seat must be a person.')); return; }
    const names = T.hotNames.map((n, i) => n.trim().slice(0, 20) || t('Player {n}', { n: i + 1 }));
    Hot.start(names, $('#f-map').value, $('#f-mode').value, $('#f-track').value, T.hotBots.slice());
  },
  solo() { S.stage = 'solo'; save(); renderFlow(); },
  back() { S.stage = 'welcome'; Sync.status = 'off'; save(); renderFlow(); },
  ignoreinvite() { T.pendingRoom = null; try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ } renderFlow(); },
  async hostcreate() {
    const name = readName(); S.mapId = $('#f-map').value; S.mode = $('#f-mode').value; S.cards = $('#f-cards').value; S.track = $('#f-track').value;
    const ok = await Sync.create({ map: S.mapId, mode: S.mode, online: S.cards === 'online', track: S.track }, { name });
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
