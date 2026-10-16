'use strict';
/* Shared table over Firebase Realtime Database.
   Shared: table settings, player names + ready flag, public announcements, hatch status.
   NEVER shared: a player's faction, position or route. */
(function () {
  const V = '10.12.2', B = `https://www.gstatic.com/firebasejs/${V}/`;
  const cfg = window.FIREBASE_CONFIG || {};
  const Sync = window.Sync = {
    enabled: !!(window.__FAKE_FB || (cfg.apiKey && cfg.databaseURL)),
    code: null, uid: null, status: 'off', settings: null, players: {}, h: {},
    on(h) { this.h = h; }
  };
  let fb = null, db = null, unsub = [];
  const setStatus = s => { Sync.status = s; Sync.h.status && Sync.h.status(s); };
  const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const path = (code, p) => fb.ref(db, `rooms/${code}/${p}`);

  async function init() {
    if (db) return;
    if (window.__FAKE_FB) { const f = await window.__FAKE_FB(); fb = f.fb; db = f.db; Sync.uid = f.uid; return; }
    const [app, auth, rtdb] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(B + f)));
    const a = app.initializeApp(cfg), au = auth.getAuth(a);
    await auth.signInAnonymously(au);
    Sync.uid = au.currentUser.uid; db = rtdb.getDatabase(a); fb = rtdb;
  }
  Sync.newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');

  function listen(code) {
    Sync.code = code; Sync.settings = null; Sync.players = {};
    const { onChildAdded, onValue, query, limitToLast } = fb;
    unsub.push(onValue(path(code, 'settings'), s => { Sync.settings = s.val(); Sync.h.settings && Sync.h.settings(Sync.settings); }));
    unsub.push(onValue(path(code, 'players'), s => { Sync.players = s.val() || {}; Sync.h.players && Sync.h.players(Sync.players); }));
    unsub.push(onChildAdded(query(path(code, 'log'), limitToLast(200)), s => Sync.h.entry && Sync.h.entry(s.val())));
    unsub.push(onValue(path(code, 'hatches'), s => Sync.h.hatches && Sync.h.hatches(s.val() || {})));
    unsub.push(onValue(fb.ref(db, '.info/connected'), s => setStatus(s.val() ? 'online' : 'offline')));
  }

  /* host: create a new table */
  Sync.create = async function (settings, me) {
    if (!Sync.enabled) return false;
    Sync.leave(true); setStatus('connecting');
    try {
      await init();
      let code = null;
      for (let i = 0; i < 6 && !code; i++) { const c = Sync.newCode(); if (!(await fb.get(path(c, 'created'))).exists()) code = c; }
      if (!code) { setStatus('error'); return false; }
      await fb.set(path(code, 'created'), fb.serverTimestamp());
      await fb.set(path(code, 'settings'), { map: settings.map, mode: settings.mode, host: Sync.uid, status: 'lobby', first: '' });
      await fb.set(path(code, 'players/' + Sync.uid), { name: me.name, ready: false });
      listen(code); Sync.h.joined && Sync.h.joined(code); return true;
    } catch (e) { console.warn(e); setStatus('error'); return false; }
  };

  /* guest (or returning player): join an existing table */
  Sync.join = async function (code, me) {
    if (!Sync.enabled) return false;
    code = clean(code);
    if (code.length < 4) { setStatus('bad-code'); return false; }
    Sync.leave(true); setStatus('connecting');
    try {
      await init();
      const st = (await fb.get(path(code, 'settings'))).val();
      if (!st) { setStatus('no-room'); return false; }
      const mine = (await fb.get(path(code, 'players/' + Sync.uid))).val();
      if (st.status === 'playing' && !mine) { setStatus('started'); return false; }
      if (mine) { if (me.name && me.name !== mine.name) await fb.update(path(code, 'players/' + Sync.uid), { name: me.name }); }
      else await fb.set(path(code, 'players/' + Sync.uid), { name: me.name, ready: false });
      listen(code); Sync.h.joined && Sync.h.joined(code); return true;
    } catch (e) { console.warn(e); setStatus('error'); return false; }
  };
  Sync.isHost = () => !!(Sync.settings && Sync.uid && Sync.settings.host === Sync.uid);
  Sync.updateSettings = p => Sync.code && fb.update(path(Sync.code, 'settings'), p).catch(console.warn);
  Sync.setMe = p => Sync.code && fb.update(path(Sync.code, 'players/' + Sync.uid), p).catch(console.warn);
  Sync.startGame = first => Sync.code && fb.update(path(Sync.code, 'settings'), { status: 'playing', first: first || '' }).catch(console.warn);
  Sync.leave = function (quiet) {
    unsub.forEach(f => f()); unsub = [];
    if (!quiet && Sync.code && db && Sync.settings && Sync.settings.status === 'lobby') fb.remove(path(Sync.code, 'players/' + Sync.uid)).catch(() => {});
    Sync.code = null; Sync.settings = null; Sync.players = {};
    if (!quiet) setStatus('off');
  };
  Sync.push = e => { if (Sync.code && db) fb.set(path(Sync.code, 'log/' + e.id), e).catch(console.warn); };
  Sync.setHatch = (n, v) => { if (Sync.code && db) fb.set(path(Sync.code, 'hatches/' + n), v ? 1 : 0).catch(console.warn); };
})();
