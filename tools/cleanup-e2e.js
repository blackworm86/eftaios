'use strict';
/* Remove the throwaway accounts, profiles and rooms created by the end-to-end checks. */
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

(async () => {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app' });
  const auth = getAuth(), db = getDatabase();
  const usersNode = (await db.ref('users').get()).val() || {};
  const doomed = Object.entries(usersNode).filter(([, u]) => {
    const p = (u && u.profile) || {};
    return /^e2e/i.test(p.handle || '') || /^E2E/i.test(p.name || '');
  }).map(([uid]) => uid);
  const rooms = (await db.ref('rooms').get()).val() || {};
  let closed = 0;
  for (const [code, r] of Object.entries(rooms)) {
    const host = r && r.settings && r.settings.host;
    if (doomed.includes(host)) { await db.ref('rooms/' + code).remove(); closed++; }
  }
  for (const uid of doomed) {
    const p = (usersNode[uid] && usersNode[uid].profile) || {};
    await db.ref('users/' + uid).remove();
    await db.ref('bans/' + uid).remove();
    if (p.handle) await db.ref('handles/' + p.handle).remove();
    await auth.deleteUser(uid).catch(() => {});
  }
  // auth accounts whose profile is gone (previous cleanup left them)
  const list = await auth.listUsers(1000);
  let orphan = 0;
  for (const u of list.users) if (!usersNode[u.uid] && /^e2e-/.test(u.email || '')) { await auth.deleteUser(u.uid).catch(() => {}); orphan++; }
  console.log('profiles removed', doomed.length, 'rooms removed', closed, 'orphan auth removed', orphan);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
