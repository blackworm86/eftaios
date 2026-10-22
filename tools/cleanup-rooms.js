'use strict';
/* Remove closed tables after a retention window. Dry run by default.
     node tools/cleanup-rooms.js                  # show what would go (14 days)
     node tools/cleanup-rooms.js --days 7        # different window
     node tools/cleanup-rooms.js --apply         # actually delete
   A room is deleted only when its settings say "over" and its last known activity is
   older than the window. Rooms still in a lobby or in play are never touched. */
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');

const DB_URL = 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app';
const DAY = 86400000;
const argv = process.argv.slice(2);
const apply = argv.includes('--apply');
const di = argv.indexOf('--days');
const days = di >= 0 && Number(argv[di + 1]) > 0 ? Number(argv[di + 1]) : 14;
/* abandoned lobbies and games are never "over"; opt in with a longer window */
const si = argv.indexOf('--stale-live');
const staleDays = si >= 0 && Number(argv[si + 1]) > 0 ? Number(argv[si + 1]) : 0;

(async () => {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: DB_URL });
  const db = getDatabase();
  const [roomsSnap, indexSnap, usersSnap] = await Promise.all([
    db.ref('rooms').get(), db.ref('roomIndex').get(), db.ref('users').get()
  ]);
  const rooms = roomsSnap.val() || {}, index = indexSnap.val() || {}, users = usersSnap.val() || {};
  const cutoff = Date.now() - days * DAY;

  const victims = [], skipped = { live: 0, recent: 0, noDate: 0 }, staleLive = [];
  for (const [code, room] of Object.entries(rooms)) {
    const st = room && room.settings;
    const at = Number((index[code] && index[code].at) || room.created || 0);
    if (!st || st.status !== 'over') {
      if (staleDays && at && at < Date.now() - staleDays * DAY) staleLive.push({ code, at, reason: 'abandoned ' + (st ? st.status : 'unknown') });
      else skipped.live++;
      continue;
    }
    if (!at) { skipped.noDate++; continue; }
    if (at > cutoff) { skipped.recent++; continue; }
    victims.push({ code, at, reason: (st.result && st.result.reason) || 'ended' });
  }
  const orphanIndex = Object.keys(index).filter(code => !rooms[code]);

  const doomed = victims.concat(staleLive).sort((a, b) => a.at - b.at);
  console.log(`window ${days} days, cutoff ${new Date(cutoff).toISOString()}${staleDays ? `, abandoned after ${staleDays} days` : ''}`);
  for (const v of doomed) {
    console.log(`  ${v.code}  ${new Date(v.at).toISOString().slice(0, 10)}  ${v.reason}`);
  }
  console.log(`closed and old: ${victims.length}   abandoned: ${staleLive.length}   still live: ${skipped.live}   too recent: ${skipped.recent}   undated: ${skipped.noDate}   stale index entries: ${orphanIndex.length}`);
  if (!apply) { console.log('\ndry run — add --apply to delete'); process.exit(0); }

  let removed = 0, unindexed = 0;
  for (const v of doomed) {
    await db.ref('rooms/' + v.code).remove();
    await db.ref('roomIndex/' + v.code).remove().catch(() => {});
    removed++;
  }
  for (const code of orphanIndex) { await db.ref('roomIndex/' + code).remove().catch(() => {}); }
  const gone = new Set([...doomed.map(v => v.code), ...orphanIndex]);
  for (const [uid, u] of Object.entries(users)) {
    const list = (u && u.rooms) || {};
    for (const code of Object.keys(list)) {
      if (gone.has(code)) { await db.ref(`users/${uid}/rooms/${code}`).remove().catch(() => {}); unindexed++; }
    }
  }
  console.log(`removed ${removed} rooms, ${orphanIndex.length} stale index entries, ${unindexed} player-list references`);
  process.exit(0);
})().catch(e => { console.error(e.message); process.exit(1); });
