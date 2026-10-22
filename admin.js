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
    const tabs = `<div class="seg adm-tabs" role="tablist">${[['users', 'Players'], ['rooms', 'Rooms'], ['maps', 'Maps'], ['reports', 'Reports'], ['audit', 'Audit']].map(([k, l]) => `<button role="tab" data-act="admintab" data-k="${k}" aria-checked="${tab() === k}">${t(l)}</button>`).join('')}</div>`;
    if (!T.admin) return `${head}${tabs}<p class="dim">${t('Loading…')}</p>`;
    if (T.admin.error) return `${head}${tabs}<p class="dim">${t('Could not load the admin data')}: ${esc(T.admin.error)}</p>`;
    const nuke = tab() === 'audit' ? `<div class="row two"><button class="btn danger" data-act="adminnuke">${t('Nuke the app')}</button></div>` : '';
    return `${head}${tabs}${T.admin[tab() === 'audit' ? 'log' : tab()] === undefined ? '' : roster(tab())}${nuke}`;
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
  return { html, actions, load };
})();
window.Admin = Admin;
