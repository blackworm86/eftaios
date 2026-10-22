'use strict';
/* Remove old anonymous (guest) logins. Dry run by default.
     node tools/cleanup-guests.js                 # guests not seen for 30 days
     node tools/cleanup-guests.js --days 7        # different window
     node tools/cleanup-guests.js --apply         # actually delete
   A guest is a login with no email and no sign-in provider. Registered players and the admin are never touched.
   A guest that sat at a table keeps its seat for as long as its login is newer than the window.
   Needs the service-account key: set GOOGLE_APPLICATION_CREDENTIALS. */
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');

const DAY = 86400000;
const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const di = argv.indexOf('--days');
const days = di >= 0 && Number(argv[di + 1]) >= 0 ? Number(argv[di + 1]) : 30;

(async () => {
  if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) { console.error('Set GOOGLE_APPLICATION_CREDENTIALS to a service-account JSON file.'); process.exit(1); }
  if (!getApps().length) initializeApp({ credential: applicationDefault() });
  const auth = getAuth(), cutoff = Date.now() - days * DAY;
  const all = []; let page;
  do { const r = await auth.listUsers(1000, page); all.push(...r.users); page = r.pageToken; } while (page);
  const guests = all.filter(u => !u.email && !u.providerData.length && !(u.customClaims && u.customClaims.admin));
  const old = guests.filter(u => Date.parse(u.metadata.lastSignInTime || u.metadata.creationTime) < cutoff);
  console.log(`logins ${all.length}, guests ${guests.length}, guests unseen for ${days}+ days ${old.length}`);
  if (!apply) { console.log('\ndry run: add --apply to delete'); process.exit(0); }
  let removed = 0;
  for (let i = 0; i < old.length; i += 1000) { const r = await auth.deleteUsers(old.slice(i, i + 1000).map(u => u.uid)); removed += r.successCount; }
  console.log(`removed ${removed} guest logins`);
  process.exit(0);
})().catch(e => { console.error(e.message || e); process.exit(1); });
