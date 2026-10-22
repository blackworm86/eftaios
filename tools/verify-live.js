'use strict';
/* Live verification of the published rules against the real Firebase project.
   Creates a throwaway account, hosts a table with a guest, then checks that a member can write
   and an outsider cannot. Cleans up after itself. Requires the service-account key. */
const B = require('./browser');
const { initializeApp, getApps, applicationDefault } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getDatabase } = require('firebase-admin/database');

const DB_URL = 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app';
const URL = 'http://localhost:8123/';
const EMAIL = `verify-${Date.now().toString(36)}@example.com`;
const PASS = 'verify-password-123';
let bad = 0;
const check = (ok, label, extra) => { console.log((ok ? 'ok   ' : 'FAIL ') + label + (extra ? '  ' + extra : '')); if (!ok) bad++; };

(async () => {
  if (!getApps().length) initializeApp({ credential: applicationDefault(), databaseURL: DB_URL });
  const auth = getAuth(), db = getDatabase();
  const user = await auth.createUser({ email: EMAIL, password: PASS });
  const b = await B.launch();
  const errs = [];
  const mk = async () => {
    const c = await b.browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block', locale: 'en-US' });
    const p = await c.newPage();
    p.on('pageerror', e => errs.push('page: ' + e.message));
    p.on('console', m => { const t = m.text(); if (/Content Security Policy|Refused to/i.test(t)) errs.push('csp: ' + t.slice(0, 160)); });
    return p;
  };
  try {
    const H = await mk();
    await H.goto(URL);
    await H.click('[data-act=account]');
    await H.fill('#a-email', EMAIL);
    await H.fill('#a-pass', PASS);
    await H.click('[data-act=authsignin]');
    await H.waitForSelector('#a-handle', { timeout: 20000 });
    await H.fill('#a-handle', 'verify' + Date.now().toString(36).slice(-4));
    await H.fill('#a-name', 'Verifier');
    await H.click('[data-act=accountcreate]');
    await H.waitForSelector('[data-act=hostsetup]', { timeout: 15000 });
    await H.click('[data-act=hostsetup]');
    await H.click('[data-act=hostcreate]');
    await H.waitForSelector('.roomcard b', { timeout: 20000 });
    const code = (await H.textContent('.roomcard b')).trim();
    check(/^[A-Z2-9]{6}$/.test(code), 'a new table gets a six-character code', code);

    const G = await mk();
    await G.goto(URL + '?room=' + code);
    await G.fill('#flow-name', 'Guest');
    await G.click('[data-act=joinroom]');
    await G.waitForSelector('.plist', { timeout: 15000 });
    await G.click('[data-act=ready]');
    await H.click('[data-act=ready]');
    await H.waitForFunction(() => !document.querySelector('.startbtn').disabled, null, { timeout: 10000 });
    await H.click('.startbtn');
    for (const p of [H, G]) { await p.waitForSelector('#app:not([hidden])', { timeout: 20000 }); await p.evaluate(() => closeDlg()); }

    // a member may write the public log
    const memberWrite = await G.evaluate(async code => {
      Sync.code = code;
      const e = { id: 'member-' + Date.now(), turn: 1, who: 'Guest', kind: 'info', text: 'member write', at: Date.now() };
      return Sync.set('log/' + e.id, e).then(() => 'ok').catch(e => String(e && e.code || e));
    }, code);
    check(memberWrite === 'ok', 'a seated player can write the public log', memberWrite);

    // an outsider may neither write the log nor take a seat mid-game
    const X = await mk();
    await X.goto(URL);
    const outsider = await X.evaluate(async code => {
      await Sync.ensure();
      Sync.code = code;
      const log = await Sync.set('log/outsider-' + Date.now(), { id: 'o', turn: 1, who: 'X', kind: 'info', text: 'x', at: Date.now() })
        .then(() => 'ok').catch(e => String(e && e.code || e));
      const seat = await Sync.setPath(`rooms/${code}/players/${Sync.uid}`, { name: 'X', ready: false })
        .then(() => 'ok').catch(e => String(e && e.code || e));
      return { log, seat, uid: Sync.uid };
    }, code);
    check(outsider.log !== 'ok' && /permission/i.test(outsider.log), 'an outsider cannot write the log', outsider.log);
    check(outsider.seat !== 'ok' && /permission/i.test(outsider.seat), 'an outsider cannot take a seat mid-game', outsider.seat);

    // a kick sticks: the table writes the marker, the removed seat can no longer rewrite itself
    const guestUid = await G.evaluate(() => Sync.uid);
    const kicked = await H.evaluate(async ({ code, uid }) => {
      Sync.code = code;
      const write = await Sync.setPath(`rooms/${code}/kicks/${uid}`, true).then(() => 'ok').catch(e => String(e && e.code || e));
      return write;
    }, { code, uid: guestUid });
    check(kicked === 'ok', 'the table can mark a seat as kicked', kicked);
    const afterKick = await G.evaluate(async ({ code, uid }) => ({
      seat: await Sync.setPath(`rooms/${code}/players/${uid}`, { name: 'Guest', ready: true }).then(() => 'ok').catch(e => String(e && e.code || e)),
      read: await Sync.get('kicks/' + uid).then(v => !!v).catch(() => false)
    }), { code, uid: guestUid });
    check(afterKick.seat !== 'ok' && /permission/i.test(afterKick.seat), 'a kicked seat cannot rewrite itself', afterKick.seat);
    check(afterKick.read === true, 'a kicked player can still read their own marker');

    check(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  } finally {
    await b.close().catch(() => {});
    const rooms = (await db.ref('rooms').get()).val() || {};
    for (const [code, r] of Object.entries(rooms)) {
      if (r && r.settings && r.settings.host === user.uid) await db.ref('rooms/' + code).remove();
    }
    await db.ref('users/' + user.uid).remove();
    await db.ref('roomIndex').orderByChild('host').equalTo(user.uid).get()
      .then(s => Promise.all(Object.keys(s.val() || {}).map(c => db.ref('roomIndex/' + c).remove()))).catch(() => {});
    await auth.deleteUser(user.uid).catch(() => {});
  }
  console.log(bad ? `\n${bad} check(s) failed` : '\nall live checks passed');
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
