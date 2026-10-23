'use strict';
/* Rules tests against the Firebase emulator. Run with `npm run test:rules` (needs Java 11+).
   Each case is one boundary from database.rules.json; together they cover every write path. */
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { ref, set, get, update, remove } = require('firebase/database');

const RULES = fs.readFileSync(path.join(__dirname, '..', '..', 'database.rules.json'), 'utf8');
let pass = 0, fail = 0;
const ok = async (label, fn) => {
  try { await fn(); console.log('ok   ' + label); pass++; }
  catch (e) { console.log('FAIL ' + label + '  ' + String(e && e.message || e).split('\n')[0]); fail++; }
};
const log = (text = 'hello') => ({ id: 'l' + Date.now() + Math.random(), turn: 1, who: 'Guest', kind: 'info', text, at: Date.now() });

(async () => {
  const env = await initializeTestEnvironment({
    projectId: 'eftaios-rules',
    database: { rules: RULES, host: '127.0.0.1', port: 9000 }
  });
  try {
    await env.clearDatabase();
    await env.withSecurityRulesDisabled(async ctx => {
      const db = ctx.database(), s = (p, v) => set(ref(db, p), v);
      await s('users/host/profile', { handle: 'host', name: 'Host', created: 1 });
      await s('users/guest/profile', { handle: 'guest', name: 'Guest', created: 1 });
      await s('users/outsider/profile', { handle: 'outsider', name: 'Out', created: 1 });
      await s('users/banned/profile', { handle: 'banned', name: 'Banned', created: 1 });
      await s('users/kicked/profile', { handle: 'kicked', name: 'Kicked', created: 1 });
      await s('users/admin1/profile', { handle: 'admin1', name: 'Admin', created: 1 });
      await s('rooms/PLAY01/settings', { map: 'galilei', mode: 'ultimate', host: 'host', status: 'playing' });
      await s('rooms/PLAY01/players/host', { name: 'Host', ready: true });
      await s('rooms/PLAY01/players/guest', { name: 'Guest', ready: true });
      await s('rooms/PLAY01/secret/host', { role: 'alien' });
      await s('rooms/PLAY01/seats/host', { pos: 'A1', turn: 1, at: 1 });
      await s('rooms/PLAY01/seats/guest', { pos: 'H1', turn: 1, at: 1 });
      await s('rooms/PLAY01/attacks/a1', { by: 'host', sector: '01', at: 1 });
      await s('rooms/LOBBY1/settings', { map: 'galilei', mode: 'basic', host: 'host', status: 'lobby' });
      await s('rooms/LOBBY1/players/host', { name: 'Host', ready: true });
      await s('rooms/BAN001/settings', { map: 'galilei', mode: 'basic', host: 'host', status: 'playing' });
      await s('rooms/BAN001/players/host', { name: 'Host', ready: true });
      await s('rooms/BAN001/players/banned', { name: 'Banned', ready: true });
      await s('bans/banned', true);
      await s('rooms/KICK01/settings', { map: 'galilei', mode: 'basic', host: 'host', status: 'playing' });
      await s('rooms/KICK01/players/host', { name: 'Host', ready: true });
      await s('rooms/KICK01/players/kicked', { name: 'Kicked', ready: true });
      await s('rooms/KICK01/kicks/kicked', true);
      for (const c of ['DEL001', 'DEL002', 'DEL003', 'DEL004']) {
        await s(`rooms/${c}/settings`, { map: 'galilei', mode: 'basic', host: 'host', status: 'over', n: 1 });
        await s(`rooms/${c}/players/host`, { name: 'Host', ready: true });
        await s(`rooms/${c}/players/guest`, { name: 'Guest', ready: true });
        await s(`rooms/${c}/seats/guest`, { pos: 'H1', turn: 1, at: 1 });
        await s(`rooms/${c}/secret/guest`, { role: 'human' });
        await s(`rooms/${c}/attacks/a1`, { by: 'host', sector: '01', at: 1 });
        await s(`rooms/${c}/spots/s1`, { by: 'host', sector: '01', at: 1 });
        await s(`rooms/${c}/requests/r1`, { uid: 'guest', type: 'sector' });
        await s(`roomIndex/${c}`, { host: 'host', status: 'over', at: 1 });
      }
      await s('handles/ghost', 'guest');
      await s('handles/ghost2', 'guest');
      await s('adminlog/old', { action: 'created', at: 1, by: 'admin1' });
      /* lease, hostdata, log, hatches and turn on a live table; a stale lease; no lease; a table the host can reclaim */
      await s('rooms/PLAY01/lease', { uid: 'host', at: Date.now() });
      await s('rooms/PLAY01/hostdata', { roles: { host: 'alien', guest: 'human' } });
      await s('rooms/PLAY01/log/l0', log('first'));
      await s('rooms/PLAY01/hatches', { 1: 0 });
      await s('rooms/PLAY01/turn', { n: 1, idx: 0, uid: 'guest' });
      for (const [c, lease] of [['STALE1', { uid: 'host', at: 1 }], ['NOLSE1', null], ['TAKEN1', { uid: 'guest', at: Date.now() }], ['REL001', { uid: 'host', at: Date.now() }]]) {
        await s(`rooms/${c}/settings`, { map: 'galilei', mode: 'basic', host: 'host', status: 'playing' });
        await s(`rooms/${c}/players/host`, { name: 'Host', ready: true });
        await s(`rooms/${c}/players/guest`, { name: 'Guest', ready: true });
        if (lease) await s(`rooms/${c}/lease`, lease);
      }
      await s('rooms/REL001/log/l0', log('first'));
      await s('rooms/REL001/hatches', { 1: 0 });
      await s('rooms/RMT001/settings', { map: 'galilei', mode: 'basic', host: 'host', status: 'over', n: 1 });
      await s('rooms/RMT001/players/host', { name: 'Host', ready: true });
      await s('rooms/RMT001/players/guest', { name: 'Guest', ready: true });
      await s('rooms/RMT001/lease', { uid: 'host', at: Date.now() });
      await s('rooms/RMT001/turn', { n: 3, idx: 0, uid: 'host' });
      await s('rooms/RMT001/log/l0', log('x'));
      await s('rooms/RMT001/hatches', { 1: 1 });
      await s('rooms/RMT001/counts', { sector: { d: 1, x: 1 } });
      await s('rooms/RMT001/hostdata', { roles: { host: 'alien' } });
      await s('rooms/RMT001/secret/guest', { role: 'human' });
      await s('pubmaps/hid1', { owner: 'guest', name: 'Hidden', rows: ['..'], at: 1, hidden: true });
      await s('pubmaps/vis1', { owner: 'guest', name: 'Visible', rows: ['..'], at: 1 });
      await s('pubmaps/ban1', { owner: 'banned', name: 'Banned map', rows: ['..'], at: 1 });
    });

    const host = env.authenticatedContext('host').database();
    const guest = env.authenticatedContext('guest').database();
    const outsider = env.authenticatedContext('outsider').database();
    const banned = env.authenticatedContext('banned').database();
    const kicked = env.authenticatedContext('kicked').database();
    const admin = env.authenticatedContext('admin1', { admin: true }).database();
    const adminNo = env.authenticatedContext('outsider').database();

    await ok('a member can write the public log', () => assertSucceeds(set(ref(guest, 'rooms/PLAY01/log/l1'), log())));
    await ok('an outsider cannot write the public log', () => assertFails(set(ref(outsider, 'rooms/PLAY01/log/l2'), log())));
    await ok('an outsider cannot take a seat once playing', () => assertFails(set(ref(outsider, 'rooms/PLAY01/players/outsider'), { name: 'Out', ready: false })));
    await ok('an outsider can take a seat in the lobby', () => assertSucceeds(set(ref(outsider, 'rooms/LOBBY1/players/outsider'), { name: 'Out', ready: false })));
    await ok('a seat checkpoint is readable by its owner', () => assertSucceeds(get(ref(guest, 'rooms/PLAY01/seats/guest'))));
    await ok('another player cannot read a seat checkpoint', () => assertFails(get(ref(guest, 'rooms/PLAY01/seats/host'))));
    await ok('a player can update their own seat', () => assertSucceeds(update(ref(guest, 'rooms/PLAY01/seats/guest'), { at: 2 })));
    await ok('a player cannot update someone else\'s seat', () => assertFails(update(ref(guest, 'rooms/PLAY01/seats/host'), { at: 2 })));
    await ok('a role is readable only by its owner', async () => {
      await assertSucceeds(get(ref(host, 'rooms/PLAY01/secret/host')));
      await assertFails(get(ref(guest, 'rooms/PLAY01/secret/host')));
    });
    await ok('a member can answer an attack', () => assertSucceeds(set(ref(guest, 'rooms/PLAY01/attacks/a1/replies/guest'), { in: '01' })));
    await ok('an outsider cannot answer an attack', () => assertFails(set(ref(outsider, 'rooms/PLAY01/attacks/a1/replies/outsider'), { in: '01' })));
    await ok('a banned player cannot write the log', () => assertFails(set(ref(banned, 'rooms/BAN001/log/l3'), log())));
    await ok('a kicked player cannot rewrite their seat', () => assertFails(update(ref(kicked, 'rooms/KICK01/players/kicked'), { ready: false })));
    await ok('the host can mark a kick', () => assertSucceeds(set(ref(host, 'rooms/KICK01/kicks/another'), true)));
    await ok('the audit log accepts a new entry', () => assertSucceeds(set(ref(admin, 'adminlog/new1'), { action: 'closed', at: 2, by: 'admin1' })));
    await ok('the audit log refuses an update', () => assertFails(update(ref(admin, 'adminlog/old'), { action: 'changed' })));
    await ok('the audit log refuses a delete', () => assertFails(remove(ref(admin, 'adminlog/old'))));
    await ok('a non-admin cannot read the audit log', () => assertFails(get(ref(adminNo, 'adminlog'))));
    await ok('a registered player can create a table', () => assertSucceeds(set(ref(outsider, 'rooms/NEW001/created'), Date.now())));
    await ok('an account without a handle cannot create a table', () => assertFails(set(ref(env.authenticatedContext('noprofile').database(), 'rooms/NEW002/created'), Date.now())));
    await ok('the host can wipe a finished game\'s attacks, spots and requests', async () => {
      await assertSucceeds(remove(ref(host, 'rooms/DEL001/attacks')));
      await assertSucceeds(remove(ref(host, 'rooms/DEL001/spots')));
      await assertSucceeds(remove(ref(host, 'rooms/DEL001/requests')));
    });
    await ok('a guest cannot wipe attacks', () => assertFails(remove(ref(guest, 'rooms/DEL002/attacks'))));
    await ok('the host can start the next game of the table (counter, lobby)', () => assertSucceeds(update(ref(host, 'rooms/DEL001/settings'), { status: 'lobby', n: 2 })));
    await ok('the game counter must be a number', () => assertFails(update(ref(host, 'rooms/DEL001/settings'), { n: 'two' })));
    await ok('a guest cannot delete a table', () => assertFails(remove(ref(guest, 'rooms/DEL002'))));
    await ok('an outsider cannot delete a table', () => assertFails(remove(ref(outsider, 'rooms/DEL002'))));
    await ok('the host can delete the whole table, other players\' seats included', async () => {
      await assertSucceeds(remove(ref(host, 'roomIndex/DEL002')));
      await assertSucceeds(remove(ref(host, 'rooms/DEL002')));
    });
    await ok('a table cannot be emptied through its parent by a guest', () => assertFails(update(ref(guest, 'rooms'), { DEL003: null })));
    await ok('the admin can delete any table', () => assertSucceeds(remove(ref(admin, 'rooms/DEL003'))));
    await ok('the admin can delete a table\'s index entry', () => assertSucceeds(remove(ref(admin, 'roomIndex/DEL003'))));
    await ok('a table cannot be overwritten, only deleted', () => assertFails(set(ref(host, 'rooms/DEL004'), { settings: { map: 'x', mode: 'basic', host: 'host', status: 'lobby' } })));
    await ok('a player can clear their own seat checkpoint for the next game', () => assertSucceeds(remove(ref(guest, 'rooms/DEL004/seats/guest'))));
    await ok('an outsider cannot release someone else\'s handle', () => assertFails(remove(ref(outsider, 'handles/ghost'))));
    await ok('the admin can release a handle (nuke, delete player)', () => assertSucceeds(remove(ref(admin, 'handles/ghost'))));
    await ok('the admin cannot grab a handle for someone else', () => assertFails(set(ref(admin, 'handles/stolen'), 'guest')));
    await ok('the owner can still release their own handle', () => assertSucceeds(remove(ref(guest, 'handles/ghost2'))));

    /* the lease holder sees every role, so nobody may grab it from a live holder */
    const lease = (db, c) => set(ref(db, `rooms/${c}/lease`), { uid: db === guest ? 'guest' : 'host', at: Date.now() });
    await ok('a player cannot grab the lease from a live holder', () => assertFails(lease(guest, 'PLAY01')));
    await ok('a player cannot read the hostdata (roles, decks)', () => assertFails(get(ref(guest, 'rooms/PLAY01/hostdata'))));
    await ok('a player can take over a stale lease', () => assertSucceeds(lease(guest, 'STALE1')));
    await ok('a player can take over a table with no lease', () => assertSucceeds(lease(guest, 'NOLSE1')));
    await ok('the host can always take the lease back', () => assertSucceeds(lease(host, 'TAKEN1')));
    await ok('the holder can refresh their own lease', () => assertSucceeds(lease(host, 'PLAY01')));
    await ok('the holder can release their lease', () => assertSucceeds(remove(ref(host, 'rooms/REL001/lease'))));
    await ok('a banned player cannot take a stale lease', () => assertFails(set(ref(banned, 'rooms/BAN001/lease'), { uid: 'banned', at: Date.now() })));

    /* the public log and hatches: players add, only the table clears */
    await ok('a player cannot wipe the public log', () => assertFails(remove(ref(guest, 'rooms/PLAY01/log'))));
    await ok('a player cannot overwrite an old log entry', () => assertFails(set(ref(guest, 'rooms/PLAY01/log/l0'), log('forged'))));
    await ok('a player cannot delete an old log entry', () => assertFails(remove(ref(guest, 'rooms/PLAY01/log/l0'))));
    await ok('the table can clear the log for the next game', () => assertSucceeds(remove(ref(host, 'rooms/REL001/log'))));
    await ok('a player can still flip one hatch', () => assertSucceeds(set(ref(guest, 'rooms/PLAY01/hatches/2'), 1)));
    await ok('a player cannot wipe all hatches', () => assertFails(remove(ref(guest, 'rooms/PLAY01/hatches'))));
    await ok('the table can reset the hatches', () => assertSucceeds(remove(ref(host, 'rooms/REL001/hatches'))));

    await ok('the host can start the next game: one update clears turn, log, hatches, counts and hostdata', () => assertSucceeds(update(ref(host, 'rooms/RMT001'), {
      'secret/guest': null, turn: null, log: null, hatches: null, counts: null, attacks: null, spots: null, requests: null, hostdata: null,
      'settings/status': 'lobby', 'settings/result': null, 'settings/first': '', 'settings/n': 2 })));

    /* published maps: moderation sticks, bans apply, size is bounded */
    const map = (owner, rows, extra) => Object.assign({ owner, name: 'M', rows, at: Date.now() }, extra);
    const rows = n => Array.from({ length: n }, () => '.'.repeat(23));
    await ok('the owner cannot republish a hidden map', () => assertFails(set(ref(guest, 'pubmaps/hid1'), map('guest', ['..']))));
    await ok('the owner cannot clear the hidden flag', () => assertFails(remove(ref(guest, 'pubmaps/hid1/hidden'))));
    await ok('the owner cannot delete a hidden map', () => assertFails(remove(ref(guest, 'pubmaps/hid1'))));
    await ok('the owner can republish a visible map', () => assertSucceeds(set(ref(guest, 'pubmaps/vis1'), map('guest', rows(14)))));
    await ok('the owner cannot hide or unhide their own map', () => assertFails(set(ref(guest, 'pubmaps/vis1/hidden'), true)));
    await ok('anyone can publish a new map', () => assertSucceeds(set(ref(outsider, 'pubmaps/new1'), map('outsider', rows(14)))));
    await ok('a map with 101 rows is refused', () => assertFails(set(ref(outsider, 'pubmaps/big1'), map('outsider', rows(101)))));
    await ok('a banned player cannot publish a map', () => assertFails(set(ref(banned, 'pubmaps/ban2'), map('banned', rows(14)))));
    await ok('a banned player cannot edit their old map', () => assertFails(set(ref(banned, 'pubmaps/ban1'), map('banned', rows(14)))));
    await ok('the admin can hide a map', () => assertSucceeds(set(ref(admin, 'pubmaps/vis1/hidden'), true)));
    await ok('the admin can restore a map', () => assertSucceeds(remove(ref(admin, 'pubmaps/vis1/hidden'))));
    await ok('the admin can delete a hidden map', () => assertSucceeds(remove(ref(admin, 'pubmaps/hid1'))));

    /* turn order: the player on turn may pass it on, but only one turn at a time, to someone seated */
    await ok('the player on turn cannot jump the turn counter', () => assertFails(set(ref(guest, 'rooms/PLAY01/turn'), { n: 9, idx: 1, uid: 'host' })));
    await ok('the player on turn cannot hand it to a stranger', () => assertFails(set(ref(guest, 'rooms/PLAY01/turn'), { n: 1, idx: 1, uid: 'nobody' })));
    await ok('the player on turn can pass it to the next player', () => assertSucceeds(set(ref(guest, 'rooms/PLAY01/turn'), { n: 2, idx: 1, uid: 'host' })));
    await ok('a player not on turn cannot move the turn', () => assertFails(set(ref(guest, 'rooms/PLAY01/turn'), { n: 2, idx: 0, uid: 'guest' })));
  } finally {
    await env.cleanup();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
