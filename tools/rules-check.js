'use strict';
/* Structural checks on database.rules.json, the cheap guard before the emulator suite exists.
   These assert the invariants the threat model depends on, not Firebase's own semantics. */
const fs = require('fs');
const path = require('path');

const rules = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'database.rules.json'), 'utf8')).rules;
const room = rules.rooms.$room;
const has = (v, s) => typeof v === 'string' && v.includes(s);
let bad = 0;
const check = (ok, label) => { console.log((ok ? 'ok   ' : 'FAIL ') + label); if (!ok) bad++; };

const member = "child('players').child(auth.uid).exists()";
check(has(room.log.$id['.write'], member) && has(room.log.$id['.write'], '!data.exists()'), 'only members can add to the public log, and never overwrite an entry');
check(has(room.log['.write'], '!newData.exists()') && !has(room.log['.write'], member), 'a member cannot wipe the public log');
check(has(room.hatches.$n['.write'], member) && !has(room.hatches['.write'], member), 'only members can flip a hatch, and none can wipe them');
check(has(room.lease['.write'], 'now - ') && has(room.lease['.write'], '!data.exists()'), 'the lease cannot be taken from a live holder');
check(has(rules.pubmaps.$id['.write'], "child('hidden')") && has(rules.pubmaps.$id['.write'], "bans"), 'an owner cannot change the hidden flag, and a banned player cannot publish');
check(has(room.attacks.$id['.write'], member), 'only members can start an attack');
check(has(room.attacks.$id.replies.$uid['.write'], member), 'only members can answer an attack');
check(has(room.spots.$id['.write'], member), 'only members can start a Spotlight');
check(has(room.spots.$id.replies.$uid['.write'], member), 'only members can answer a Spotlight');
check(has(room.requests.$id['.write'], member), 'only members can ask the host for a card');
check(has(room.players.$uid['.write'], "data.exists()") && has(room.players.$uid['.write'], "!== 'playing'"),
  'a new seat cannot be taken in a game already in progress');
check(has(rules.adminlog.$id['.write'], '!data.exists()'), 'the audit log is append-only');
check(has(rules.adminlog.$id['.validate'], "newData.child('by').val() === auth.uid"), 'audit entries are attributed to their writer');
check(has(room.seats.$uid['.read'], 'auth.uid === $uid') && has(room.seats.$uid['.write'], 'auth.uid === $uid'),
  'a seat checkpoint is readable and writable only by its owner');
check(has(room.secret.$uid['.read'], 'auth.uid === $uid'), 'a role is readable only by its owner');
check(has(room.journal.$uid['.read'], 'auth.uid === $uid') && has(room.journal.$uid['.write'], 'auth.uid === $uid'), 'a private journal is readable and writable only by its owner');
check(has(rules.bans.$uid['.write'], 'auth.token.admin === true'), 'only the admin can ban');
check(has(rules.adminlog['.read'], 'auth.token.admin === true'), 'only the admin can read the audit log');
check(has(rules.rooms.$room.created['.write'], "child('profile/handle').exists()"), 'only a registered player can create a table');
check(has(rules.rooms.$room.created['.write'], "val() !== true"), 'a banned player cannot create a table');
check(has(room.players.$uid['.write'], "child('kicks')"), 'a kicked player cannot rewrite their seat');
check(has(room.kicks.$uid['.write'], "settings/host") && has(room.kicks.$uid['.write'], "lease/uid"), 'only the table can kick a player');
check(has(room.players.$uid['.write'], "val() !== true"), 'a banned player cannot write a seat');

console.log(bad ? `\n${bad} rule invariant(s) broken` : '\nall rule invariants hold');
process.exitCode = bad ? 1 : 0;
