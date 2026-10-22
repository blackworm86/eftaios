'use strict';
/* Blank slate: remove every test account and everything connected to it. Dry run by default.
     node tools/reset-all.js                 # show what would go
     node tools/reset-all.js --apply         # do it
     node tools/reset-all.js --apply --keep-maps   # leave maps (private vaults and published) alone
     node tools/reset-all.js --apply --wipe-admins # remove the admin account too (you must claim again)
   Removed: every login except the admin (guests included), users/*, handles, rooms, roomIndex, reports,
   bans and the audit log. The admin keeps the login, the admin claim, the profile and the handle, so you
   can sign in at once; its games, statistics and table list are cleared.
   Needs the service-account key: set GOOGLE_APPLICATION_CREDENTIALS. It bypasses every database rule. */
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const DB_URL = 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app';
const argv = process.argv.slice(2);
const apply = argv.includes('--apply'), keepMaps = argv.includes('--keep-maps'), wipeAdmins = argv.includes('--wipe-admins');

(async () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.'); process.exit(1); }
  if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: DB_URL });
  const auth = getAuth(), db = getDatabase();

  const accounts = [];
  let page;
  do { const r = await auth.listUsers(1000, page && page.pageToken); accounts.push(...r.users); page = r.pageToken ? { pageToken: r.pageToken } : null; } while (page);
  const admins = accounts.filter(u => u.customClaims && u.customClaims.admin);
  const keep = new Set(wipeAdmins ? [] : admins.map(u => u.uid));
  const doomed = accounts.filter(u => !keep.has(u.uid));
  if (!keep.size && !wipeAdmins) { console.error('No admin account found: refusing to wipe everything. Use --wipe-admins if that is what you want.'); process.exit(1); }

  const [users, handles, rooms, index, reports, bans, log, pub] = await Promise.all(['users', 'handles', 'rooms', 'roomIndex', 'reports', 'bans', 'adminlog', 'pubmaps'].map(n => db.ref(n).get().then(s => s.val() || {})));
  const count = o => Object.keys(o).length;
  console.log(`logins: ${accounts.length} (keeping ${keep.size}: ${admins.filter(u => keep.has(u.uid)).map(u => u.email || u.uid).join(', ') || 'none'}), removing ${doomed.length}`);
  console.log(`database: users ${count(users)}, handles ${count(handles)}, rooms ${count(rooms)}, index ${count(index)}, reports ${count(reports)}, bans ${count(bans)}, audit ${count(log)}, published maps ${count(pub)}${keepMaps ? ' (maps kept)' : ''}`);
  if (!apply) { console.log('\ndry run: add --apply to delete'); process.exit(0); }

  const upd = {};
  for (const uid of Object.keys(users)) {
    if (!keep.has(uid)) { upd['users/' + uid] = null; continue; }
    for (const k of ['rooms', 'games', 'stats'].concat(keepMaps ? [] : ['maps'])) upd[`users/${uid}/${k}`] = null;
  }
  for (const [h, uid] of Object.entries(handles)) if (!keep.has(uid)) upd['handles/' + h] = null;
  if (!keepMaps) for (const [id, m] of Object.entries(pub)) upd['pubmaps/' + id] = null; else for (const [id, m] of Object.entries(pub)) if (!keep.has(m && m.owner)) upd['pubmaps/' + id] = null;
  Object.assign(upd, { rooms: null, roomIndex: null, reports: null, bans: null, adminlog: null });
  await db.ref().update(upd);
  let removed = 0;
  for (let i = 0; i < doomed.length; i += 1000) { const r = await auth.deleteUsers(doomed.slice(i, i + 1000).map(u => u.uid)); removed += r.successCount; if (r.failureCount) console.warn('failed:', r.errors.map(e => e.error.message).join('; ')); }
  console.log(`done: database cleared, ${removed} logins removed`);
  process.exit(0);
})().catch(e => { console.error(e.message || e); process.exit(1); });
