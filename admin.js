'use strict';
/* Admin panel: reachable only with the `admin` custom claim. It reads players, rooms, maps,
   reports and the audit log; it never opens a live game's roles or positions. */
const Admin = (() => {
  const tab = () => T.adminTab || 'users';
  const when = ts => ts ? new Date(ts).toLocaleString() : '';
  const badge = (on, onTxt, offTxt) => `<span class="pst">${on ? onTxt : offTxt}</span>`;

  async function load() {
    if (!Sync.isAdmin) { T.admin = null; renderFlow(); return; }
    T.admin = null; renderFlow();
    try {
      const [users, maps, reports, log, bans, rooms] = await Promise.all([
        Sync.adminList('users'), Sync.adminList('pubmaps'), Sync.adminList('reports'), Sync.adminList('adminlog'), Sync.adminList('bans'), Sync.adminList('roomIndex')
      ]);
      T.admin = { users, maps, reports, log, bans, rooms };
    } catch (e) { T.admin = { error: String(e && (e.code || e.message) || e).slice(0, 80) }; }
    renderFlow();
  }
  Sync.adminLoad = load;

  function html() {
    if (!Sync.isAdmin) return `<header class="fhead"><button class="icon-btn" data-act="adminclose" aria-label="${t('Back')}">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'}</button><h2>${t('Admin')}</h2></header><p class="dim">${t('This account is not an administrator.')}</p>`;
    const head = `<header class="fhead"><button class="icon-btn" data-act="adminclose" aria-label="${t('Back')}">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'}</button><h2>${t('Admin')}</h2></header>`;
    const tabs = `<div class="seg adm-tabs" role="tablist">${[['users', 'Players'], ['rooms', 'Rooms'], ['maps', 'Maps'], ['reports', 'Reports'], ['audit', 'Audit'], ['bots', 'Bot tests']].map(([k, l]) => `<button role="tab" data-act="admintab" data-k="${k}" aria-checked="${tab() === k}">${t(l)}</button>`).join('')}</div>`;
    /* the page that always shows the rules deployed with the site, ready to copy into the Firebase console */
    const tools = `<div class="row two"><a class="btn" href="firebase-rules.html" target="_blank" rel="noopener">${t('Database rules')}</a>${tab() === 'audit' ? `<button class="btn danger" data-act="adminnuke">${t('Nuke the app')}</button>` : ''}</div>`;
    if (tab() === 'bots') return `${head}${tabs}${botTests()}`;
    if (!T.admin) return `${head}${tabs}<p class="dim">${t('Loading…')}</p>${tools}`;
    if (T.admin.error) return `${head}${tabs}<p class="dim">${t('Could not load the admin data')}: ${esc(T.admin.error)}</p>${tools}`;
    return `${head}${tabs}${T.admin[tab() === 'audit' ? 'log' : tab()] === undefined ? '' : roster(tab())}${tools}`;
  }
  /* Bot tests: ready-made games for the admin to play against the bots (6 players, Ultimate, you are seat 1).
     Seats are { role, char, items, bot }; a seat with no role is dealt at random. */
  const H = (char, items, bot = 'hard') => ({ role: 'human', char, items, bot }), A = (char, items, bot = 'hard') => ({ role: 'alien', char, items, bot });
  const BOT_TESTS = [
    { name: '1. Alien powers', who: 'You: Human (Engineer)', ask: 'Play 1 game, until you escape or die.',
      look: 'Lurking Alien attacks without leaving its sector (an attack in the sector it announced last turn). Blink Alien plays Teleport (an item in the log). Fast Alien jumps up to 3 sectors on turn 1.',
      seats: [H('Engineer', [], ''), H('Medic', [], 'hard'), H('Soldier', [], 'hard'), A('Lurking Alien'), A('Blink Alien', ['teleport', 'teleport']), A('Fast Alien')] },
    { name: '2. Alien items', who: 'You: Human (Psychologist, starts in the Alien sector)', ask: 'Play 1 game.',
      look: 'Surge Alien plays Adrenaline (a player moving 2+ with an Item played). Silent Alien plays Sedatives and makes no noise. Psychic Alien makes noises even on a Silence card (nothing to see; just check nothing breaks).',
      seats: [H('Psychologist', [], ''), H('Captain', [], 'hard'), H('Pilot', [], 'hard'), A('Surge Alien', ['adrenaline', 'adrenaline']), A('Silent Alien', ['sedatives', 'sedatives']), A('Psychic Alien')] },
    { name: '3. Human powers', who: 'You: Alien (Silent Alien)', ask: 'Play 1 game, hunting.',
      look: 'Medic shows who someone is (a reveal in the log naming a player and role, from turn 3). Soldier attacks like an Attack card. Executive Officer stays still one turn in a Dangerous or Secure sector.',
      seats: [A('Silent Alien', [], ''), H('Medic', [], 'hard'), H('Soldier', [], 'hard'), H('Executive Officer', [], 'hard'), A('Brute Alien'), A('Invisible Alien')] },
    { name: '4. Human items', who: 'You: Alien (Surge Alien)', ask: 'Play 1 game, hunting.',
      look: 'Spotlight and Sensor reveals in the log. Cat or Pilot: two noises in one turn. Teleport: a player jumps to the Human sector. Mutation: a Human turns Alien. Co-pilot teleports and shows who she is. Captain: one Dangerous sector with no announcement.',
      seats: [A('Surge Alien', [], ''), H('Pilot', ['sensor', 'spotlight', 'teleport'], 'hard'), H('Co-pilot', ['cat', 'mutation', 'adrenaline'], 'hard'), H('Captain', ['sedatives', 'attack', 'sensor'], 'hard'), A('Brute Alien', [], 'hard'), A('Invisible Alien', [], 'hard')] },
    { name: '5. Hard table', who: 'You: random role', ask: 'Play 1 game and tell me how hard it felt (1-5).', look: 'Do the bots feel like players? Any silly move?', seats: [{}, ...Array(5).fill({ bot: 'hard' })] },
    { name: '6. Normal table', who: 'You: random role', ask: 'Play 1 game and rate it 1-5.', look: 'Clearly easier than Hard, clearly harder than Easy?', seats: [{}, ...Array(5).fill({ bot: 'normal' })] },
    { name: '7. Easy table', who: 'You: random role', ask: 'Play 1 game and rate it 1-5.', look: 'A beginner should win most games. Do the mistakes look natural?', seats: [{}, ...Array(5).fill({ bot: 'easy' })] },
    { name: '8. Hard table, 8 players', who: 'You: random role', ask: 'Optional.', look: 'Do the Aliens bunch up? Do they avoid killing each other?', seats: [{}, ...Array(7).fill({ bot: 'hard' })] }
  ];
  function botTests() {
    const rows = BOT_TESTS.map((x, i) => `<li class="adm-row bt"><span class="who"><b>${esc(x.name)}</b><small>${esc(x.who)}. ${esc(x.ask)}</small><small>Look for: ${esc(x.look)}</small></span><div class="acts"><button class="btn primary" data-act="bottest" data-i="${i}">${t('Start')}</button></div></li>`).join('');
    return `<p class="dim">Tests 1-5 are the minimum (about 1 hour); 6-8 are optional. Bots are Ultimate, map Galilei. When a game ends, rate it and tap Send: the rating, your note and the full log are saved for the admin. Nothing to download or send by hand.</p>
    <p class="dim">To also copy every game into the repo folder tests/play-logs/ from this phone, paste a GitHub token once (Contents: read and write on this repository only). It stays in this browser and goes only to api.github.com.</p>
    <div class="row"><input id="bt-token" type="password" autocomplete="off" placeholder="${btToken() ? 'GitHub token saved on this device' : 'GitHub token'}"><button class="btn" data-act="bttoken">${t('Save')}</button></div>
    <button class="btn big wide" data-act="btsync">Send saved games to the repo</button><p class="dim" id="bt-status" role="status"></p><ul class="plist adm-list">${rows}</ul>`;
  }
  /* After a bot test: a 1-5 rating and a note, saved with the full game log under bottests/ in the database (admin-only).
     `node tools/pull-bot-tests.js` copies them into tests/play-logs/. */
  const btToken = () => { try { return localStorage.getItem('eftaios.ghtoken') || ''; } catch (_) { return ''; } };
  /* one saved record -> tests/play-logs/ on main (GitHub contents API). 'exists' means it was sent before. */
  async function pushToRepo(id, r) {
    const file = `tests/play-logs/${new Date(r.at).toISOString().slice(0, 16).replace(/[:T]/g, '-')}-test${r.n || 0}-${id}.json`;
    const body = JSON.stringify({ test: r.test, rating: r.rating, notes: r.notes || '', at: new Date(r.at).toISOString(), map: r.map, game: JSON.parse(r.game) });
    const res = await fetch('https://api.github.com/repos/blackworm86/eftaios/contents/' + file, { method: 'PUT', headers: { Authorization: 'Bearer ' + btToken(), Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ message: `Bot test ${r.test}: ${r.rating}/5`, branch: 'main', content: btoa(unescape(encodeURIComponent(body))) }) });
    if (res.status === 422) return 'exists';
    if (!res.ok) throw new Error(res.status === 401 || res.status === 403 || res.status === 404 ? 'the token is missing or cannot write to this repository' : 'GitHub answered ' + res.status);
    return 'sent';
  }
  function ratePanel() {
    const x = T.botTest; if (!x || !S.hot || !Sync.isAdmin) return '';
    if (T.btSent) return `<p class="pst">Saved: ${esc(x.name)} · ${T.btRating}/5</p>`;
    return `<h3>${esc(x.name)}</h3><div class="seg" role="radiogroup" aria-label="Rating">${[1, 2, 3, 4, 5].map(n => `<button role="radio" data-act="btrate" data-n="${n}" aria-checked="${T.btRating === n}">${n}</button>`).join('')}</div>
      <textarea id="bt-notes" rows="4" maxlength="2000" placeholder="What did you see? What looked wrong?"></textarea><button class="btn primary big wide" data-act="btsend">Save rating and log</button>`;
  }
  /* lists are paged so the panel never scrolls: five rows per screen on a phone */
  function paged(which, entries, per, row) {
    const pages = Math.max(1, Math.ceil(entries.length / per));
    const page = Math.min(Math.max((T.adminPage || {})[which] || 0, 0), pages - 1);
    T.adminPage = Object.assign({}, T.adminPage, { [which]: page });
    const rows = entries.slice(page * per, page * per + per).map(row).join('');
    const pager = pages > 1
      ? `<div class="pager"><button class="prev" data-act="adminpage" data-k="${which}" data-d="-1" ${page === 0 ? 'disabled' : ''} aria-label="${t('Previous')}">${ico('next', 16)}</button><span>${page + 1} / ${pages}</span><button data-act="adminpage" data-k="${which}" data-d="1" ${page === pages - 1 ? 'disabled' : ''} aria-label="${t('Next')}">${ico('next', 16)}</button></div>`
      : '';
    return `<ul class="plist adm-list">${rows || `<li>${t('Nothing here yet.')}</li>`}</ul>${pager}`;
  }
  const nRooms = n => `${n} ${t(n === 1 ? 'room' : 'rooms')}`;

  function roster(which) {
    const d = T.admin;
    if (which === 'users') {
      const list = Object.entries(d.users || {});
      const rows = paged('users', list, 5, ([uid, u]) => {
        const p = (u && u.profile) || {}, banned = !!(d.bans || {})[uid], me = uid === Sync.uid;
        const rooms = Object.keys((u && u.rooms) || {}).length;
        const actions = me
          ? `<span class="pst">${t('This is you')}</span>`
          : `<div class="acts"><button class="btn" data-act="adminban" data-u="${esc(uid)}" data-h="${esc(p.handle || '')}" data-b="${banned ? 1 : 0}">${banned ? t('Unban') : t('Ban')}</button>
          <button class="btn danger" data-act="adminwipe" data-u="${esc(uid)}" data-h="${esc(p.handle || '')}">${t('Delete')}</button></div>`;
        return `<li class="adm-row"><span class="who"><b>${esc(p.name || '(no profile)')}</b><small>@${esc(p.handle || '—')} · ${nRooms(rooms)}${banned ? ' · ' + t('banned') : ''}</small></span>${actions}</li>`;
      });
      return `${rows}<div class="row two"><button class="btn" data-act="adminreset">${t('Send a password reset')}</button></div>`;
    }
    if (which === 'rooms') {
      const users = d.users || {};
      const list = Object.entries(d.rooms || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      const sweep = `<div class="row two"><button class="btn danger" data-act="adminsweep">${t('Delete closed and idle rooms')}</button></div>`;
      return sweep + paged('rooms', list, 5, ([code, r]) => {
        const host = (users[r.host] && users[r.host].profile) || {};
        return `<li class="adm-row"><span class="who"><b>${esc(code)}</b><small>${esc(r.map || '')} · ${r.players || 1} ${t('players')}${host.name ? ' · ' + esc(host.name) : ''}</small></span>
          <div class="acts"><span class="pst">${esc(r.status || '')}</span><button class="btn" data-act="adminroomclose" data-c="${esc(code)}">${t('Close')}</button></div></li>`;
      });
    }
    if (which === 'maps') {
      const list = Object.entries(d.maps || {});
      return paged('maps', list, 5, ([id, m]) => `<li class="adm-row"><span class="who"><b>${esc(m.name)}</b><small>${esc(m.author || '')} · ${m.rows ? m.rows.length : 0}×${m.rows && m.rows[0] ? m.rows[0].length : 0} · ${m.hidden ? t('hidden') : t('published')}</small></span>
        <div class="acts"><button class="btn" data-act="adminmap" data-id="${esc(id)}" data-h="${m.hidden ? 1 : 0}">${m.hidden ? t('Restore') : t('Hide')}</button>
        <button class="btn danger" data-act="adminmapdel" data-id="${esc(id)}">${t('Delete')}</button></div></li>`);
    }
    if (which === 'reports') {
      const list = Object.entries(d.reports || {}).filter(([, r]) => !r.done);
      return paged('reports', list, 5, ([id, r]) => `<li class="adm-row"><span class="who"><b>${esc(r.kind)}: ${esc(r.target)}</b><small>${esc(r.text || '')} · ${when(r.at)}</small></span>
        <div class="acts"><button class="btn" data-act="adminreport" data-id="${esc(id)}">${t('Resolve')}</button></div></li>`);
    }
    const list = Object.entries(d.log || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
    return paged('audit', list, 8, ([, e]) => `<li class="adm-row"><span class="who"><b>${esc(e.action)} ${esc(e.target || '')}</b><small>${esc(e.detail || '')} · ${when(e.at)}</small></span></li>`);
  }

  async function closeRoom(code) {
    await Sync.setPath(`rooms/${code}/settings/status`, 'over');
    await Sync.setPath(`rooms/${code}/settings/result`, { reason: 'closed', aliensWin: false });
    await Sync.setPath(`roomIndex/${code}/status`, 'over').catch(() => {});
    await act('close-room', code);
  }

  /* back to a blank state: every other player, table, report and ban goes; the admin, the maps and the audit log stay.
     Logins cannot be removed from a browser, so a deleted player can register again with the same email. */
  async function nuke() {
    const d = T.admin || {}, me = Sync.uid;
    let n = { users: 0, rooms: 0 };
    for (const [code, r] of Object.entries(d.rooms || {})) { await Sync.delPath('roomIndex/' + code).catch(() => {}); await Sync.delPath('rooms/' + code).catch(() => {}); n.rooms++; }
    for (const [uid, u] of Object.entries(d.users || {})) {
      if (uid === me) { for (const k of ['rooms', 'games']) await Sync.delPath(`users/${uid}/${k}`).catch(() => {}); continue; }
      for (const code of Object.keys((u && u.rooms) || {})) {   // tables the index never saw
        try { if (await Sync.getPath(`rooms/${code}/settings/host`) === uid) await Sync.delPath('rooms/' + code); } catch (_) { /* noop */ }
      }
      const h = u && u.profile && u.profile.handle;
      await Sync.delPath(`users/${uid}`).catch(() => {});
      if (h) await Sync.delPath('handles/' + h).catch(() => {});
      n.users++;
    }
    for (const id of Object.keys(d.reports || {})) await Sync.delPath('reports/' + id).catch(() => {});
    for (const uid of Object.keys(d.bans || {})) await Sync.delPath('bans/' + uid).catch(() => {});
    await act('nuke', '', `${n.users} players, ${n.rooms} rooms`);
    toast(t('Done: {u} players and {r} rooms removed.', { u: n.users, r: n.rooms }));
  }
  async function act(action, target, detail) {
    try { await Sync.adminLog(action, target || '', detail || ''); } catch (_) { /* log is best effort */ }
    await load();
  }
  const actions = {
    adminopen() { S.stage = 'admin'; T.adminTab = 'users'; save(); load(); },
    admintab(b) { T.adminTab = b.dataset.k; renderFlow(); },
    adminpage(b) { const k = b.dataset.k; T.adminPage = Object.assign({}, T.adminPage, { [k]: Math.max(0, ((T.adminPage || {})[k] || 0) + Number(b.dataset.d)) }); renderFlow(); },
    bttoken() { const v = (($('#bt-token') || {}).value || '').trim(); if (!v) return; try { localStorage.setItem('eftaios.ghtoken', v); } catch (_) { /* noop */ } toast('Token saved'); renderFlow(); },
    async btsync() {
      const st = $('#bt-status'), say_ = m => { if (st) st.textContent = m; };
      if (!btToken()) return say_('Paste and save a GitHub token first.');
      say_('Reading the saved games…');
      try {
        const recs = Object.entries(await Sync.adminList('bottests')); let sent = 0, had = 0;
        for (const [id, r] of recs) { say_(`Sending ${sent + had + 1} of ${recs.length}…`); (await pushToRepo(id, r)) === 'sent' ? sent++ : had++; }
        say_(`Saved games online: ${recs.length}. Sent now: ${sent}. Already in the repo: ${had}.`);
      } catch (e) { say_('Failed: ' + (e.message || e)); }
    },
    btrate(b) { T.btRating = +b.dataset.n; document.querySelectorAll('[data-act=btrate]').forEach(x => x.setAttribute('aria-checked', String(+x.dataset.n === T.btRating))); },
    async btsend() {
      const x = T.botTest; if (!x) return;
      if (!T.btRating) return toast('Pick a rating from 1 to 5 first');
      const rec = { test: x.name, n: x.n, rating: T.btRating, notes: (($('#bt-notes') || {}).value || '').slice(0, 2000), at: Date.now(), map: T.map && T.map.id, game: JSON.stringify(Hot.dump()) };
      try {
        const id = uid(); await Sync.setPath('bottests/' + id, rec); T.btSent = true;
        let msg = 'Saved';
        if (btToken()) { try { await pushToRepo(id, rec); msg = 'Saved and sent to the repo'; } catch (e) { msg = 'Saved online; not sent to the repo (' + (e.message || e) + ')'; } }
        toast(msg); render();
      }
      catch (e) { saveMapFile('eftaios-bottest-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-'), JSON.stringify(rec), 'Could not save online. The log was downloaded instead.'); }
    },
    bottest(b) {
      const x = BOT_TESTS[+b.dataset.i]; if (!x) return;
      T.botTest = { name: x.name, n: +b.dataset.i + 1 }; T.btRating = 0; T.btSent = false;
      Hot.start(x.seats.map((s, i) => (i ? 'Bot ' + i : 'You')), 'galilei', 'ultimate', 'auto', x.seats.map(s => s.bot || ''), x.seats);
    },
    adminclose() { S.stage = 'welcome'; save(); renderFlow(); },
    adminrefresh() { load(); },
    async adminban(b) {
      const uid = b.dataset.u, on = b.dataset.b !== '1';
      if (uid === Sync.uid) { toast(t('You cannot do that to your own account.')); return; }
      await Sync.setPath(`bans/${uid}`, on ? true : null);
      await act(on ? 'ban' : 'unban', uid, b.dataset.h || '');
    },
    async adminwipe(b) {
      const uid = b.dataset.u, h = b.dataset.h;
      if (uid === Sync.uid) { toast(t('You cannot do that to your own account.')); return; }
      if (!confirm(t('Delete this player and all their data?'))) return;
      /* tables they host go with them, so no dead room is left behind */
      const mine = Object.keys((T.admin.users[uid] || {}).rooms || {});
      for (const code of mine) {
        try {
          const host = await Sync.getPath(`rooms/${code}/settings/host`);
          if (host === uid) { await Sync.delPath('roomIndex/' + code); await Sync.delPath('rooms/' + code); }
        } catch (e) { console.warn('wipe room', code, e); }
      }
      await Sync.delPath(`users/${uid}`);
      await Sync.delPath(`bans/${uid}`).catch(() => {});
      if (h) await Sync.delPath('handles/' + h).catch(() => {});
      toast(t('Data deleted. The login stays: the player can register again, or remove it with tools/admin.js delete.'));
      await act('delete-user', uid, h || '');
    },
    adminreset() {
      dlg.innerHTML = `<h2>${t('Send a password reset')}</h2><label class="field"><span>${t('Email')}</span><input id="ad-email" type="email"></label><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn primary" id="ad-go">${t('Send')}</button></div>`;
      if (!dlg.open) dlg.showModal();
      $('#d-no').onclick = closeDlg;
      $('#ad-go').onclick = async () => {
        const email = $('#ad-email').value.trim(); closeDlg();
        try { await Sync.resetPassword(email); toast(t('Reset sent.')); await act('reset', email); } catch (e) { toast(t('Could not send the reset.')); }
      };
    },
    admincloseroom() {
      dlg.innerHTML = `<h2>${t('Close a room')}</h2><label class="field"><span>${t('Table code')}</span><input id="ad-code" maxlength="8" autocapitalize="characters"></label><div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn primary" id="ad-go">${t('Close')}</button></div>`;
      if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg;
      $('#ad-go').onclick = async () => {
        const code = $('#ad-code').value.trim().toUpperCase(); if (!code) return;
        closeDlg(); await closeRoom(code);
      };
    },
    adminroomclose(b) { closeRoom(b.dataset.c); },
    adminnuke() {
      dlg.innerHTML = `<h2>${t('Nuke the app')}</h2><p>${t('Removes every other player, all tables, reports and bans. Your account, the maps and the audit log stay. This cannot be undone.')}</p>
        <label class="field"><span>${t('Type NUKE to confirm')}</span><input id="ad-nuke" autocapitalize="characters" autocomplete="off"></label>
        <div class="row"><button class="btn" id="d-no">${t('Cancel')}</button><button class="btn danger" id="ad-go" disabled>${t('Nuke')}</button></div>`;
      if (!dlg.open) dlg.showModal(); $('#d-no').onclick = closeDlg;
      $('#ad-nuke').oninput = () => { $('#ad-go').disabled = $('#ad-nuke').value.trim().toUpperCase() !== 'NUKE'; };
      $('#ad-go').onclick = async () => { closeDlg(); toast(t('Working…')); try { await nuke(); } catch (e) { toast(t('Could not finish: {e}', { e: String(e && (e.code || e.message) || e).slice(0, 60) })); } };
    },
    async adminsweep() {
      const cutoff = Date.now() - 7 * 86400000;
      const old = Object.entries(T.admin.rooms || {}).filter(([, r]) => r.status === 'over' || (r.at || 0) < cutoff).map(([c]) => c);
      if (!old.length) { toast(t('Nothing to delete.')); return; }
      if (!confirm(t('Delete closed rooms and rooms idle for over 7 days? This cannot be undone.') + ' (' + old.length + ')')) return;
      let n = 0;
      for (const code of old) {
        try { await Sync.delPath('roomIndex/' + code); await Sync.delPath('rooms/' + code); n++; } catch (e) { console.warn('sweep', code, e); }
      }
      toast(t('Deleted {n} rooms.', { n }));
      await act('sweep-rooms', '', String(n));
    },
    async adminmap(b) {
      await Sync.setPath(`pubmaps/${b.dataset.id}/hidden`, b.dataset.h === '1' ? null : true);
      await act(b.dataset.h === '1' ? 'restore-map' : 'hide-map', b.dataset.id);
    },
    async adminmapdel(b) {
      if (!confirm(t('Delete this map?'))) return;
      await Sync.delPath(`pubmaps/${b.dataset.id}`);
      await act('delete-map', b.dataset.id);
    },
    async adminreport(b) {
      await Sync.setPath(`reports/${b.dataset.id}/done`, true);
      await act('resolve-report', b.dataset.id);
    }
  };
  return { html, actions, load, ratePanel };
})();
window.Admin = Admin;
