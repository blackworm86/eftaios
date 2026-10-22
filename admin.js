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
      const [users, maps, reports, log, bans] = await Promise.all([
        Sync.adminList('users'), Sync.adminList('pubmaps'), Sync.adminList('reports'), Sync.adminList('adminlog'), Sync.adminList('bans')
      ]);
      T.admin = { users, maps, reports, log, bans };
    } catch (e) { T.admin = { error: String(e && (e.code || e.message) || e).slice(0, 80) }; }
    renderFlow();
  }
  Sync.adminLoad = load;

  function html() {
    if (!Sync.isAdmin) return `<header class="fhead"><button class="icon-btn" data-act="adminclose" aria-label="${t('Back')}">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'}</button><h2>${t('Admin')}</h2></header><p class="dim">${t('This account is not an administrator.')}</p>`;
    const head = `<header class="fhead"><button class="icon-btn" data-act="adminclose" aria-label="${t('Back')}">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'}</button><h2>${t('Admin')}</h2></header>`;
    const tabs = `<div class="seg" role="tablist">${[['users', 'Players'], ['maps', 'Maps'], ['reports', 'Reports'], ['audit', 'Audit']].map(([k, l]) => `<button role="tab" data-act="admintab" data-k="${k}" aria-checked="${tab() === k}">${t(l)}</button>`).join('')}</div>`;
    if (!T.admin) return `${head}${tabs}<p class="dim">${t('Loading…')}</p>`;
    if (T.admin.error) return `${head}${tabs}<p class="dim">${t('Could not load the admin data')}: ${esc(T.admin.error)}</p>`;
    return `${head}${tabs}${T.admin[tab()] === undefined ? '' : roster(tab())}`;
  }
  function roster(which) {
    const d = T.admin;
    if (which === 'users') {
      const list = Object.entries(d.users || {}).map(([uid, u]) => {
        const p = (u && u.profile) || {}, banned = !!(d.bans || {})[uid], me = uid === Sync.uid;
        const rooms = Object.keys((u && u.rooms) || {}).length;
        const actions = me
          ? `<span class="pst">${t('This is you')}</span>`
          : `<button class="btn" data-act="adminban" data-u="${esc(uid)}" data-h="${esc(p.handle || '')}" data-b="${banned ? 1 : 0}">${banned ? t('Unban') : t('Ban')}</button>
          <button class="btn danger" data-act="adminwipe" data-u="${esc(uid)}" data-h="${esc(p.handle || '')}">${t('Delete data')}</button>`;
        return `<li><span class="pname">${esc(p.name || '(no profile)')}<small>@${esc(p.handle || '')} · ${uid.slice(0, 8)}…</small></span>
          <span class="pst">${rooms} ${t('rooms')}${banned ? ' · ' + t('banned') : ''}</span>${actions}</li>`;
      }).join('');
      return `<ul class="plist">${list || `<li>${t('No players yet.')}</li>`}</ul>
        <div class="row two"><button class="btn" data-act="adminreset">${t('Send a password reset')}</button><button class="btn" data-act="admincloseroom">${t('Close a room')}</button></div>`;
    }
    if (which === 'maps') {
      const list = Object.entries(d.maps || {}).map(([id, m]) => `<li><span class="pname">${esc(m.name)}<small>${esc(m.author || '')} · ${m.rows ? m.rows.length : 0}×${m.rows && m.rows[0] ? m.rows[0].length : 0}</small></span>
        <span class="pst">${m.hidden ? t('hidden') : t('published')}</span>
        <button class="btn" data-act="adminmap" data-id="${esc(id)}" data-h="${m.hidden ? 1 : 0}">${m.hidden ? t('Restore') : t('Hide')}</button>
        <button class="btn danger" data-act="adminmapdel" data-id="${esc(id)}">${t('Delete')}</button></li>`).join('');
      return `<ul class="plist">${list || `<li>${t('No published maps.')}</li>`}</ul>`;
    }
    if (which === 'reports') {
      const list = Object.entries(d.reports || {}).filter(([, r]) => !r.done).map(([id, r]) => `<li><span class="pname">${esc(r.kind)}: ${esc(r.target)}<small>${esc(r.text || '')}</small></span>
        <span class="pst">${when(r.at)}</span><button class="btn" data-act="adminreport" data-id="${esc(id)}">${t('Resolve')}</button></li>`).join('');
      return `<ul class="plist">${list || `<li>${t('No open reports.')}</li>`}</ul>`;
    }
    const list = Object.entries(d.log || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 60)
      .map(([, e]) => `<li><span class="pname">${esc(e.action)} <small>${esc(e.target || '')} ${esc(e.detail || '')}</small></span><span class="pst">${when(e.at)}</span></li>`).join('');
    return `<ul class="plist">${list || `<li>${t('Nothing logged yet.')}</li>`}</ul>`;
  }

  async function act(action, target, detail) {
    try { await Sync.adminLog(action, target || '', detail || ''); } catch (_) { /* log is best effort */ }
    await load();
  }
  const actions = {
    adminopen() { S.stage = 'admin'; T.adminTab = 'users'; save(); load(); },
    admintab(b) { T.adminTab = b.dataset.k; renderFlow(); },
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
      await Sync.delPath(`users/${uid}`);
      await Sync.delPath(`bans/${uid}`).catch(() => {});
      if (h) await Sync.delPath('handles/' + h).catch(() => {});
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
        closeDlg();
        await Sync.setPath(`rooms/${code}/settings/status`, 'over');
        await Sync.setPath(`rooms/${code}/settings/result`, { reason: 'closed', aliensWin: false });
        await act('close-room', code);
      };
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
