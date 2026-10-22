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
  let admin;
  try { admin = require('firebase-admin'); }
  catch (e) { console.error('Install the Admin SDK first: npm install firebase-admin --no-save'); return process.exit(1); }
  if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.applicationDefault() });
  const auth = admin.auth();
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
  } else usage();
}
function usage() {
  console.log('node tools/admin.js claim|unclaim|reset|disable|enable|show <email>');
}
main().catch(e => { console.error(e.message || e); process.exit(1); });
