'use strict';
/* Pre-game flow: welcome -> (host setup | join) -> lobby -> game.  Solo play skips the table. */
const MODES = { basic: ['Basic', 'First game: no Items and no Character abilities. Item cards count as Silence.'], ultimate: ['Ultimate', 'The complete rules: Items, Character abilities and Escape Pod cards.'] };
const modeOf = m => (m === 'basic' ? 'basic' : 'ultimate');
const VIS = { private: ['Private', 'Only people with the code or the QR code can join.'], friends: ['Friends', 'Your friends get an invitation as soon as the game is created.'], public: ['Public', 'Listed in the Online lobby for anyone to join.'] };
const MAXP = Object.fromEntries([2, 3, 4, 5, 6, 7, 8].map(n => [String(n), [String(n), 'The game is full at ' + n + ' players.']]));
const FILL = { '': ['Off', 'Only the people who joined play.'], easy: ['Easy', 'Empty seats are filled with Easy bots when the game starts.'], normal: ['Normal', 'Empty seats are filled with Normal bots when the game starts.'], hard: ['Hard', 'Empty seats are filled with Hard bots when the game starts.'] };
const OPTS = { mode: ['Rules', MODES], vis: ['Who can join', VIS], max: ['Players', MAXP], fill: ['Fill empty seats with bots', FILL] };
/* online tables can use any map, your own included: the host sends a custom map's rows along with the table settings */
const tableMaps = () => T.maps.filter(m => !m.shared);
const encMap = m => { const s = JSON.stringify({ n: m.name, o: m.odd ? 1 : 0, c: m.cols, r: m.grid.map(r => r.join('')).join('') }); return s.length <= 700 ? s : null; };
const isCustomMap = m => (S.customMaps || []).some(c => c.id === m.id);
/* what to store in the table settings when the host picks map m */
const mapPatch = m => ({ map: m.id, customMap: m && isCustomMap(m) ? encMap(m) : null });
/* the map of a table: one of ours, or the custom map the host sent (kept for this game only) */
function tableMapOf(st) {
  const have = T.maps.find(m => m.id === st.map); if (have) return have;
  if (st.customMap) {
    try {
      const j = JSON.parse(st.customMap), rows = []; for (let i = 0; i < j.r.length; i += j.c) rows.push(j.r.slice(i, i + j.c));
      const rec = { id: st.map, name: j.n, rows_data: rows, oddColumnsLower: !!j.o }, m = parseMap(rec); m.shared = true; m.rec = rec;
      T.maps.push(m); return m;
    } catch (e) { console.warn('Bad shared map', e); }
  }
  return T.maps[0];
}
const isHost = () => Sync.isHost();
const orderedIds = () => { const ps = Sync.players || {}, ord = (Sync.settings && Sync.settings.order) || []; const l = ord.filter(u => ps[u]); Object.keys(ps).forEach(u => { if (!l.includes(u)) l.push(u); }); return l; };
const orderedPlayers = () => orderedIds().map(u => [u, Sync.players[u]]);
const langSwitch = () => `<div class="lang-switch" role="group" aria-label="Language">${['en', 'it'].map(l => `<button data-act="lang" data-l="${l}" aria-pressed="${LANG === l}">${l.toUpperCase()}</button>`).join('')}</div>`;
/* the top of the home screen: a small account chip on the left, the language on the right */
const homeTop = () => `<div class="toprow">${Auth.chip()}${langSwitch()}</div>`;
const hero = () => `${langSwitch()}<h1>${t('Escape from the')}<br><span class="red">${t('Aliens')}</span> ${t('in Outer Space')}</h1>`;
const QR_ICO = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9V6a2 2 0 012-2h3M20 9V6a2 2 0 00-2-2h-3M4 15v3a2 2 0 002 2h3M20 15v3a2 2 0 01-2 2h-3"/><rect x="8" y="8" width="3" height="3"/><rect x="13" y="8" width="3" height="3"/><rect x="8" y="13" width="3" height="3"/><path d="M13.5 14.5h2.5v1.5"/></svg>';
const BACK_ICO = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
/* sub-screens: a compact header with a back button instead of the big title */
const fhead = (title, act = 'back') => `<header class="fhead"><button class="icon-btn" data-act="${act}" aria-label="${t('Back')}">${BACK_ICO}</button><h2>${title}</h2></header>`;
const nameField = () => `<label class="field"><span>${t('Your name')}</span><input id="flow-name" type="text" maxlength="20" autocomplete="off" placeholder="${t('Player')}" value="${esc(S.name || '')}"></label>`;
/* map picker: a preview card; tapping it opens the gallery of every map */
const mapSelect = (list, cur) => {
  T.mapList = list; const m = list.find(x => x.id === cur) || list[0];
  return `<div class="field"><input type="hidden" id="f-map" value="${esc(m.id)}">
    <button type="button" class="mapcard" data-act="mapgallery" aria-haspopup="dialog" aria-label="${t('Map')}: ${esc(m.name)}. ${t('Tap to choose another map')}"><span class="prevbox" id="f-map-prev"></span>
    <span class="mapname"><b id="f-map-name">${esc(m.name)}</b><small id="f-map-desc"></small><small id="f-map-text" class="mdesc"></small><i class="chev" aria-hidden="true">${ico('next', 18)}</i></span></button></div>`;
};
const mapInfo = m => [m.players ? t('{n} players', { n: m.players }) : '', m.difficulty ? t(m.difficulty) : '', m.author ? t('Map by {a}', { a: m.author }) : '', t('{n} escape pods', { n: mapHatches(m).length })].filter(Boolean).join(' · ');
function mapGallery() {
  const list = T.mapList || T.maps, cur = ($('#f-map') || {}).value, packs = [];
  list.forEach(m => { const p = m.pack || t('My maps'); if (!packs.includes(p)) packs.push(p); });
  const g = document.createElement('div'); g.id = 'gallery'; g.className = 'gallery'; g.setAttribute('role', 'dialog'); g.setAttribute('aria-modal', 'true');
  g.innerHTML = `<header><h2>${t('Choose a map')}</h2><button class="icon-btn" data-act="gallclose" aria-label="${t('Close')}">${ico('close')}</button></header><div class="gbody">
    ${packs.map(p => `<h3>${esc(t(p))}</h3><div class="ggrid">${list.filter(m => (m.pack || t('My maps')) === p).map(m => `<button class="gcard" data-act="pickmap" data-id="${esc(m.id)}" aria-pressed="${m.id === cur}">${mapPreview(m)}<b>${esc(m.name)}</b><small>${esc(mapInfo(m))}</small></button>`).join('')}</div>`).join('')}</div>`;
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
const myName = () => (Sync.registered && Sync.profile && Sync.profile.name) || (S.name || '').trim() || t('Player');
const readName = () => { const el = $('#flow-name'); if (el) S.name = el.value.trim(); return myName(); };

function renderFlow() {
  const card = $('#flow-card'); let h = '';
  if (S.stage === 'auth' && window.Sync && Sync.preloadSignIn) Sync.preloadSignIn();   // so the Google window opens on the first tap, even on Safari
  const st = S.stage;
  if ((!st || st === 'welcome') && Sync.registered && Sync.watchInbox) Sync.watchInbox();
  const ver = document.getElementById('ver'); if (ver) ver.hidden = true;   // the version shows at the foot of the Library tab
  const tab = TAB_OF[st || 'welcome'];
  card.className = 'setup-card' + (tab ? ' top tab' : ['stats', 'account'].includes(st) ? ' top' : '') + (st === 'admin' && T.adminTab === 'games' ? ' wide' : '');
  if (st === 'host') {
    h = `${fhead(t('Create a game'))}${Sync.registered ? '' : nameField()}${seg('vis', ['public', 'friends'].includes(S.vis) ? S.vis : 'private')}${mapSelect(tableMaps(), S.mapId || 'galilei')}${seg('mode', modeOf(S.mode))}${seg('max', String(S.max || 8))}${seg('fill', S.fill || '')}
      <button class="btn primary big wide" data-act="hostcreate">${t('Create game')}</button>${flowStatus()}`;
  } else if (st === 'solo') {
    h = `${fhead(t('Companion'))}<p class="dim hintline">${t('Use the app like the paper sheet: track your own route and what the other players declare. You play with the real cards.')}</p>${mapSelect(T.maps, S.mapId || 'galilei')}${seg('mode', modeOf(S.mode))}
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
      ${mapSelect(T.maps, S.mapId || 'galilei')}${seg('mode', modeOf(S.mode))}
      <button class="btn primary big wide" data-act="hotstart">${t('Start game')}</button>`;
  } else if (st === 'auth' || st === 'account' || st === 'stats' || st === 'admin') {
    h = (st === 'admin' && window.Admin) ? Admin.html() : Auth.html();
  } else if (st === 'games' || st === 'browse') {
    h = gamesTabHtml();
  } else if (st === 'friends') {
    h = friendsHtml();
  } else if (st === 'library') {
    h = libraryHtml();
  } else if (st === 'lobby') {
    h = lobbyHtml();
  } else {
    h = playHtml();
  }
  card.innerHTML = h;
  const bar = $('#tabbar'); if (bar) { bar.hidden = !tab; if (tab) bar.innerHTML = tabbarHtml(tab); } $('#flow').classList.toggle('hasnav', !!tab);
  const fm = $('#f-map');
  const upd = () => {
    if (fm && $('#f-map-prev')) { const m = T.maps.find(x => x.id === fm.value); $('#f-map-prev').innerHTML = mapPreview(m); $('#f-map-name').textContent = m ? m.name : ''; $('#f-map-desc').textContent = m ? mapInfo(m) : ''; $('#f-map-text').textContent = m && m.description ? t(m.description) : ''; }
  };
  if (fm) fm.onchange = () => { S.mapId = fm.value; upd(); if (st === 'lobby') { const m = T.maps.find(x => x.id === fm.value); if (m && isCustomMap(m) && !encMap(m)) { toast(t('This map is too large for an online game.')); return; } Sync.updateSettings(mapPatch(m)); } };
  upd();
  const jc = $('#join-code'); if (jc) jc.onkeydown = e => { if (e.key === 'Enter') actions.joinroom(); };
  document.querySelectorAll('[data-botlvl]').forEach(sel => { sel.onchange = () => Sync.upd('players/' + sel.dataset.botlvl, { bot: sel.value }).catch(() => {}); });
  // a seat switched between person and bot keeps a custom name, but a default name follows the type
  document.querySelectorAll('[data-hb]').forEach(sel => { sel.onchange = () => {
    readHot(); const i = +sel.dataset.hb, n = T.hotNames[i], isDefault = [t('Player {n}', { n: '' }), t('Bot {n}', { n: '' })].some(p => n.startsWith(p) && /\d+$/.test(n));
    if (isDefault) T.hotNames[i] = sel.value ? t('Bot {n}', { n: T.hotBots.slice(0, i + 1).filter(Boolean).length }) : t('Player {n}', { n: i + 1 });
    renderFlow();
  }; });
}
const FLOW_MSG = { connecting: 'Connecting…', error: 'Connection error', 'bad-code': 'Enter the 4-letter code', 'no-room': 'Game not found', started: 'That game has already started', closed: 'The host closed this game.', full: 'This game is full (8 players).' };
function flowStatus() { return FLOW_MSG[Sync.status] ? `<p class="dim" role="status">${t(FLOW_MSG[Sync.status])}${Sync.status === 'error' && Sync.lastError ? ` <code>${esc(Sync.lastError)}</code>` : ''}</p>` : ''; }

/* friends: invitations on the home screen, the friends list, adding by handle, inviting from the game page */
const inbox = () => Sync.inbox || { invites: [], requests: 0 };
function inviteCards() {
  return inbox().invites.slice(0, 2).map(i => `<div class="livecard"><div class="top"><b>${t('{n} invites you to a game', { n: esc(i.name) })}</b></div><small>${esc(i.map || '')} · ${t('Game {c}', { c: esc(i.code) })}</small><div class="row two"><button class="btn primary" data-act="joininvite" data-c="${esc(i.code)}" data-f="${esc(i.from)}">${t('Join')}</button><button class="btn" data-act="skipinvite" data-f="${esc(i.from)}">${t('Not now')}</button></div></div>`).join('');
}
const FRIEND_MSG = { bad: 'Handles have 3–16 letters, numbers or _.', nouser: 'Nobody has that handle.', self: 'That is you.', guest: 'Sign in to add friends.', sent: 'Request sent.', friends: 'You are friends now.' };
function friendsHtml() {
  if (T.friendList === undefined && !T.friendLoading) { T.friendLoading = true; Sync.friends().then(l => { T.friendList = l; }).catch(() => { T.friendList = { friends: [], requests: [] }; }).then(() => { T.friendLoading = false; if (S.stage === 'friends') renderFlow(); }); }
  const L = T.friendList;
  const body = !L ? `<p class="dim">${t('Loading…')}</p>` : `
    ${L.requests.length ? `<h3>${t('Requests')}</h3><ul class="plist glist">${L.requests.map(r => `<li class="grow"><span class="pname">@${esc(r.handle)}<small>${esc(r.name || '')}</small></span><button class="btn primary" data-act="friendok" data-u="${esc(r.uid)}" data-h="${esc(r.handle)}">${t('Accept')}</button><button class="x" data-act="friendno" data-u="${esc(r.uid)}" aria-label="${t('Decline')}">${ico('close', 16)}</button></li>`).join('')}</ul>` : ''}
    ${L.requests.length ? `<h3>${t('Friends')}</h3>` : ''}${L.friends.length ? `<ul class="plist glist">${L.friends.map(f => `<li class="grow"><span class="pname">@${esc(f.handle)}<small>${f.mutual ? t('Friends') : t('Waiting for them to accept')}</small></span><button class="x" data-act="friendrm" data-u="${esc(f.uid)}" aria-label="${t('Remove')}">${ico('close', 16)}</button></li>`).join('')}</ul>` : `<p class="dim hintline">${t('No friends yet. Add one by their handle.')}</p>`}`;
  return `${tabTop(t('Friends'))}${inviteCards()}
    <div class="inline joinrow"><input id="friend-handle" type="text" maxlength="17" autocapitalize="off" autocomplete="off" placeholder="${t('Friend handle')}" aria-label="${t('Friend handle')}"><button class="btn primary" data-act="friendadd">${t('Add')}</button></div>
    ${T.friendMsg ? `<p class="dim hintline" role="status">${t(T.friendMsg)}</p>` : ''}${body}`;
}
/* a game made for friends: every friend gets the invitation at once */
async function inviteAllFriends() {
  try { const L = await Sync.friends(), map = tableMapOf(Sync.settings || {}).name; await Promise.all(L.friends.filter(f => f.mutual).map(f => Sync.invite(f.uid, Sync.code, map).then(() => { (T.invited = T.invited || {})[f.uid] = 1; }))); } catch (_) { /* invitations are a courtesy */ }
}
/* host, in the game page: pick friends to invite */
async function inviteDlg() {
  const L = await Sync.friends(), ok = L.friends.filter(f => f.mutual), sent = T.invited || (T.invited = {});
  dlg.innerHTML = `<h2>${t('Invite a friend')}</h2>${ok.length ? `<ul class="plist">${ok.map(f => `<li class="grow"><span class="pname">@${esc(f.handle)}</span><button class="btn${sent[f.uid] ? '' : ' primary'}" data-act="sendinvite" data-u="${esc(f.uid)}" ${sent[f.uid] ? 'disabled' : ''}>${sent[f.uid] ? t('Invited') : t('Invite')}</button></li>`).join('')}</ul>` : `<p class="dim">${t('No friends yet. Add one by their handle.')}</p>`}<div class="row"><button class="btn" id="d-no">${t('Close')}</button></div>`;
  if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg;
}
/* ---- the four tabs: Play, Friends, Games, Library (a bottom bar on a phone, a rail on a wide screen) ---- */
const TAB_OF = { welcome: 'play', friends: 'friends', games: 'games', browse: 'games', library: 'library' };
const tabTop = title => `${homeTop()}${title ? `<h2 class="tabtitle">${title}</h2>` : ''}`;
function tabbarHtml(on) {
  const n = inbox().requests + inbox().invites.length;
  const item = (k, ic, label, act) => `<button role="tab" data-act="${act}" aria-selected="${on === k}" class="${on === k ? 'on' : ''}"><span class="ti">${ico(ic, 24)}${k === 'friends' && n ? `<em class="nb" aria-label="${n}">${n}</em>` : ''}</span><span class="tl">${t(label)}</span></button>`;
  return `<b class="brand" aria-hidden="true">${t('Escape from the')} <em>${t('Aliens')}</em></b>` + item('play', 'play', 'Play', 'home') + item('friends', 'friends', 'Friends', 'friends') + item('games', 'stack', 'Games', 'accountgames') + item('library', 'book', 'Library', 'library');
}
const AMBER = '#ffb41f', BLUE = '#2f7dff', GREEN = '#1e8a4f', SLATE = '#59627a';
const CHEV = `<span class="chev" aria-hidden="true">${ico('next', 18)}</span>`;
const rowBtn = (act, icon, col, title, sub, ink) => `<button class="rowbtn" data-act="${act}">${hexBadge(icon, col, 44, ink || '#fff')}<span class="t"><b>${title}</b><small>${sub}</small></span>${CHEV}</button>`;
function playHtml() {
  const pending = T.pendingRoom;
  return `${tabTop('')}${pending ? '' : inviteCards() + Auth.continueCard()}
    ${pending ? `<p class="banner">${t('You are invited to game {c}.', { c: esc(pending) })}</p>` : ''}${Sync.registered ? '' : nameField()}
    ${pending
      ? `<div class="wacts"><button class="btn primary big wide" data-act="joinroom">${t('Join game {c}', { c: esc(pending) })}</button><button class="btn link wide" data-act="ignoreinvite">${t('Not now')}</button></div>`
      : `<button class="herobtn" data-act="quickmatch">${hexBadge('bolt', '#1a1200', 52, AMBER)}<span class="t"><b>${t('Quick match')}</b><small>${t('Join the fullest open game')}</small></span></button>
        ${rowBtn('hostsetup', 'plus', AMBER, t('Create a game'), t(Sync.registered ? 'Private, friends or public' : 'Account required'), '#1a1200')}
        <div class="inline joinrow"><input id="join-code" type="text" maxlength="8" autocapitalize="characters" autocomplete="off" placeholder="${t('Game code')}" aria-label="${t('Game code')}"><button class="btn" data-act="joinroom">${t('Join')}</button><button class="btn scanbtn" data-act="scanqr" aria-label="${t('Scan a game QR code')}">${QR_ICO}</button></div>
        <h3 class="slabel">${t('On this device')}</h3>
        <div class="minis"><button class="minibtn" data-act="hotsetup">${hexBadge('swap', SLATE, 38)}<b>${t('Pass and play')}</b></button><button class="minibtn" data-act="solo">${hexBadge('sheet', SLATE, 38)}<b>${t('Companion')}</b></button></div>`}
    ${flowStatus()}`;
}
function gamesTabHtml() {
  const open = T.gamesView === 'open';
  return `${tabTop(t('Games'))}<div class="seg2" role="tablist"><button role="tab" data-act="accountgames" aria-selected="${!open}">${t('My games')}</button><button role="tab" data-act="browse" aria-selected="${open}">${t('Open games')}</button></div>${open ? browseBody() : Auth.gamesBody()}`;
}
function libraryHtml() {
  if (Sync.registered && T.libStats === undefined && !T.libLoading) { T.libLoading = true; Sync.readStats().then(s => { T.libStats = s || {}; }).catch(() => { T.libStats = {}; }).then(() => { T.libLoading = false; if (S.stage === 'library') renderFlow(); }); }
  const s = T.libStats, pc = (n, d) => d ? Math.round(n / d * 100) + '%' : '–', card = (l, v) => `<div class="stc"><b>${v}</b><span>${l}</span></div>`;
  const ver = (document.getElementById('ver') || {}).textContent || '';
  return `${tabTop(t('Library'))}
    ${Sync.registered && s && s.games > 0 ? `<h3 class="slabel">${t('Your numbers')}</h3><div class="stgrid">${card(t('Games'), s.games)}${card(t('Win rate'), pc(s.wins || 0, s.games))}${card(t('Best win streak'), s.bestStreak || 0)}</div>` : ''}
    <h3 class="slabel">${t('Browse')}</h3>
    ${Sync.registered ? rowBtn('accountstats', 'chart', GREEN, t('Statistics'), t('By role, Character and map')) : ''}${rowBtn('maps_', 'map', GREEN, t('Maps'), t('Browse, create, publish'))}${rowBtn('rules', 'book', GREEN, t('How to play'), t('The rules in short'))}
    <h3 class="slabel">${t('Account')}</h3>
    ${rowBtn('account', 'user', SLATE, t(Sync.registered ? 'Your account' : 'Sign in'), t(Sync.registered ? 'Name, sharing, sign out' : 'Keep your games and statistics'))}
    ${ver ? `<p class="verline">${esc(ver)}</p>` : ''}`;
}
/* the Online lobby: public games that are gathering players right now */
function browseBody() {
  if (T.pubList === undefined && !T.pubLoading) { T.pubLoading = true; Sync.browse().then(l => { T.pubList = l; }).catch(() => { T.pubList = []; }).then(() => { T.pubLoading = false; if (S.stage === 'games' || S.stage === 'browse') renderFlow(); }); }
  const list = T.pubList, mapName = id => { const m = (T.maps || []).find(x => x.id === id); return m ? m.name : id; };
  const rows = (list || []).map(([code, g]) => `<li class="grow"><span class="pname">${esc(mapName(g.map))}<small>${esc(g.name || '')} · ${t(MODES[modeOf(g.mode)][0])} · ${g.n}/${g.max}</small></span><button class="btn primary" data-act="joinpub" data-c="${esc(code)}">${t('Join')}</button></li>`).join('');
  return `${Sync.registered ? '' : nameField()}
    ${list === undefined || T.pubLoading ? `<p class="dim">${t('Loading…')}</p>` : list.length ? `<ul class="plist glist">${rows}</ul>` : `<p class="dim hintline">${t('No open games right now. Create one and make it Public.')}</p>`}
    <div class="row two"><button class="btn" data-act="browse">${t('Refresh')}</button><button class="btn" data-act="hostsetup">${t('Create a game')}</button></div>${flowStatus()}`;
}
function lobbyHtml() {
  const st = Sync.settings || {}, host = isHost(), players = orderedPlayers();
  const map = tableMapOf(st);
  const nReady = players.filter(([, p]) => p.ready || p.bot).length, allReady = (players.length >= 2 || !!st.fill) && nReady === players.length;
  const rows = players.map(([id, p], i) => `<li class="${p.ready ? 'ok' : ''}"><span class="num">${i + 1}</span><span class="pname">${esc(p.name)}${id === Sync.uid ? ` <em>${t('(you)')}</em>` : ''}${st.host === id ? ` <em class="hostt">${t('Host')}</em>` : ''}</span>${host && !p.bot && id !== Sync.uid ? `<button class="mini-link" data-act="makehost" data-u="${esc(id)}">${t('Make host')}</button>` : ''}
    <span class="ctl"><span class="pst">${p.bot ? (host ? `<select data-botlvl="${esc(id)}" aria-label="${t('Bot level')}">${[['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']].map(([v, l]) => `<option value="${v}"${p.bot === v ? ' selected' : ''}>${t(l)}</option>`).join('')}</select>` : t(BOTSEL.find(x => x[0] === p.bot)[1])) : p.ready ? ico('check', 14) + ' ' + t('Ready') : ''}</span>
    ${host && p.bot ? `<button class="x" data-act="delbot" data-u="${esc(id)}" aria-label="${t('Remove')}">${ico('close', 16)}</button>` : ''}
    ${host ? `<span class="mv"><button data-act="mvup" data-u="${esc(id)}" aria-label="${t('Move up')}" ${i === 0 ? 'disabled' : ''}>${ico('up')}</button><button data-act="mvdown" data-u="${esc(id)}" aria-label="${t('Move down')}" ${i === players.length - 1 ? 'disabled' : ''}>${ico('down')}</button></span>` : ''}</span></li>`).join('');
  const kv = `<dl class="kv"><dt>${t('Map')}</dt><dd>${esc(map.name)}</dd><dt>${t('Rules')}</dt><dd>${t(MODES[modeOf(st.mode)][0])}</dd><dt>${t('Who can join')}</dt><dd>${t(st.pub ? 'Public' : 'Private')}</dd><dt>${t('Seats')}</dt><dd>${t(st.shuffle ? 'Drawn at the start' : 'In this order')}</dd>${st.fill ? `<dt>${t('Bots')}</dt><dd>${t('Fill to {n} players', { n: st.max || 8 })} · ${t(FILL[st.fill][0])}</dd>` : ''}</dl>`;
  const lvl = S.botLevel || 'normal', canBot = host && players.length < (st.max || 8);
  const levels = [['easy', 'Easy'], ['normal', 'Normal'], ['hard', 'Hard']];
  return `${fhead(t('Game'), 'leavelobby')}
    <div class="steps"><b class="on">1 · ${t('Gathering')}</b><b>2 · ${t('Playing')}</b><b>3 · ${t('Result')}</b></div>
    <div class="roomcard"><div class="rc-top"><div><small>${t('Game code')}</small><b>${esc(Sync.code || S.room || '')}</b></div><span class="stat-line ${Sync.status}">${t(SYNC_MSG[Sync.status] || 'Online')}</span></div>
      <div class="row"><button class="btn" data-act="qr">${t('QR code')}</button><button class="btn" data-act="share">${t('Share')}</button>${host && Sync.registered ? `<button class="btn" data-act="invitefriend">${t('Invite')}</button>` : ''}</div></div>
    <div class="setcard">${host ? `<input type="hidden" id="f-map" value="${esc(map.id)}"><button type="button" class="mapcard mini" data-act="mapgallery" aria-label="${t('Map')}: ${esc(map.name)}. ${t('Tap to choose another map')}"><span class="prevbox">${mapPreview(map)}</span></button>` : `<span class="prevbox">${mapPreview(map)}</span>`}
      ${kv}${host ? `<button class="btn edit" data-act="lobbyopts" aria-label="${t('Game options')}">${ico('pencil', 20)}</button>` : ''}</div>
    <h3>${t('Players')} ${players.length}/${st.max || 8}</h3>
    <ul class="plist">${rows}</ul>
    ${host ? `${canBot ? `<div class="botbar"><div class="seg" role="radiogroup" aria-label="${t('Bot level')}">${levels.map(([v, l]) => `<button role="radio" data-act="botlevel" data-v="${v}" aria-checked="${lvl === v}">${t(l)}</button>`).join('')}</div><button class="btn" data-act="addlobbybot">+ ${t('Add bot')}</button></div>` : ''}
      ${segRow('Shuffle seats at start', 'shuffleopt', 'v', st.shuffle ? 'on' : 'off', [['on', t('On')], ['off', t('Off')]])}` : ''}
    <p class="dim hintline lobbyhint">${t('Roles and cards are dealt when the game starts.')}</p>
    <div class="row lobbyact"><button class="btn big ${S.ready ? 'ok' : host ? '' : 'primary'}" data-act="ready">${S.ready ? ico('check') + ' ' + t('Ready') : t("I'm ready")}</button>
    ${host ? `<button class="btn primary big startbtn" data-act="startgame" ${allReady ? '' : 'disabled'}>${t('Start game')}<small>${t('{n}/{m} ready', { n: nReady, m: players.length })}</small></button>` : ''}</div>
    ${host ? `<button class="btn link wide" data-act="closetable">${t('Cancel game')}</button>` : ''}
    ${!host && S.ready ? `<p class="dim hintline center">${t('Waiting for the host to start the game…')}</p>` : ''}`;
}
/* the database refused a write: almost always rules that were not published again after an update */
function rulesError(e) {
  const code = String(e && (e.code || e.message) || e);
  if (!/permission/i.test(code)) { toast(t('Connection error') + ' ' + code.slice(0, 40)); return; }
  dlg.innerHTML = `<h2>${t('Update the database rules')}</h2><p>${t('This version of the app needs new database rules. Open the rules page, copy them and publish them in the Firebase console, then try again.')}</p>
    <div class="row"><button class="btn" id="d-no">${t('Close')}</button><a class="btn primary" href="firebase-rules.html" target="_blank" rel="noopener">${t('Open the rules page')}</a></div>`;
  if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg;
}
/* host: change the rules from the lobby */
function lobbyOpts() {
  const st = Sync.settings || {};
  dlg.innerHTML = `<h2>${t('Game options')}</h2>${seg('mode', modeOf(st.mode))}
    <label class="field"><span>${t('Idle player timeout (minutes, 0 = off)')}</span><input id="l-auto" type="number" min="0" max="60" value="${st.autoKick || 0}"></label>
    <div class="row"><button class="btn primary" id="d-no">${t('Done')}</button></div>`;
  dlg.showModal(); $('#d-no').onclick = () => { const v = Math.max(0, Math.min(60, +($('#l-auto').value || 0))); closeDlg(); Sync.updateSettings({ autoKick: v }); };
}

async function beginGame() {
  const st = Sync.settings; if (!st || S.stage !== 'lobby' || T.beginning || T.resuming) return;
  T.beginning = true;
  let role = null, char = '';
  { const sec = await Sync.get('secret/' + Sync.uid); if (sec) { role = sec.role; char = sec.char || ''; } else role = null; }
  T.beginning = false;
  if (!role) { toast(t('The game started without you. Ask the host.')); leaveToWelcome(); return; }
  if (!S.ready) { toast(t('This game is already running, but this device has no saved game for it. Reopen it from My games on the device that played it.')); leaveToWelcome(); return; }
  T.map = tableMapOf(st);
  const keep = S.customMaps, name = S.name, room = S.room, shared = T.map.shared ? T.map.rec : null;
  S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, mode: st.mode, track: 'auto', role, char, online: true, name, room, customMaps: keep, sharedMap: shared, tab: 'play' });
  S.pos = startSector(T.map, role, char, st.mode); S.path = [{ turn: 0, pos: S.pos }];
  T.turnState = Sync.turn || null; if (T.turnState) S.turn = T.turnState.n;
  save(); flushSeat(); boot();
  if (typeof Online !== 'undefined') Online.attach();
  roleDlg();
  if (st.first) dlg.querySelector('.row').insertAdjacentHTML('beforebegin', `<p><b>${t('The game begins!')}</b> ${esc(t('First player: {p}.', { p: st.first }))}</p>`);
  if (T.turnState && T.turnState.uid === Sync.uid) startMyTurn(true);
}
/* the host started another game at this table: keep the seat, drop the last game's state */
function backToLobby() {
  const keep = { customMaps: S.customMaps, name: S.name, mapId: S.mapId, mode: S.mode, cards: S.cards, room: S.room };
  S = Object.assign(fresh(), keep, { stage: 'lobby' });
  T.turnState = null; T.counts = null; T.pick = null; T.showAnn = false; T.sel = null;
  if (typeof Online !== 'undefined') Online.reset();
  closeDlg(); Sync.resetMine().finally(renderFlow); save(); boot();
  toast(t('Back in the lobby. Tap ready for the next game.'));
}
function leaveToWelcome() { T.homeGames = undefined; T.maps = T.maps.filter(m => !m.shared); Sync.leave(); S.room = null; S.stage = 'welcome'; S.ready = false; save(); renderFlow(); }

function soloStart(role) {
  const id = $('#f-map').value; T.map = T.maps.find(m => m.id === id) || T.maps[0];
  const keep = S.customMaps, name = readName(), mode = $('#f-mode').value;
  S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, role, name: name === t('Player') ? '' : name, mode, track: 'manual', customMaps: keep });
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
/* the host starts: with "fill empty seats" on, bots take every free seat up to the number of players first */
async function startTable() {
  const st = Sync.settings || {}, fill = st.fill, ps = orderedPlayers(); if ((ps.length < 2 && !fill) || !ps.every(([, p]) => p.ready)) return;
  const order = ps.map(([u]) => u), first = ps[0][1].name;
  if (fill) {
    const used = new Set(ps.map(([, p]) => p.name)); let n = 1;
    while (order.length < (st.max || 8)) {
      while (used.has(t('Bot {n}', { n }))) n++;
      const id = 'bot_' + Math.random().toString(36).slice(2, 8), name = t('Bot {n}', { n }); used.add(name); order.push(id);
      await Sync.set('players/' + id, { name, ready: true, bot: fill }).catch(rulesError);
    }
    if (order.length < 2) return;
    for (let i = 0; i < 40 && !order.every(u => (Sync.players || {})[u]); i++) await new Promise(r => setTimeout(r, 50));   // the seats arrive from the database
  }
  let who = first;
  if (st.shuffle) { for (let i = order.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [order[i], order[j]] = [order[j], order[i]]; } who = ((Sync.players || {})[order[0]] || {}).name || first; await Sync.updateSettings({ order }); }   // the seats are drawn at the start, and the table keeps that order
  Online.hostStart(order, who);
}

Object.assign(actions, {
  mapgallery() { mapGallery(); },
  optinfo(b) { const open = dlg.open && dlg.querySelector('.seg'); optInfo(b.dataset.f); if (open) $('#d-no').onclick = lobbyOpts; },
  lobbyopts() { lobbyOpts(); },
  addlobbybot() {
    const ps = Sync.players || {}; if (Object.keys(ps).length >= ((Sync.settings || {}).max || 8)) return;
    const used = new Set(Object.values(ps).map(p => p.name)); let n = 1; while (used.has(t('Bot {n}', { n }))) n++;
    const id = 'bot_' + Math.random().toString(36).slice(2, 8);
    Sync.set('players/' + id, { name: t('Bot {n}', { n }), ready: true, bot: S.botLevel || 'normal' }).catch(rulesError);
  },
  delbot(b) { Sync.del('players/' + b.dataset.u).catch(() => {}); },
  seg(b) {
    const f = b.dataset.f, v = b.dataset.v, inp = document.getElementById('f-' + f);
    b.parentNode.querySelectorAll('[role=radio]').forEach(x => x.setAttribute('aria-checked', x === b));
    if (inp) inp.value = v;
    if (S.stage === 'lobby' && isHost()) Sync.updateSettings({ [f]: v });
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
    Hot.start(names, $('#f-map').value, $('#f-mode').value, 'auto', T.hotBots.slice());
  },
  solo() { S.stage = 'solo'; save(); renderFlow(); },
  back() { S.stage = 'welcome'; Sync.status = 'off'; save(); renderFlow(); },
  ignoreinvite() { T.pendingRoom = null; try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ } renderFlow(); },
  async hostcreate() {
    const name = readName(); S.mapId = $('#f-map').value; S.mode = $('#f-mode').value; S.track = 'auto';
    try { await Sync.ensure(); } catch (_) { /* stays offline */ }
    if (!Sync.registered) { T.afterAuth = 'host'; S.stage = 'auth'; T.authReason = t('Create an account to create a game.'); save(); renderFlow(); return; }
    const m = T.maps.find(x => x.id === S.mapId), patch = mapPatch(m);
    if (isCustomMap(m) && !patch.customMap) { toast(t('This map is too large for an online game.')); return; }
    S.vis = ['public', 'friends'].includes(($('#f-vis') || {}).value) ? $('#f-vis').value : 'private'; S.max = +($('#f-max') || {}).value || 8; S.fill = ($('#f-fill') || {}).value || '';
    const ok = await Sync.create({ map: S.mapId, mode: S.mode, customMap: patch.customMap, pub: S.vis === 'public', max: S.max, fill: S.fill }, { name });
    if (!ok) renderFlow(); else if (S.vis === 'friends') inviteAllFriends();
  },
  /* Quick match: join the open public game that is closest to full; with none open, start a public one and wait */
  async quickmatch() {
    const name = readName(); let list = [];
    try { list = await Sync.browse(); } catch (_) { /* offline */ }
    list.sort((a, b) => (a[1].max - a[1].n) - (b[1].max - b[1].n) || b[1].n - a[1].n);   // fewest free seats first
    if (list.length) { const ok = await Sync.join(list[0][0], { name }); if (!ok) { T.pubList = undefined; renderFlow(); } return; }
    if (!Sync.registered) { toast(t('No open games right now. Sign in to start one.')); return; }
    S.mapId = S.mapId || 'galilei'; S.mode = S.mode || 'ultimate'; S.track = 'auto';
    const ok = await Sync.create({ map: S.mapId, mode: S.mode, pub: true, max: 8 }, { name });
    if (ok) toast(t('Nobody is waiting, so you started a public game. Others can join from the Online lobby.')); else renderFlow();
  },
  friends() { S.stage = 'friends'; T.friendList = undefined; T.friendMsg = ''; renderFlow(); },
  async friendadd() { const r = await Sync.addFriend(($('#friend-handle') || {}).value); T.friendMsg = FRIEND_MSG[r] || ''; T.friendList = undefined; renderFlow(); },
  async friendok(b) { await Sync.acceptFriend(b.dataset.u, b.dataset.h); T.friendList = undefined; renderFlow(); },
  async friendno(b) { await Sync.declineFriend(b.dataset.u); T.friendList = undefined; renderFlow(); },
  friendrm(b) { confirmDlg(t('Remove this friend?'), t('They stay out of your list until you add each other again.'), async () => { await Sync.removeFriend(b.dataset.u); T.friendList = undefined; renderFlow(); }); },
  invitefriend() { inviteDlg(); },
  async sendinvite(b) { const st = Sync.settings || {}; await Sync.invite(b.dataset.u, Sync.code, tableMapOf(st).name).catch(() => {}); (T.invited = T.invited || {})[b.dataset.u] = 1; inviteDlg(); },
  async joininvite(b) { await Sync.dismissInvite(b.dataset.f); const ok = await Sync.join(b.dataset.c, { name: readName() }); if (!ok) renderFlow(); },
  skipinvite(b) { Sync.dismissInvite(b.dataset.f); },
  browse() { S.stage = 'games'; T.gamesView = 'open'; T.pubList = undefined; renderFlow(); },
  home() { S.stage = 'welcome'; T.homeGames = undefined; renderFlow(); },
  library() { S.stage = 'library'; T.libStats = undefined; renderFlow(); },
  async joinpub(b) { const ok = await Sync.join(b.dataset.c, { name: readName() }); if (!ok) { T.pubList = undefined; renderFlow(); } },
  async joinroom() {
    const name = readName(), code = T.pendingRoom || ($('#join-code') || {}).value || '';
    const ok = await Sync.join(code, { name });
    if (!ok) renderFlow();
  },
  ready() {
    S.ready = !S.ready; const p = { ready: S.ready };
    // the records switch is a newer field: with database rules published before it existed, the write is refused, and ready must still go through
    Sync.setMeP(Object.assign({ share: Records.on() }, p)).catch(() => Sync.setMeP(p).catch(e => rulesError(e)));
    save(); renderFlow();
  },
  recshare(b) { Records.set(b.dataset.v === 'on'); if (S.stage === 'game' && S.role) render(); else renderFlow(); },
  makehost(b) {
    if (!isHost()) return;
    Sync.updateSettings({ host: b.dataset.u });
    toast(t('Bots will run on that player’s device.'));
  },
  async takeover() {
    try { await Sync.claimHost(); if (typeof Online !== 'undefined') Online.hostCheck(); toast(t('You are running the bots now.')); } catch (_) { toast(t('Could not take over the game.')); }
    if (S.stage === 'game') { render(); hdr(); } else renderFlow();
  },
  handover() {
    const me = Sync.uid;
    const others = Object.entries(Sync.players || {}).filter(([u, p]) => u !== me && !p.bot && !p.out);
    if (!others.length) { toast(t('Nobody else is in the game.')); return; }
    dlg.innerHTML = `<h2>${t('Hand over hosting')}</h2><p class="dim">${t('Bots will run on the device you choose. You can take over again later.')}</p>
      <ul class="plist">${others.map(([u, p]) => `<li><span class="pname">${esc(p.name)}</span><button class="btn" data-act="gohost" data-u="${esc(u)}">${t('Choose')}</button></li>`).join('')}</ul>
      <div class="row"><button class="btn" id="d-no">${t('Cancel')}</button></div>`;
    if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg;
  },
  async gohost(b) {
    const u = b.dataset.u; closeDlg();
    try {
      await Sync.updateSettings({ host: u });
      await Sync.delPath(`rooms/${Sync.code}/lease`).catch(() => {});
      toast(t('Hosting handed over.'));
    } catch (_) { toast(t('Could not hand over hosting.')); }
  },
  mvup(b) { reorder(b.dataset.u, -1); },
  mvdown(b) { reorder(b.dataset.u, 1); },
  shuffleopt(b) { Sync.updateSettings({ shuffle: b.dataset.v === 'on' }); },
  botlevel(b) { S.botLevel = b.dataset.v; save(); renderFlow(); },
  startgame: startTable,
  leavelobby() { confirmDlg(t('Leave this game?'), t('You will stop receiving announcements.'), leaveToWelcome); },
  leavetable() {
    confirmDlg(t('Leave the game?'), t('The game keeps going and you can come back from My games.'), () => {
      if (Sync.isHost()) {
        const other = Object.keys(Sync.players || {}).find(u => u !== Sync.uid && !Sync.players[u].bot && !Sync.players[u].out);
        if (other) Sync.updateSettings({ host: other });
      }
      flushSeat();
      Sync.releaseHost();
      Sync.leave(true); S.room = null; S.stage = 'welcome'; T.turnState = null; save(); boot(); renderFlow();
    });
  },
  /* leave a finished game: the host hands the game to another person first, so the others can still rematch */
  backtoplay() {
    if (Sync.isHost()) { const other = Object.keys(Sync.players || {}).find(u => u !== Sync.uid && !Sync.players[u].bot && !Sync.players[u].out); if (other) Sync.updateSettings({ host: other }); }
    flushSeat(); Sync.releaseHost(); Sync.leave(true); S.room = null; S.stage = 'welcome'; T.turnState = null; T.homeGames = null; save(); boot(); renderFlow();
  },
  closetable() {
    if (!Sync.isHost()) return;
    confirmDlg(t('End the game for everyone?'), t('The game ends for everyone. This cannot be undone.'), () => {
      Sync.closeRoom().catch(() => {});
      Sync.leave(true); S.room = null; S.stage = 'welcome'; T.turnState = null; T.homeGames = null; save(); boot(); renderFlow();
    });
  },
  solostart(b) { soloStart(b.dataset.role); },
  scanqr() { scanDlg(); }
});
/* the phone's Back button steps back through the app instead of leaving it: one spare history entry is always kept */
const PARENT = { stats: 'library', account: 'library', games: 'welcome', friends: 'welcome', library: 'welcome', browse: 'welcome', host: 'welcome', hotsetup: 'welcome', solo: 'welcome', auth: 'welcome', admin: 'welcome', maps: 'welcome' };
function handleBack() {
  if (dlg.open) { closeDlg(); return true; }
  const g = document.getElementById('gallery'); if (g) { g.remove(); return true; }
  const ov = document.getElementById('overlay'); if (ov) { ov.remove(); return true; }
  if (S.stage === 'game') { if (S.tab !== 'play') { setTab('play'); render(); } return true; }
  if (S.stage === 'lobby') { actions.leavelobby(); return true; }
  if (PARENT[S.stage]) { S.stage = PARENT[S.stage]; T.authMsg = ''; save(); renderFlow(); return true; }
  return false;   // the home screen: let the browser leave
}
try { history.pushState({ eftaios: 1 }, ''); window.addEventListener('popstate', () => { if (handleBack()) history.pushState({ eftaios: 1 }, ''); else { toast(t('Press Back again to leave the app.')); setTimeout(() => { try { history.pushState({ eftaios: 1 }, ''); } catch (_) { /* noop */ } }, 2500); } }); } catch (_) { /* no history */ }
Object.assign(actions, Auth.actions, window.Admin ? Admin.actions : {});

/* join by scanning the table's QR code with the camera (the decoder is loaded the first time it is needed) */
let scanStream = null;
function stopScan() { if (scanStream) { scanStream.getTracks().forEach(x => x.stop()); scanStream = null; } }
dlg.addEventListener('close', stopScan);
const loadJsQR = () => window.jsQR ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/jsQR.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
/* a scanned link or a plain code -> the table code, or '' */
const codeFromScan = txt => {
  try { const r = new URL(txt).searchParams.get('room'); if (r) return r.trim().toUpperCase().slice(0, 8); } catch (_) { /* not a link */ }
  const m = String(txt).trim().toUpperCase().match(/^[A-Z2-9]{4,8}$/); return m ? m[0] : '';
};
async function scanDlg() {
  dlg.innerHTML = `<h2>${t('Scan a game QR code')}</h2><div class="scanbox"><video id="scan-video" playsinline muted></video><i class="scanframe"></i></div>
    <p class="dim" id="scan-msg">${t("Point the camera at the QR code on the host's screen.")}</p><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button></div>`;
  if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg;
  const msg = x => { const m = $('#scan-msg'); if (m) m.textContent = x; };
  try {
    await loadJsQR();
    if (!dlg.open) return;
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch (e) { const sb = $('.scanbox'); if (sb) sb.style.display = 'none'; msg(t('The camera is not available. Allow camera access, or type the game code.')); return; }
  const video = $('#scan-video'); if (!video || !dlg.open) { stopScan(); return; }
  video.srcObject = scanStream; try { await video.play(); } catch (_) { /* autoplay refused */ }
  const cv = document.createElement('canvas'), cx = cv.getContext('2d', { willReadFrequently: true }), stream = scanStream;
  const tick = () => {
    if (scanStream !== stream || !dlg.open) return;
    if (video.videoWidth) {
      const k = Math.min(1, 640 / video.videoWidth); cv.width = Math.round(video.videoWidth * k); cv.height = Math.round(video.videoHeight * k);
      cx.drawImage(video, 0, 0, cv.width, cv.height);
      const hit = window.jsQR(cx.getImageData(0, 0, cv.width, cv.height).data, cv.width, cv.height, { inversionAttempts: 'attemptBoth' });
      const code = hit && codeFromScan(hit.data);
      if (code) { stopScan(); closeDlg(); const jc = $('#join-code'); if (jc) jc.value = code; T.pendingRoom = null; actions.joinroom(); return; }
      if (hit) msg(t('That QR code is not a game.'));
    }
    setTimeout(tick, 120);
  };
  tick();
}

/* keep the stored order in line with who is at the table (host only) */
function syncOrder() {  if (!isHost() || !Sync.settings || Sync.settings.status !== 'lobby') return;
  const want = orderedIds(), have = Sync.settings.order || [];
  if (want.length !== have.length || want.some((u, i) => u !== have[i])) Sync.updateSettings({ order: want });
}

/* once a game is over, add it to this player's history and running totals */
async function recordResult(st) {
  if (!Sync.registered || S.hot || !S.role || !st || !st.result || !Sync.code) return;
  T.recDone = T.recDone || {};
  const key = Sync.code + (st.n > 1 ? '-' + st.n : '');   // one record per game: a table hosts many
  if (T.recDone[key]) return;
  T.recDone[key] = 1;
  try { if (await Sync.getPath(`users/${Sync.uid}/games/${key}`)) return; } catch (_) { return; }
  const aliensWin = !!st.result.aliensWin;
  const win = S.role === 'alien' ? aliensWin : !aliensWin;
  await Sync.recordGame(key, { result: win ? 'win' : 'loss', role: S.role, chars: S.char || '', map: S.mapId || '', players: Object.keys(Sync.players || {}).length, escaped: S.over === 'escaped', bots: Object.values(Sync.players || {}).some(p => p.bot), kills: S.log.filter(e => killOf(e) && playerKey(e) === 'me').length, turns: S.turn || 0 });
}

const logRec = e => ({ id: e.id, by: e.by || '', turn: e.turn, who: e.who, kind: e.kind, sector: e.sector || null, text: e.text, n: e.n || 0, ok: !!e.ok, mine: false, at: e.at, remote: true });
/* rebuild a seat from the private checkpoint on the table, for a device that has no local game */
async function serverResume(code) {
  if (T.resuming) return false;
  T.resuming = true;
  try {
    const [seat, sec, st, log, hatches, jr] = await Promise.all([
      Sync.readSeat(code).catch(() => null),
      Sync.getPath(`rooms/${code}/secret/${Sync.uid}`).catch(() => null),
      Sync.getPath(`rooms/${code}/settings`).catch(() => null),
      Sync.getPath(`rooms/${code}/log`).catch(() => null),
      Sync.getPath(`rooms/${code}/hatches`).catch(() => null),
      Sync.getPath(`rooms/${code}/journal/${Sync.uid}`).catch(() => null)
    ]);
    if (!st || st.status !== 'playing' || !seat || !sec || !sec.role) return false;
    const name = S.name;
    T.map = T.maps.find(m => m.id === st.map) || tableMapOf(st);
    S = Object.assign(fresh(), { stage: 'game', mapId: T.map.id, mode: st.mode, track: 'auto', role: sec.role, char: sec.char || '', online: true, name, room: code, customMaps: S.customMaps, tab: 'play' });
    S.pos = seat.pos || startSector(T.map, sec.role, sec.char, st.mode);
    try { S.path = JSON.parse(seat.path || '[]'); } catch (_) { S.path = []; }
    if (!Array.isArray(S.path) || !S.path.length) S.path = [{ turn: 0, pos: S.pos }];
    S.items = Array.isArray(seat.items) ? seat.items : [];
    S.turn = seat.turn || 1; S.over = seat.over || null; S.seatAt = seat.at || 0;
    applySeatFlags(seat);
    S.jsent = journalOf(); applyJournal(jr);   // a fresh state counts as synced with an empty journal, so the table's wins
    /* the table's timeline and hatches: the live feed may have delivered them to the state this one replaced */
    S.log = Object.values(log || {}).filter(e => e && e.id).map(logRec).sort((a, b) => b.at - a.at);
    for (const n of [1, 2, 3, 4]) if (hatches && hatches[n] !== undefined) S.hatches[n] = hatches[n] ? 1 : 0;
    T.turnState = Sync.turn || null;
    save(); boot();
    if (typeof Online !== 'undefined') { Online.attach(); Online.hostCheck(); }
    toast(t('Game restored.'));
    return true;
  } catch (e) { console.warn('resume', e); return false; }
  finally { T.resuming = false; }
}
/* this device has a game already: the table's checkpoint wins if it is on a later turn */
async function applySeatIfNewer(code) {
  try {
    const [seat, jr] = await Promise.all([Sync.readSeat(code), Sync.getPath(`rooms/${code}/journal/${Sync.uid}`).catch(() => null)]);
    let changed = applyJournal(jr);
    if (seat && seat.at && Number(seat.at) > Number(S.seatAt || 0)) {
      if (seat.pos) S.pos = seat.pos;
      try { S.path = JSON.parse(seat.path || '[]'); } catch (_) { /* keep local */ }
      if (Array.isArray(seat.items)) S.items = seat.items;
      S.turn = seat.turn || S.turn; S.over = seat.over || S.over; S.seatAt = seat.at;
      applySeatFlags(seat); changed = true;
    }
    if (changed) { save(); boot(); }
    queueJournal();   // anything this device changed while it was away goes to the table now
  } catch (_) { /* offline: local state stands */ }
}
/* the turn flags saved with the seat: Alien fed, mutated, Adrenaline or Cat played, the step of the turn */
function applySeatFlags(seat) {
  for (const k of ['fed', 'reborn', 'adr', 'cat', 'outSent', 'revealed', 'routeSent']) if (typeof seat[k] === 'boolean') S[k] = seat[k];
  if (typeof seat.phase === 'string' && seat.phase) S.phase = seat.phase;
  if (typeof seat.res === 'string') { try { S.res = JSON.parse(seat.res); } catch (_) { /* keep */ } }
  if (typeof seat.mkN === 'number') S.mkN = seat.mkN;
  /* a card request that was in flight when the page closed cannot be answered any more: ask again */
  if (S.res && S.res.stage === 'wait') S.res = { stage: /^[1-4]$/.test(String(at(T.map, S.pos))) ? 'pod' : 'choose' };
}
/* merge the table's journal into this device: a field changed here since the last save stays and is sent later,
   a field only the table changed (another device) is taken */
function applyJournal(jr) {
  if (!jr) return false;
  const sent = S.jsent = S.jsent || {}, cur = journalOf(); let changed = false;
  for (const k of Object.keys(cur)) {
    if (typeof jr[k] !== 'string') continue;
    if (jr[k] === cur[k]) { sent[k] = jr[k]; continue; }
    if (cur[k] !== sent[k]) continue;
    try { S[k] = JSON.parse(jr[k]); sent[k] = jr[k]; changed = true; } catch (_) { /* unreadable: keep local */ }
  }
  return changed;
}

Sync.on({
  inbox() { if (!S.stage || S.stage === 'welcome' || S.stage === 'friends') renderFlow(); },
  leaving() { const st = Sync.settings; if (st && !(st.result && st.result.reason === 'closed')) { flushSeat(); flushJournal(); } },   // a closed or deleted table takes no more saves
  status(s) {
    if ((S.stage === 'lobby' || S.stage === 'game') && (s === 'no-room' || s === 'started' || s === 'closed' || s === 'full')) { toast(t(FLOW_MSG[s])); Sync.leave(true); resetToWelcome(); return; }
    if (S.stage === 'game') { if (S.tab === 'table') render(); } else renderFlow();
  },
  joined(code) {
    S.room = code;
    if (Sync.registered && Sync.profile) S.name = Sync.profile.name;
    if (S.stage !== 'game') {
      /* nothing local to trust: rebuild the seat from the private checkpoint on the table */
      S.stage = 'lobby'; T.pendingRoom = null; renderFlow();
      serverResume(code).then(ok => {
        if (ok) return;
        try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ }
        renderFlow();
      });
      return;
    }
    save(); if (S.stage === 'game') { if (S.online && (typeof Online !== 'undefined')) Online.attach(); if (S.tab === 'table') render(); }
    applySeatIfNewer(code);
  },
  settings(st) {
    if (T.resuming) return;
    if (!st && Sync.code && !Sync.isHost() && (S.stage === 'lobby' || S.stage === 'game')) { toast(t('The host closed this game.')); Sync.leave(true); resetToWelcome(); return; }
    if (st && st.status === 'lobby' && S.stage === 'game' && S.online) { backToLobby(); return; }
    if (st && st.status === 'over' && st.result && st.result.reason === 'closed' && (S.stage === 'lobby' || S.stage === 'game') && !Sync.isHost()) { toast(t('The host closed this game.')); Sync.leave(true); resetToWelcome(); return; }
    if (S.stage === 'lobby') { if (st && st.status === 'playing') beginGame(); else { syncOrder(); renderFlow(); } }
    else if (S.stage === 'game') { if (st && st.status === 'over') { showGameOver(); paintOverlay(); recordResult(st); } hdr(); if (S.tab === 'play' || S.tab === 'table') render(); }
    if (typeof Online !== 'undefined') Online.hostCheck();
  },
  players() {
    if (S.stage === 'lobby') { syncOrder(); renderFlow(); }
    else if (S.stage === 'game') { if ((typeof Online !== 'undefined')) Online.onPlayers(); if (S.tab === 'table' || (S.tab === 'play' && !myTurn())) render(); paintOverlay(); }
  },
  turn(v) { onTurn(v); },
  counts(c) { T.counts = c; if (S.stage === 'game' && S.tab === 'table') render(); },
  entry(e) {
    if (!e || !e.id || S.log.some(x => x.id === e.id)) return;
    S.log.push(logRec(e));
    S.log.sort((a, b) => b.at - a.at); save(); if (S.stage === 'game') { paintOverlay(); if (S.tab === 'table' || S.tab === 'play') render(); if (window.onPublicEntry) onPublicEntry(S.log.find(x => x.id === e.id)); }
  },
  hatches(h) { for (const n of [1, 2, 3, 4]) if (h[n] !== undefined) S.hatches[n] = h[n] ? 1 : 0; if (S.stage === 'game') afterChange(); },
  lease() { if (typeof Online !== 'undefined' && Sync.isHolder()) Online.hostCheck(); if (S.stage === 'game') hdr(); },
  auth() { if (['welcome', 'lobby', 'auth', 'account', 'games', 'stats', 'admin'].includes(S.stage)) renderFlow(); }
});

{ const q = new URLSearchParams(location.search).get('room'); if (q) { const c = q.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8); if (S.stage === 'game') { try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ } } else T.pendingRoom = c; } }
loadMaps().then(() => {
  if (Sync.isLink()) { S.stage = 'auth'; save(); }
  boot();
  if (S.hot) Hot.showPass();
  try { if (localStorage.getItem('eftaios.account')) Sync.ensure().then(() => { if (S.stage !== 'game') renderFlow(); }).catch(() => {}); } catch (_) { /* storage unavailable */ }
  if (S.room && (S.stage === 'lobby' || S.stage === 'game')) Sync.join(S.room, { name: S.name || t('Player') });
  else if (S.stage === 'lobby') { S.stage = 'welcome'; renderFlow(); }
});
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  /* a new version takes over the open tab: reload at once on the menus, but never in the middle of a table */
  const hadWorker = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker) return;   // first install: nothing was running before
    if (S.stage === 'game' || S.stage === 'lobby') { toast(t('A new version is ready. Reload when the game is over.')); return; }
    try { if (sessionStorage.getItem('eftaios.reloaded') === '1') return; sessionStorage.setItem('eftaios.reloaded', '1'); } catch (_) { /* noop */ }
    location.reload();
  });
  setTimeout(() => { try { sessionStorage.removeItem('eftaios.reloaded'); } catch (_) { /* noop */ } }, 10000);   // only guards against a reload loop
  navigator.serviceWorker.register('sw.js').catch(() => { /* optional */ });
}
