'use strict';
/* Shared table over Firebase Realtime Database.
   Shared: table settings, player names + ready flag, public announcements, hatch status.
   NEVER shared: a player's faction, position or route.
   Accounts: a guest is an anonymous Firebase user; a registered player links an email or Google
   credential to the same uid, so rooms, vault and stats survive registration. */
(function () {
  const V = '10.12.2', B = `https://www.gstatic.com/firebasejs/${V}/`;
  const cfg = window.FIREBASE_CONFIG || {};
  const Sync = window.Sync = {
    gen: 0, enabled: !!(window.__FAKE_FB || (cfg.apiKey && cfg.databaseURL)),
    code: null, uid: null, status: 'off', settings: null, players: {}, turn: null, h: {},
    user: null, profile: null, isAdmin: false, registered: false, authError: '',
    on(h) { this.h = h; }
  };
  let fb = null, db = null, auth = null, unsub = [], ready = null, joining = false;
  const authListeners = [];
  const setStatus = s => { Sync.status = s; Sync.h.status && Sync.h.status(s); };
  const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const path = (code, p) => fb.ref(db, `rooms/${code}/${p}`);
  const at = p => fb.ref(db, p);

  Sync.ref = p => (db ? at(p) : null);

  /* ---------------- auth ---------------- */
  function fireAuth(mod) { return mod; }
  async function ensure() {
    if (db) return;
    if (!ready) ready = (async () => {
      if (window.__FAKE_FB) { const f = await window.__FAKE_FB(); fb = f.fb; db = f.db; auth = f.auth || null; Sync.uid = f.uid; Sync.registered = true; Sync.profile = { handle: 'tester', name: 'Tester' }; Sync.authReady = true; return; }
      const [app, au, rtdb] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(B + f)));
      const a = app.initializeApp(cfg);
      auth = fireAuth(au.getAuth(a));
      db = rtdb.getDatabase(a); fb = rtdb;
      au.onAuthStateChanged(auth, u => { handleUser(u).catch(e => console.warn(e)); });
      if (!auth.currentUser) await au.signInAnonymously(auth).catch(e => { Sync.authError = String(e && e.code || e); });
      Sync.authReady = true;
    })().finally(() => { ready = null; });
    await ready;
  }
  Sync.ensure = ensure;

  async function handleUser(u) {
    const prev = Sync.uid;
    Sync.user = u || null; Sync.uid = u ? u.uid : null;
    Sync.isAdmin = false; Sync.profile = null; Sync.registered = false;
    if (u) {
      try { const t = await u.getIdTokenResult(); Sync.isAdmin = !!(t.claims && t.claims.admin); } catch (_) { /* token not ready */ }
      Sync.profile = await readProfile(u.uid);
      Sync.registered = !!(Sync.profile && Sync.profile.handle);
      try { if (Sync.registered) localStorage.setItem('eftaios.account', '1'); } catch (_) { /* noop */ }
    }
    authListeners.forEach(fn => { try { fn(Sync.user); } catch (_) { /* noop */ } });
    if (Sync.h.auth) Sync.h.auth();
    if (prev && prev !== Sync.uid && Sync.code && !joining) {
      const code = Sync.code, name = (Sync.profile && Sync.profile.name) || 'Player';
      joining = true; Sync.leave(true); Sync.join(code, { name }).catch(() => {}).finally(() => { joining = false; });
    }
  }
  Sync.onAuth = fn => { authListeners.push(fn); fn(Sync.user); };
  const fbAuth = () => import(B + 'firebase-auth.js');

  Sync.signInGoogle = async () => {
    await ensure(); const au = await fbAuth();
    const p = new au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    return au.signInWithPopup(auth, p);
  };
  Sync.signInEmail = async (email, pass) => { await ensure(); const au = await fbAuth(); return au.signInWithEmailAndPassword(auth, email, pass); };
  Sync.signUpEmail = async (email, pass, name) => {
    await ensure(); const au = await fbAuth();
    const r = await au.createUserWithEmailAndPassword(auth, email, pass);
    if (name) await au.updateProfile(r.user, { displayName: name }).catch(() => {});
    return r;
  };
  Sync.resetPassword = async email => { await ensure(); const au = await fbAuth(); return au.sendPasswordResetEmail(auth, email); };
  Sync.sendLink = async email => {
    await ensure(); const au = await fbAuth();
    await au.sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
    try { localStorage.setItem('eftaios.linkEmail', email); } catch (_) { /* noop */ }
  };
  Sync.linkEmailPending = () => { try { return !!localStorage.getItem('eftaios.linkEmail'); } catch (_) { return false; } };
  Sync.isLink = () => /[?&]oobCode=/.test(location.search) && /mode=signIn/.test(location.search);
  Sync.completeLink = async email => {
    await ensure(); const au = await fbAuth();
    email = email || (() => { try { return localStorage.getItem('eftaios.linkEmail'); } catch (_) { return ''; } })();
    if (!email) throw new Error('email-required');
    const r = await au.signInWithEmailLink(auth, email, location.href);
    try { localStorage.removeItem('eftaios.linkEmail'); } catch (_) { /* noop */ }
    try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ }
    return r;
  };
  Sync.signOut = async () => { await ensure(); const au = await fbAuth(); await au.signOut(auth); try { localStorage.removeItem('eftaios.account'); } catch (_) { /* noop */ } };
  Sync.deleteSelf = async () => {
    await ensure();
    const uid = Sync.uid, prof = Sync.profile;
    const rooms = (await fb.get(at(`users/${uid}/rooms`))).val() || {};
    for (const code of Object.keys(rooms)) {
      try {
        const st = (await fb.get(at(`rooms/${code}/settings`))).val();
        if (st && st.host === uid) await fb.update(at(`rooms/${code}/settings`), { status: 'over', result: { reason: 'closed', aliensWin: false } });
      } catch (_) { /* room already gone */ }
    }
    await fb.remove(at(`users/${uid}`)).catch(() => {});
    if (prof && prof.handle) await fb.remove(at('handles/' + prof.handle)).catch(() => {});
    const au = await fbAuth(); await au.deleteUser(auth.currentUser);
    try { localStorage.removeItem('eftaios.account'); } catch (_) { /* noop */ }
  };
  Sync.getPath = async p => { await ensure(); return (await fb.get(at(p))).val(); };

  function readProfile(uid) {
    return fb.get(at(`users/${uid}/profile`)).then(s => s.val() || null).catch(() => null);
  }
  Sync.readProfile = readProfile;
  Sync.saveProfile = async ({ handle, name }) => {
    await ensure();
    handle = String(handle || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 16);
    if (!/^[a-z0-9_]{3,16}$/.test(handle)) throw new Error('bad-handle');
    name = String(name || '').trim().slice(0, 20) || handle;
    const cur = (await fb.get(at('handles/' + handle))).val();
    if (cur && cur !== Sync.uid) throw new Error('taken');
    await fb.set(at('handles/' + handle), Sync.uid);
    const old = (await fb.get(at(`users/${Sync.uid}/profile`))).val() || {};
    await fb.set(at(`users/${Sync.uid}/profile`), Object.assign({}, old, { handle, name, created: old.created || Date.now() }));
    Sync.profile = Object.assign({}, old, { handle, name }); Sync.registered = true;
    return Sync.profile;
  };
  Sync.renameMe = async name => {
    if (!Sync.registered) return;
    const p = Object.assign({}, Sync.profile, { name: String(name || '').trim().slice(0, 20) || Sync.profile.handle });
    await fb.set(at(`users/${Sync.uid}/profile`), p); Sync.profile = p;
  };

  /* ---------------- per-player room index ---------------- */
  Sync.indexRoom = async (code, role) => {
    if (!Sync.registered || !Sync.uid) return;
    try {
      await fb.set(at(`users/${Sync.uid}/rooms/${code}`), { role: role || 'member', at: Date.now() });
      const all = (await fb.get(at(`users/${Sync.uid}/rooms`))).val() || {};
      const keep = Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 20);
      const drop = Object.keys(all).filter(k => !keep.some(([c]) => c === k));
      await Promise.all(drop.map(k => fb.remove(at(`users/${Sync.uid}/rooms/${k}`))));
    } catch (e) { console.warn('room index', e); }
  };
  Sync.myRooms = async () => {
    await ensure(); if (!Sync.uid || !Sync.registered) return [];
    const all = (await fb.get(at(`users/${Sync.uid}/rooms`))).val() || {};
    return Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
  };
  Sync.watchRooms = cb => { if (!db) return () => {}; return fb.onValue(at(`users/${Sync.uid}/rooms`), s => cb(Object.entries(s.val() || {}))); };

  /* ---------------- history and stats ---------------- */
  Sync.recordGame = async g => {
    if (!Sync.registered || !Sync.uid || !Sync.code) return;
    try {
      await fb.set(at(`users/${Sync.uid}/games/${Sync.code}`), Object.assign({ at: Date.now() }, g));
      const all = (await fb.get(at(`users/${Sync.uid}/games`))).val() || {};
      const keep = Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 20);
      await Promise.all(Object.keys(all).filter(k => !keep.some(([c]) => c === k)).map(k => fb.remove(at(`users/${Sync.uid}/games/${k}`))));
      await fb.runTransaction(at(`users/${Sync.uid}/stats`), cur => {
        const s = cur.val() || {};
        const add = (k, n) => { if (n) s[k] = (s[k] || 0) + n; };
        add('games', 1); add('wins', g.result === 'win' ? 1 : 0); add('losses', g.result === 'loss' ? 1 : 0);
        add('escapes', g.escaped ? 1 : 0); add('kills', g.kills || 0); add('humans', g.role === 'human' ? 1 : 0); add('aliens', g.role === 'alien' ? 1 : 0);
        if (g.result === 'win') { s.streak = (s.streak || 0) + 1; s.bestStreak = Math.max(s.bestStreak || 0, s.streak); }
        else { s.streak = 0; }
        s.last = Date.now();
        return s;
      });
    } catch (e) { console.warn('record game', e); }
  };
  Sync.readStats = async uid => { await ensure(); return (await fb.get(at(`users/${(uid || Sync.uid)}/stats`))).val() || {}; };

  /* ---------------- maps ---------------- */
  Sync.myMaps = async () => {
    await ensure(); if (!Sync.uid || !Sync.registered) return {};
    return (await fb.get(at(`users/${Sync.uid}/maps`))).val() || {};
  };
  Sync.saveMapOnline = async rec => {
    if (!Sync.registered || !Sync.uid) return;
    await Sync.setPath(`users/${Sync.uid}/maps/${rec.id}`, { name: rec.name, author: rec.author || '', rows: rec.rows_data, odd: rec.oddColumnsLower !== false, at: Date.now() });
  };
  Sync.deleteMapOnline = async id => { if (Sync.registered) await Sync.delPath(`users/${Sync.uid}/maps/${id}`).catch(() => {}); };
  Sync.publishMap = async rec => {
    await ensure();
    if (!Sync.registered) throw new Error('account');
    await Sync.setPath(`pubmaps/${rec.id}`, { owner: Sync.uid, name: rec.name, author: (Sync.profile && Sync.profile.handle) || '', rows: rec.rows_data, odd: rec.oddColumnsLower !== false, at: Date.now() });
    await Sync.setPath(`users/${Sync.uid}/maps/${rec.id}/published`, rec.id).catch(() => {});
  };
  Sync.pubMaps = async () => { await ensure(); return (await fb.get(at('pubmaps'))).val() || {}; };

  /* ---------------- table ---------------- */
  Sync.newCode = () => Array.from({ length: 4 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');

  function listen(code) {
    Sync.code = code; Sync.gen++; Sync.settings = null; Sync.players = {};
    const { onChildAdded, onValue, query, limitToLast } = fb;
    unsub.push(onValue(path(code, 'settings'), s => { Sync.settings = s.val(); Sync.h.settings && Sync.h.settings(Sync.settings); }));
    unsub.push(onValue(path(code, 'players'), s => { Sync.players = s.val() || {}; Sync.h.players && Sync.h.players(Sync.players); }));
    unsub.push(onChildAdded(query(path(code, 'log'), limitToLast(200)), s => Sync.h.entry && Sync.h.entry(s.val())));
    unsub.push(onValue(path(code, 'turn'), s => { Sync.turn = s.val(); Sync.h.turn && Sync.h.turn(Sync.turn); }));
    unsub.push(onValue(path(code, 'counts'), s => Sync.h.counts && Sync.h.counts(s.val() || {})));
    unsub.push(onValue(path(code, 'hatches'), s => Sync.h.hatches && Sync.h.hatches(s.val() || {})));
    unsub.push(onValue(path(code, 'lease'), s => { Sync.lease = s.val() || null; Sync.h.lease && Sync.h.lease(Sync.lease); }));
    unsub.push(onValue(at('.info/connected'), s => setStatus(s.val() ? 'online' : 'offline')));
  }

  /* host: create a new table */
  Sync.create = async function (settings, me) {
    if (!Sync.enabled) return false;
    await ensure();
    Sync.leave(true); setStatus('connecting');
    try {
      let code = null;
      for (let i = 0; i < 6 && !code; i++) { const c = Sync.newCode(); if (!(await fb.get(path(c, 'created'))).exists()) code = c; }
      if (!code) { setStatus('error'); return false; }
      await fb.set(path(code, 'created'), fb.serverTimestamp());
      await fb.set(path(code, 'settings'), Object.assign({ map: settings.map, mode: settings.mode, host: Sync.uid, status: 'lobby', first: '', order: [Sync.uid] }, settings.customMap ? { customMap: settings.customMap } : {}));
      await fb.set(path(code, 'players/' + Sync.uid), { name: me.name, ready: false, guest: !Sync.registered });
      await fb.set(path(code, 'lease'), { uid: Sync.uid, at: Date.now() }).catch(() => {});
      listen(code); Sync.h.joined && Sync.h.joined(code); Sync.indexRoom(code, 'host'); return true;
    } catch (e) { console.warn(e); Sync.lastError = String(e && (e.code || e.message) || e).slice(0, 80); setStatus(/permission/i.test(Sync.lastError) ? 'rules' : 'error'); return false; }
  };

  /* guest (or returning player): join an existing table */
  Sync.join = async function (code, me) {
    if (!Sync.enabled) return false;
    code = clean(code);
    if (code.length < 4) { setStatus('bad-code'); return false; }
    await ensure();
    Sync.leave(true); setStatus('connecting');
    try {
      const st = (await fb.get(path(code, 'settings'))).val();
      if (!st) { setStatus('no-room'); return false; }
      const mine = (await fb.get(path(code, 'players/' + Sync.uid))).val();
      if (st.status === 'over' && st.result && st.result.reason === 'closed') { setStatus('closed'); return false; }
      if (mine && mine.out === 'kicked') { setStatus('kicked'); return false; }
      if (st.status === 'playing' && !mine) { setStatus('started'); return false; }
      if (!mine && Object.keys((await fb.get(path(code, 'players'))).val() || {}).length >= 8) { setStatus('full'); return false; }
      if (mine) { if (me.name && me.name !== mine.name) await fb.update(path(code, 'players/' + Sync.uid), { name: me.name }); }
      else await fb.set(path(code, 'players/' + Sync.uid), { name: me.name, ready: false, guest: !Sync.registered });
      listen(code); Sync.h.joined && Sync.h.joined(code); Sync.indexRoom(code, st.host === Sync.uid ? 'host' : 'member'); return true;
    } catch (e) { console.warn(e); Sync.lastError = String(e && (e.code || e.message) || e).slice(0, 80); setStatus(/permission/i.test(Sync.lastError) ? 'rules' : 'error'); return false; }
  };
  Sync.isHost = () => !!(Sync.settings && Sync.uid && Sync.settings.host === Sync.uid);
  /* the device currently running the bots: the creator unless the lease moved */
  Sync.holder = () => (Sync.lease && Sync.lease.uid) || (Sync.settings && Sync.settings.host) || null;
  Sync.isHolder = () => !!Sync.uid && Sync.holder() === Sync.uid;
  Sync.claimHost = async () => { if (Sync.code) { await fb.set(path(Sync.code, 'lease'), { uid: Sync.uid, at: Date.now() }); } };
  Sync.releaseHost = () => { if (Sync.code && Sync.isHolder()) fb.remove(path(Sync.code, 'lease')).catch(() => {}); };
  Sync.updateSettings = p => Sync.code && fb.update(path(Sync.code, 'settings'), p).catch(e => { rulesError(e); });
  Sync.setMeP = p => fb.update(path(Sync.code, 'players/' + Sync.uid), p);
  Sync.setMe = p => Sync.code && fb.update(path(Sync.code, 'players/' + Sync.uid), p).catch(console.warn);
  Sync.startGame = async (first, order) => {
    if (!Sync.code) return;
    try { await fb.set(path(Sync.code, 'turn'), { n: 1, idx: 0, uid: order[0] }); await fb.update(path(Sync.code, 'settings'), { status: 'playing', first: first || '' }); } catch (e) { console.warn(e); }
  };
  Sync.setTurn = v => Sync.code && fb.set(path(Sync.code, 'turn'), v).catch(console.warn);
  /* generic helpers, paths relative to the table */
  Sync.get = async p => (await fb.get(path(Sync.code, p))).val();
  Sync.set = (p, v) => fb.set(path(Sync.code, p), v);
  Sync.upd = (p, o) => fb.update(path(Sync.code, p), o);
  Sync.del = p => fb.remove(path(Sync.code, p));
  Sync.watch = (p, cb) => { const u = fb.onValue(path(Sync.code, p), s => cb(s.val())); unsub.push(u); return u; };
  Sync.watchChild = (p, cb) => { const u = fb.onChildAdded(fb.query(path(Sync.code, p)), s => cb(s.val(), s.key)); unsub.push(u); return u; };
  Sync.leave = function (quiet) {
    unsub.forEach(f => f()); unsub = [];
    if (!quiet && Sync.code && db && Sync.settings && Sync.settings.status === 'lobby') fb.remove(path(Sync.code, 'players/' + Sync.uid)).catch(() => {});
    Sync.code = null; Sync.settings = null; Sync.players = {}; Sync.turn = null; Sync.lease = null;
    if (!quiet) setStatus('off');
  };
  Sync.push = e => { if (Sync.code && db) fb.set(path(Sync.code, 'log/' + e.id), Object.assign({ by: Sync.uid }, e)).catch(console.warn); };
  Sync.setHatch = (n, v) => { if (Sync.code && db) fb.set(path(Sync.code, 'hatches/' + n), v ? 1 : 0).catch(console.warn); };

  /* ---------------- admin ---------------- */
  Sync.adminList = async node => { await ensure(); return (await fb.get(at(node))).val() || {}; };
  Sync.setPath = async (p, v) => { await ensure(); return fb.set(at(p), v); };
  Sync.delPath = async p => { await ensure(); return fb.remove(at(p)); };
  Sync.adminLog = (action, target, detail) => { if (!db) return; fb.push(at('adminlog'), { action, target: target || '', detail: detail || '', by: Sync.uid, at: Date.now() }).catch(() => {}); };
  Sync.report = (kind, target, text) => { if (!db) return Promise.reject(new Error('offline')); return fb.push(at('reports'), { kind, target, text: String(text || '').slice(0, 200), by: Sync.uid, at: Date.now() }); };

  function rulesError(e) {
    const code = String(e && (e.code || e.message) || e);
    if (/permission/i.test(code)) setStatus('rules');
  }
})();
