'use strict';
/* Copy the bot test ratings and logs the admin saved in the app (Admin > Bot tests) into tests/play-logs/, commit and push to main.
     node tools/pull-bot-tests.js            # new records only
     node tools/pull-bot-tests.js --no-push  # write and commit, do not push
   Uses the same Google credentials as the cleanup scripts. Records stay in the database; files already written are skipped. */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const DB_URL = 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app';
const DIR = path.join(__dirname, '..', 'tests', 'play-logs');

(async () => {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: DB_URL });
  const recs = (await getDatabase().ref('bottests').get()).val() || {};
  fs.mkdirSync(DIR, { recursive: true });
  let n = 0;
  for (const [id, r] of Object.entries(recs)) {
    const file = path.join(DIR, `${new Date(r.at).toISOString().slice(0, 16).replace(/[:T]/g, '-')}-test${r.n || 0}-${id}.json`);
    if (fs.existsSync(file)) continue;
    fs.writeFileSync(file, JSON.stringify({ test: r.test, rating: r.rating, notes: r.notes || '', at: new Date(r.at).toISOString(), map: r.map, game: JSON.parse(r.game) }, null, 1));
    n++;
  }
  console.log(`${n} new record(s) of ${Object.keys(recs).length} written to tests/play-logs/`);
  if (!n) return;
  const git = (...a) => execFileSync('git', a, { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  git('add', 'tests/play-logs');
  git('commit', '-m', `Bot test ratings and logs (${n})`);
  if (!process.argv.includes('--no-push')) git('push', 'origin', 'main');
})().catch(e => { console.error(e); process.exit(1); });
