'use strict';
/* Owner-only admin tool. Needs a Firebase service account key and the Admin SDK:
     npm install firebase-admin --no-save
     set GOOGLE_APPLICATION_CREDENTIALS=C:\path\service-account.json
   Usage:
     node tools/admin.js claim <email>        grant the admin claim
     node tools/admin.js unclaim <email>      revoke it
     node tools/admin.js reset <email>        print a password-reset link
     node tools/admin.js disable <email>      disable the account
     node tools/admin.js enable <email>
     node tools/admin.js show <email>         print uid, providers, disabled
     node tools/admin.js delete <email>       delete the login and all of the player's data (rooms they host, games, maps, handle)
   The key bypasses every database rule: keep it outside the repository. */
const fs = require('fs');
const path = require('path');

async function main() {
  const [cmd, email] = process.argv.slice(2);
  if (!cmd || !email) return usage();
  const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.');
    return process.exit(1);
  }
  let initializeApp, getApps, applicationDefault, getAuth;
  try {
    ({ initializeApp, getApps, applicationDefault } = require('firebase-admin/app'));
    ({ getAuth } = require('firebase-admin/auth'));
  } catch (e) { console.error('Install the Admin SDK first: npm install firebase-admin --no-save'); return process.exit(1); }
  if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app' });
  const auth = getAuth();
  const user = await auth.getUserByEmail(email).catch(() => null);
  if (!user) { console.error('No account for ' + email); return process.exit(1); }

  if (cmd === 'claim' || cmd === 'unclaim') {
    const claims = Object.assign({}, user.customClaims || {});
    if (cmd === 'claim') claims.admin = true; else delete claims.admin;
    await auth.setCustomUserClaims(user.uid, claims);
    console.log((cmd === 'claim' ? 'Admin granted to ' : 'Admin revoked from ') + email + ' (' + user.uid + ')');
  } else if (cmd === 'reset') {
    console.log(await auth.generatePasswordResetLink(email));
  } else if (cmd === 'disable' || cmd === 'enable') {
    await auth.updateUser(user.uid, { disabled: cmd === 'disable' });
    console.log(email + ' ' + (cmd === 'disable' ? 'disabled' : 'enabled'));
  } else if (cmd === 'show') {
    console.log(JSON.stringify({ uid: user.uid, email: user.email, disabled: user.disabled, providers: user.providerData.map(p => p.providerId), admin: !!(user.customClaims && user.customClaims.admin) }, null, 2));
  } else if (cmd === 'delete') {
    if (user.customClaims && user.customClaims.admin) { console.error('That is an admin. Run unclaim first.'); return process.exit(1); }
    const { getDatabase } = require('firebase-admin/database');
    const db = getDatabase();
    const uid = user.uid, profile = (await db.ref(`users/${uid}/profile`).get()).val() || {};
    const upd = { ['users/' + uid]: null, ['bans/' + uid]: null };
    if (profile.handle) upd['handles/' + profile.handle] = null;
    const mine = (await db.ref(`users/${uid}/rooms`).get()).val() || {};
    for (const code of Object.keys(mine)) {
      const host = (await db.ref(`rooms/${code}/settings/host`).get()).val();
      if (host === uid) { upd['rooms/' + code] = null; upd['roomIndex/' + code] = null; }
    }
    for (const [id, m] of Object.entries((await db.ref('pubmaps').get()).val() || {})) if (m && m.owner === uid) upd['pubmaps/' + id] = null;
    await db.ref().update(upd);
    await auth.deleteUser(uid);
    console.log('Deleted ' + email + ' (' + uid + ') and their data.');
  } else usage();
}
function usage() {
  console.log('node tools/admin.js claim|unclaim|reset|disable|enable|show|delete <email>');
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
