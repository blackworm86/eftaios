'use strict';
/* Optional shared-table sync over Firebase Realtime Database.
   Only PUBLIC data is shared (announcements + hatch status). Positions and routes never leave the device. */
(function () {
  const V = '10.12.2', B = `https://www.gstatic.com/firebasejs/${V}/`;
  const cfg = window.FIREBASE_CONFIG || {};
  const Sync = window.Sync = {
    enabled: !!(cfg.apiKey && cfg.databaseURL), code: null, status: 'off', h: {},
    on(h) { this.h = h; }
  };
  let fb = null, db = null, unsub = [];
  const set = s => { Sync.status = s; Sync.h.status && Sync.h.status(s); };
  async function init() {
    if (db) return;
    const [app, auth, rtdb] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(B + f)));
    const a = app.initializeApp(cfg);
    await auth.signInAnonymously(auth.getAuth(a));
    db = rtdb.getDatabase(a); fb = rtdb;
  }
  Sync.newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');
  Sync.join = async function (code, create) {
    if (!Sync.enabled) return;
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (code.length < 4) { set('bad-code'); return; }
    Sync.leave(true); set('connecting');
    try {
      await init();
      const { ref, onChildAdded, onValue, query, limitToLast, set: put, get, serverTimestamp } = fb;
      const root = ref(db, 'rooms/' + code);
      if (create) await put(ref(db, `rooms/${code}/created`), serverTimestamp());
      else if (!(await get(ref(db, `rooms/${code}/created`))).exists()) { set('no-room'); return; }
      Sync.code = code;
      unsub.push(onChildAdded(query(ref(db, `rooms/${code}/log`), limitToLast(200)), s => Sync.h.entry && Sync.h.entry(s.val())));
      unsub.push(onValue(ref(db, `rooms/${code}/hatches`), s => Sync.h.hatches && Sync.h.hatches(s.val() || {})));
      unsub.push(onValue(ref(db, '.info/connected'), s => set(s.val() ? 'online' : 'offline')));
      Sync.h.joined && Sync.h.joined(code);
    } catch (e) { console.warn(e); set('error'); }
  };
  Sync.leave = function (quiet) { unsub.forEach(f => f()); unsub = []; Sync.code = null; if (!quiet) set('off'); };
  Sync.push = e => { if (Sync.code && db) fb.set(fb.ref(db, `rooms/${Sync.code}/log/${e.id}`), e).catch(console.warn); };
  Sync.setHatch = (n, v) => { if (Sync.code && db) fb.set(fb.ref(db, `rooms/${Sync.code}/hatches/${n}`), v ? 1 : 0).catch(console.warn); };
})();
