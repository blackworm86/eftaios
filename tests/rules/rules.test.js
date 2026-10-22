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
  } finally {
    await env.cleanup();
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
