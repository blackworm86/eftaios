'use strict';
/* Shared table over Firebase Realtime Database.
   Shared: table settings, player names + ready flag, public announcements, hatch status.
   NEVER shared: a player's faction, position or route.
   Accounts: a guest is an anonymous Firebase user; a registered player links an email or Google
   credential to the same uid, so rooms, vault and stats survive registration. */
(function () {
  const V = '10.12.2', B = `https://www.gstatic.com/firebasejs/${V}/`;
  /* A browser driven by a script (the tests, the simulator, screenshots: headless, or on localhost) never talks to the real database: its games would be
     stored as if people had played them. Tests use the fake database (window.__FAKE_FB); a tool that really must use the live one sets window.__REAL_FB first. */
  const scripted = navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent) || ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname);
  const cfg = (scripted && !window.__FAKE_FB && !window.__REAL_FB) ? {} : (window.FIREBASE_CONFIG || {});
  const Sync = window.Sync = {
    gen: 0, enabled: !!(window.__FAKE_FB || (cfg.apiKey && cfg.databaseURL)),
    skew: 0, now() { return Date.now() + this.skew; },
    /* this tab or device, as opposed to the account: one account can be open in several places, and only one may run the bots */
    dev: (() => { try { return sessionStorage.eftaiosDev || (sessionStorage.eftaiosDev = Math.random().toString(36).slice(2, 10)); } catch (_) { return Math.random().toString(36).slice(2, 10); } })(),
    code: null, uid: null, status: 'off', settings: null, players: {}, turn: null, h: {},
    user: null, profile: null, isAdmin: false, registered: false, authError: '',
    on(h) { this.h = h; }
  };
  let fb = null, db = null, auth = null, unsub = [], ready = null, joining = false;
  const authListeners = [];
  let authSettlers = [], banUnsub = null, profUnsub = null, AU = null;
  const setStatus = s => { Sync.status = s; Sync.h.status && Sync.h.status(s); };
  const clean = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const path = (code, p) => fb.ref(db, `rooms/${code}/${p}`);
  const at = p => fb.ref(db, p);

  Sync.ref = p => (db ? at(p) : null);

  /* The database SDK marks "websocket failed" in storage before every connection and clears it only once the link is healthy.
     A phone that sleeps or switches network at the wrong moment leaves the mark, and every later visit starts with long
     polling instead; if that is blocked too the app never reaches the database, and only clearing the site data helped.
     Start each visit with a clean mark so the websocket is tried first. */
  try { for (const st of [localStorage, sessionStorage]) st.removeItem('firebase:previous_websocket_failure'); } catch (_) { /* storage unavailable */ }
  /* ---------------- auth ---------------- */
  function fireAuth(mod) { return mod; }
  /* a guest login is made only when something needs one (a table), never for signing in:
     signing in replaces the guest, so every attempt used to leave an orphan login behind */
  let guestP = null;
  function guest() {
    if (window.__FAKE_FB || !auth || auth.currentUser) return Promise.resolve();
    return guestP || (guestP = fbAuth().then(au => au.signInAnonymously(auth)).catch(e => { Sync.authError = String(e && e.code || e); }).finally(() => { guestP = null; }));
  }
  async function ensure(noGuest) {
    if (db) { if (!noGuest) await guest(); return; }
    if (!ready) ready = (async () => {
      if (window.__FAKE_FB) { const f = await window.__FAKE_FB(); fb = f.fb; db = f.db; auth = f.auth || null; Sync.uid = f.uid; Sync.registered = true; Sync.profile = { handle: 'tester', name: 'Tester' }; Sync.authReady = true; return; }
      const [app, au, rtdb] = await Promise.all(['firebase-app.js', 'firebase-auth.js', 'firebase-database.js'].map(f => import(B + f)));
      const a = app.initializeApp(cfg);
      /* No popup/redirect helper at start-up: with it, Safari (storage partitioned for the sign-in domain) and in-app browsers can
         leave the session check hanging, and then no sign-in works at all. The helper is passed only to the Google calls. */
      AU = au;
      auth = fireAuth(au.initializeAuth(a, { persistence: [au.indexedDBLocalPersistence, au.browserLocalPersistence, au.browserSessionPersistence] }));
      db = rtdb.getDatabase(a); fb = rtdb;
      /* the gap between this device's clock and Firebase's, so time stamps compare across devices and with the rules' `now` */
      rtdb.onValue(rtdb.ref(db, '.info/serverTimeOffset'), s => { Sync.skew = s.val() || 0; });
      try { if (sessionStorage.getItem('eftaios.redirect')) { sessionStorage.removeItem('eftaios.redirect'); au.getRedirectResult(auth, au.browserPopupRedirectResolver).catch(e => console.warn(e)); } } catch (_) { /* no session storage */ }
      au.onAuthStateChanged(auth, u => { handleUser(u).catch(e => console.warn(e)); });
      /* the persisted session is restored asynchronously: wait for it, or a reload would replace a
         signed-in player with a fresh anonymous guest and lose the account */
      try { await Promise.race([auth.authStateReady(), new Promise(r => setTimeout(r, 6000))]); } catch (_) { /* older SDK */ }   // a stuck storage must not block every sign-in
      Sync.authReady = true;
    })().finally(() => { ready = null; });
    await ready;
    if (!noGuest) await guest();
  }
  Sync.ensure = ensure;

  async function handleUser(u) {
    const prev = Sync.uid;
    if (banUnsub) { try { banUnsub(); } catch (_) { /* noop */ } banUnsub = null; }
    if (profUnsub) { try { profUnsub(); } catch (_) { /* noop */ } profUnsub = null; }
    Sync.authSettled = false;
    Sync.user = u || null; Sync.uid = u ? u.uid : null;
    Sync.isAdmin = false; Sync.profile = null; Sync.registered = false;
    if (u) {
      try { const t = await u.getIdTokenResult(); Sync.isAdmin = !!(t.claims && t.claims.admin); } catch (_) { /* token not ready */ }
      Sync.profile = await readProfileSure(u);
      if (Sync.user !== u) return;   // signed out or switched while the profile was loading
      if (!u.isAnonymous && !(Sync.profile && Sync.profile.handle) && !Sync.profileError) Sync.profile = await restoreProfile(u) || Sync.profile;
      watchProfile(u);
      Sync.registered = !!(Sync.profile && Sync.profile.handle);
      try { Sync.banned = !!(await fb.get(at(`bans/${u.uid}`))).val(); } catch (_) { Sync.banned = false; }
      if (Sync.banned) { Sync.authError = 'banned'; try { const au = await fbAuth(); await au.signOut(auth); } catch (_) { /* noop */ } return; }
      Sync.authError = '';
      try { if (Sync.registered) localStorage.setItem('eftaios.account', '1'); } catch (_) { /* noop */ }
      /* a ban can also arrive while the tab is open: drop the session instead of playing on */
      try {
        banUnsub = fb.onValue(at(`bans/${u.uid}`), s => {
          if (s.val() !== true) return;
          Sync.banned = true; Sync.authError = 'banned';
          try { if (window.toast) window.toast(window.t ? t('Your account has been suspended.') : 'Account suspended.'); } catch (_) { /* noop */ }
          try { if (window.resetToWelcome) resetToWelcome('welcome'); } catch (_) { /* noop */ }
          fbAuth().then(au => au.signOut(auth)).catch(() => {});
        });
      } catch (_) { /* rules or offline */ }
    }
    authListeners.forEach(fn => { try { fn(Sync.user); } catch (_) { /* noop */ } });
    if (Sync.h.auth) Sync.h.auth();
    if (prev && prev !== Sync.uid && Sync.code && !joining) {
      const code = Sync.code, name = (Sync.profile && Sync.profile.name) || 'Player';
      joining = true; Sync.leave(true); Sync.join(code, { name }).catch(() => {}).finally(() => { joining = false; });
    }
    Sync.authSettled = true;
    authSettlers.splice(0).forEach(fn => { try { fn(); } catch (_) { /* noop */ } });
  }
  Sync.onAuth = fn => { authListeners.push(fn); fn(Sync.user); };
  const CLOSE_GRACE = 4000;   // lets the other devices see the close before the table disappears
  const fbAuth = () => import(B + 'firebase-auth.js');

  /* a sign-in that fails never changes the user, so nothing would ever mark auth as settled again */
  const attempt = async fn => { Sync.authSettled = false; try { return await fn(); } catch (e) { Sync.authSettled = true; throw e; } };
  /* Safari only opens the Google window while the tap is still being handled: nothing may be awaited before signInWithPopup
     once the SDK is loaded (it is, from the first screen on) */
  Sync.signInGoogle = () => {
    const go = au => {
      Sync.authSettled = false;
      const p = new au.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
      return au.signInWithPopup(auth, p, au.browserPopupRedirectResolver).catch(e => {
        Sync.authSettled = true;
        /* the popup can fail on mobile browsers and installed apps: fall back to a full-page redirect */
        if (!/internal-error|popup-blocked|operation-not-supported/.test(String(e && e.code))) throw e;
        try { sessionStorage.setItem('eftaios.redirect', '1'); } catch (_) { /* noop */ }
        return au.signInWithRedirect(auth, p, au.browserPopupRedirectResolver);
      });
    };
    if (AU && auth) return go(AU);
    return ensure(true).then(() => go(AU));
  };
  /* load the sign-in helper's hidden frame while the player reads the sign-in screen, so the Google window opens at once on the tap */
  let preloaded = false;
  Sync.preloadSignIn = () => ensure(true).then(() => { if (preloaded || !AU || !auth) return; preloaded = true; AU.getRedirectResult(auth, AU.browserPopupRedirectResolver).catch(() => {}); }).catch(() => {});
  /* Google refuses to sign in from the browser built into other apps (WhatsApp, Instagram...): say so before the player taps */
  Sync.inAppBrowser = () => { const ua = navigator.userAgent || ''; return /FBAN|FBAV|Instagram|Line\/|MicroMessenger|Snapchat|; wv\)/.test(ua) || (/iPhone|iPad|iPod/.test(ua) && !/Safari\//.test(ua)); };
  Sync.signInEmail = async (email, pass) => { await ensure(true); const au = await fbAuth(); return attempt(() => au.signInWithEmailAndPassword(auth, email, pass)); };
  Sync.signUpEmail = async (email, pass, name) => {
    await ensure(true); const au = await fbAuth();
    const r = await attempt(() => au.createUserWithEmailAndPassword(auth, email, pass));
    if (name) await au.updateProfile(r.user, { displayName: name }).catch(() => {});
    return r;
  };
  Sync.resetPassword = async email => { await ensure(true); const au = await fbAuth(); return au.sendPasswordResetEmail(auth, email); };
  Sync.sendLink = async email => {
    await ensure(true); const au = await fbAuth();
    await au.sendSignInLinkToEmail(auth, email, { url: location.origin + location.pathname, handleCodeInApp: true });
    try { localStorage.setItem('eftaios.linkEmail', email); } catch (_) { /* noop */ }
  };
  Sync.linkEmailPending = () => { try { return !!localStorage.getItem('eftaios.linkEmail'); } catch (_) { return false; } };
  Sync.isLink = () => /[?&]oobCode=/.test(location.search) && /mode=signIn/.test(location.search);
  Sync.completeLink = async email => {
    await ensure(true); const au = await fbAuth();
    email = email || (() => { try { return localStorage.getItem('eftaios.linkEmail'); } catch (_) { return ''; } })();
    if (!email) throw new Error('email-required');
    const r = await attempt(() => au.signInWithEmailLink(auth, email, location.href));
    try { localStorage.removeItem('eftaios.linkEmail'); } catch (_) { /* noop */ }
    try { history.replaceState(null, '', location.pathname); } catch (_) { /* noop */ }
    return r;
  };
  Sync.signOut = async () => { await ensure(); const au = await fbAuth(); await au.signOut(auth); try { localStorage.removeItem('eftaios.account'); } catch (_) { /* noop */ } };
  /* wait until the profile and claims for the new session have been read */
  Sync.awaitAuth = () => new Promise(res => {
    if (Sync.authSettled) return res();
    const t0 = setTimeout(res, 5000);
    authSettlers.push(() => { clearTimeout(t0); res(); });
  });
  /* host: tell the table it is closed, then delete it so no dead room is left behind.
     The index goes first: its rule reads the room's host. */
  Sync.closeRoom = async code => {
    code = code || Sync.code;   // before any await: callers leave the table right after
    await ensure();
    if (!code || !Sync.uid) return;
    const st = (await fb.get(at(`rooms/${code}/settings`))).val();
    if (!st || st.host !== Sync.uid) return;
    Sync.unlist(code);
    await fb.update(at(`rooms/${code}/settings`), { status: 'over', result: { reason: 'closed', aliensWin: false } });
    setTimeout(async () => {
      await fb.remove(at('roomIndex/' + code)).catch(() => {});
      await fb.remove(at('rooms/' + code)).catch(() => {});
    }, CLOSE_GRACE);
    await Sync.delPath(`users/${Sync.uid}/rooms/${code}`).catch(() => {});
  };
  Sync.forgetRoom = async code => {
    await ensure();
    if (!Sync.uid) return;
    try { await Sync.closeRoom(code); } catch (_) { /* already gone */ }
    await Sync.delPath(`users/${Sync.uid}/rooms/${code}`).catch(() => {});
    await Sync.delPath(`users/${Sync.uid}/games/${code}`).catch(() => {});
    if (Sync.code === code) Sync.leave(true);
  };
  Sync.deleteSelf = async () => {
    await ensure();
    const uid = Sync.uid, prof = Sync.profile;
    const rooms = (await fb.get(at(`users/${uid}/rooms`))).val() || {};
    for (const code of Object.keys(rooms)) {
      try {
        const st = (await fb.get(at(`rooms/${code}/settings`))).val();
        if (st && st.host === uid) await Sync.closeRoom(code);
      } catch (_) { /* room already gone */ }
    }
    await fb.remove(at(`users/${uid}`)).catch(() => {});
    await fb.remove(at(`friends/${uid}`)).catch(() => {}); await fb.remove(at(`friendReq/${uid}`)).catch(() => {}); await fb.remove(at(`invites/${uid}`)).catch(() => {});
    if (prof && prof.handle) await fb.remove(at('handles/' + prof.handle)).catch(() => {});
    const au = await fbAuth(); await au.deleteUser(auth.currentUser);
    try { localStorage.removeItem('eftaios.account'); } catch (_) { /* noop */ }
  };
  Sync.getPath = async p => { await ensure(); return (await fb.get(at(p))).val(); };
  /* the private checkpoint a player's own device writes, readable only by them */
  Sync.saveSeat = seat => {
    if (!Sync.code || !Sync.uid || !db) return;
    fb.set(at(`rooms/${Sync.code}/seats/${Sync.uid}`), seat).catch(() => {});
  };
  /* the private journal (notes, drawings, suspicions): rejects on failure so the caller can retry and warn */
  Sync.saveJournal = j => (Sync.code && db) ? fb.set(path(Sync.code, 'journal/' + Sync.uid), Object.assign({ at: Sync.now() }, j)) : Promise.reject(new Error('offline'));
  Sync.readSeat = async code => { await ensure(); return (await fb.get(at(`rooms/${code}/seats/${Sync.uid}`))).val(); };

  /* right after a sign-in the database connection can still carry the previous login's token, or not be connected yet,
     and the read is refused: that is not "no profile". Retry with a fresh token before concluding anything. */
  async function readProfileSure(u) {
    let p = null; Sync.profileLoading = true;
    try { for (let i = 0; i < 5; i++) {
      p = await readProfile(u.uid);
      if (p || !Sync.profileError || Sync.user !== u) return p;
      await new Promise(r => setTimeout(r, 400 * 2 ** i));
      try { await u.getIdToken(true); } catch (_) { /* offline: the next read will say */ }
    } } finally { Sync.profileLoading = false; }
    return p;
  }
  Sync.readProfileSure = readProfileSure;
  /* tell the screens the account changed */
  const notifyAuth = () => { authListeners.forEach(fn => { try { fn(Sync.user); } catch (_) { /* noop */ } }); if (Sync.h.auth) Sync.h.auth(); };
  /* keep listening to the profile: when the connection comes up late, or the read was refused, the answer still arrives
     and the screens update by themselves, with no reload */
  function watchProfile(u, tries = 0) {
    if (window.__FAKE_FB || !fb.onValue) return;
    try {
      profUnsub = fb.onValue(at(`users/${u.uid}/profile`), s => {
        if (Sync.user !== u) return;
        const p = s.val() || null, before = JSON.stringify([Sync.profile, Sync.profileError]);
        if (!p && !u.isAnonymous && Sync.profile && Sync.profile.handle) return;   // a profile once read does not vanish mid-session
        Sync.profile = p; Sync.profileError = ''; Sync.registered = !!(p && p.handle);
        try { if (Sync.registered) localStorage.setItem('eftaios.account', '1'); } catch (_) { /* noop */ }
        if (JSON.stringify([Sync.profile, Sync.profileError]) !== before) notifyAuth();
      }, async e => {   // refused (stale token): refresh it and listen again, a little later each time
        if (Sync.user !== u) return;
        if (!Sync.registered) { Sync.profileError = String(e && (e.code || e.message) || e).slice(0, 80); notifyAuth(); }
        await new Promise(r => setTimeout(r, Math.min(30000, 1000 * 2 ** tries)));
        try { await u.getIdToken(true); } catch (_) { /* offline */ }
        if (Sync.user === u) watchProfile(u, tries + 1);
      });
    } catch (_) { /* offline: the read above already reported it */ }
  }
  /* the profile is missing but this account still owns a handle: rebuild the profile from it instead of asking again */
  async function restoreProfile(u) {
    try {
      const all = (await fb.get(at('handles'))).val() || {}, handle = Object.keys(all).find(h => all[h] === u.uid);
      if (!handle) return null;
      const p = { handle, name: String(u.displayName || handle).trim().slice(0, 20) || handle, created: Date.now() };
      await fb.set(at(`users/${u.uid}/profile`), p);
      return p;
    } catch (_) { return null; }
  }
  Sync.restoreProfile = restoreProfile;
  /* the account screen's Retry: read again and tell everybody who listens */
  Sync.retryProfile = async () => {
    const u = Sync.user; if (!u) return;
    Sync.profile = await readProfileSure(u); if (Sync.user !== u) return;
    Sync.registered = !!(Sync.profile && Sync.profile.handle);
    try { if (Sync.registered) localStorage.setItem('eftaios.account', '1'); } catch (_) { /* noop */ }
    notifyAuth();
  };
  function readProfile(uid) {
    Sync.profileError = '';
    return fb.get(at(`users/${uid}/profile`)).then(s => s.val() || null).catch(e => { Sync.profileError = String(e && (e.code || e.message) || e).slice(0, 80); return null; });
  }
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
  /* ---------------- history and stats ---------------- */
  /* one record per game, keyed by table code and game number: a table hosts many games */
  Sync.recordGame = async (key, g) => {
    if (!Sync.registered || !Sync.uid || !Sync.code) return;
    try {
      await fb.set(at(`users/${Sync.uid}/games/${key}`), Object.assign({ at: Date.now() }, g));
      const all = (await fb.get(at(`users/${Sync.uid}/games`))).val() || {};
      const keep = Object.entries(all).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 50);
      await Promise.all(Object.keys(all).filter(k => !keep.some(([c]) => c === k)).map(k => fb.remove(at(`users/${Sync.uid}/games/${k}`))));
      await fb.runTransaction(at(`users/${Sync.uid}/stats`), cur => {
        const s = cur || {}, win = g.result === 'win', add = (k, n) => { if (n) s[k] = (s[k] || 0) + n; };
        const key = v => String(v || '?').replace(/[.$#\[\]\/]/g, '_').slice(0, 40);   // a database key cannot hold . $ # [ ] /
        if (g.bots) { add('botGames', 1); add('botWins', win ? 1 : 0); return s; }   // games with a bot at the table are counted apart
        add('games', 1); add('wins', win ? 1 : 0); add('losses', win ? 0 : 1);
        add('escapes', g.escaped ? 1 : 0); add('kills', g.kills || 0); add('turns', g.turns || 0);
        add('winsHuman', win && g.role === 'human' ? 1 : 0); add('winsAlien', win && g.role === 'alien' ? 1 : 0);
        add('humans', g.role === 'human' ? 1 : 0); add('aliens', g.role === 'alien' ? 1 : 0);
        if (g.chars) { add('c_' + key(g.chars), 1); add('cw_' + key(g.chars), win ? 1 : 0); }
        if (g.map) { add('m_' + key(g.map), 1); add('mw_' + key(g.map), win ? 1 : 0); }
        if (win) { s.streak = (s.streak || 0) + 1; s.bestStreak = Math.max(s.bestStreak || 0, s.streak); }
        else { s.streak = 0; }
        s.last = Date.now();
        return s;
      });
    } catch (e) { console.warn('record game', e); }
  };
  Sync.readStats = async uid => { await ensure(); return (await fb.get(at(`users/${(uid || Sync.uid)}/stats`))).val() || {}; };

  /* a small public-to-admins index of open tables, so the admin can see and close rooms
     without opening their secret or host data */
  Sync.writeRoomIndex = patch => {
    if (!Sync.code || !db) return;
    fb.update(at('roomIndex/' + Sync.code), Object.assign({ host: Sync.uid, at: Date.now() }, patch)).catch(() => {});
  };

  /* ---------------- friends and invites ----------------
     friends/<me>/<them>   I added them (they are a friend once they have added me back)
     friendReq/<them>/<me> my request, waiting in their inbox until they accept or decline
     invites/<them>/<me>   my invitation to a game, only between two people who added each other */
  const myHandle = () => (Sync.profile && Sync.profile.handle) || '';
  const myShown = () => (Sync.profile && Sync.profile.name) || myHandle();
  Sync.addFriend = async raw => {
    await ensure(); if (!Sync.registered) return 'guest';
    const h = String(raw || '').trim().toLowerCase().replace(/^@/, '');
    if (!/^[a-z0-9_]{3,16}$/.test(h)) return 'bad';
    const uid = (await fb.get(at('handles/' + h))).val();
    if (!uid) return 'nouser'; if (uid === Sync.uid) return 'self';
    await fb.set(at(`friends/${Sync.uid}/${uid}`), { handle: h, at: Date.now() });
    const back = (await fb.get(at(`friends/${uid}/${Sync.uid}`))).exists();
    if (!back) await fb.set(at(`friendReq/${uid}/${Sync.uid}`), { handle: myHandle(), name: String(myShown()).slice(0, 20), at: Date.now() });
    else await fb.remove(at(`friendReq/${Sync.uid}/${uid}`)).catch(() => {});
    return back ? 'friends' : 'sent';
  };
  Sync.acceptFriend = async (uid, handle) => { await ensure(); await fb.set(at(`friends/${Sync.uid}/${uid}`), { handle, at: Date.now() }); await fb.remove(at(`friendReq/${Sync.uid}/${uid}`)).catch(() => {}); };
  Sync.declineFriend = async uid => { await ensure(); await fb.remove(at(`friendReq/${Sync.uid}/${uid}`)).catch(() => {}); };
  Sync.removeFriend = async uid => { await ensure(); await fb.remove(at(`friends/${Sync.uid}/${uid}`)); await fb.remove(at(`friendReq/${uid}/${Sync.uid}`)).catch(() => {}); await fb.remove(at(`invites/${uid}/${Sync.uid}`)).catch(() => {}); };
  /* my friends (mutual or still waiting for them) and the requests waiting for me */
  Sync.friends = async () => {
    await ensure(); if (!Sync.registered) return { friends: [], requests: [] };
    const mine = (await fb.get(at(`friends/${Sync.uid}`))).val() || {}, reqs = (await fb.get(at(`friendReq/${Sync.uid}`))).val() || {};
    const friends = await Promise.all(Object.entries(mine).map(async ([uid, f]) => ({ uid, handle: f.handle, mutual: await fb.get(at(`friends/${uid}/${Sync.uid}`)).then(x => x.exists()).catch(() => false) })));
    return { friends: friends.sort((a, b) => b.mutual - a.mutual || a.handle.localeCompare(b.handle)), requests: Object.entries(reqs).map(([uid, r]) => ({ uid, handle: r.handle, name: r.name })).filter(r => !mine[r.uid] || true) };
  };
  Sync.invite = async (uid, code, map) => { await ensure(); await fb.set(at(`invites/${uid}/${Sync.uid}`), { code, name: String(myShown()).slice(0, 20), map: String(map || '').slice(0, 40), at: Date.now() }); };
  Sync.dismissInvite = async from => { await ensure(); await fb.remove(at(`invites/${Sync.uid}/${from}`)).catch(() => {}); };
  /* the inbox: invitations and friend requests waiting for me, pushed to the screen as they arrive */
  let inboxOn = false;
  Sync.watchInbox = async () => {
    if (inboxOn) return; await ensure(); if (!Sync.registered || !Sync.uid || !fb.onValue) return; inboxOn = true;
    Sync.inbox = { invites: [], requests: 0 };
    fb.onValue(at(`invites/${Sync.uid}`), s => { const v = s.val() || {}; Sync.inbox.invites = Object.entries(v).map(([from, i]) => Object.assign({ from }, i)).filter(i => i.at > Date.now() - 30 * 60000).sort((a, b) => b.at - a.at); Sync.h.inbox && Sync.h.inbox(); });
    fb.onValue(at(`friendReq/${Sync.uid}`), s => { Sync.inbox.requests = Object.keys(s.val() || {}).length; Sync.h.inbox && Sync.h.inbox(); });
  };

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
  Sync.pubMaps = async () => { await ensure(); return (await fb.get(fb.query(at('pubmaps'), fb.orderByChild('at'), fb.limitToLast(60)))).val() || {}; };

  /* ---------------- table ---------------- */
  Sync.newCode = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.random() * 32 | 0]).join('');

  function listen(code) {
    Sync.code = code; Sync.gen++; Sync.settings = null; Sync.players = {};
    const { onChildAdded, onValue, query, limitToLast } = fb;
    unsub.push(onValue(path(code, 'settings'), s => { Sync.settings = s.val(); Sync.h.settings && Sync.h.settings(Sync.settings); if (Sync.settings && Sync.settings.pub) Sync.listing(); }));
    unsub.push(onValue(path(code, 'players'), s => { Sync.players = s.val() || {}; Sync.h.players && Sync.h.players(Sync.players); if (Sync.settings && Sync.settings.pub) Sync.listing(); }));
    unsub.push(onChildAdded(query(path(code, 'log'), limitToLast(200)), s => Sync.h.entry && Sync.h.entry(s.val())));
    unsub.push(onValue(path(code, 'turn'), s => { Sync.turn = s.val(); Sync.h.turn && Sync.h.turn(Sync.turn); }));
    unsub.push(onValue(path(code, 'counts'), s => Sync.h.counts && Sync.h.counts(s.val() || {})));
    unsub.push(onValue(path(code, 'hatches'), s => Sync.h.hatches && Sync.h.hatches(s.val() || {})));
    Sync.leaseLoaded = false;   // until the table's lease arrives nobody knows who runs the bots, so nobody grabs it
    unsub.push(onValue(path(code, 'lease'), s => { Sync.lease = s.val() || null; Sync.leaseLoaded = true; Sync.h.lease && Sync.h.lease(Sync.lease); }));
    unsub.push(onValue(at('.info/connected'), s => setStatus(s.val() ? 'online' : 'offline')));
  }

  /* the public listing: a host who made the game Public shows it in the Online lobby while it gathers (host only; rules enforce it) */
  const LIST_FRESH = 120000;
  let listTimer = null, listBeat = null;
  Sync.listing = () => {
    clearTimeout(listTimer);
    listTimer = setTimeout(() => {
      const st = Sync.settings, code = Sync.code; if (!code || !db || !st || st.host !== Sync.uid) return;
      const n = Object.keys(Sync.players || {}).length, max = st.max || 8, me = (Sync.players || {})[Sync.uid] || {};
      if (st.pub && st.status === 'lobby' && n < max) {
        fb.set(at('lobby/' + code), { host: Sync.uid, name: String(me.name || '').slice(0, 20), map: st.map, mode: st.mode, n, max, at: Date.now() }).catch(() => {});
        try { if (fb.onDisconnect) fb.onDisconnect(at('lobby/' + code)).remove(); } catch (_) { /* fake or offline */ }
        if (!listBeat) listBeat = setInterval(() => Sync.listing(), 30000);   // an entry nobody refreshes goes stale and drops off the list
      } else { fb.remove(at('lobby/' + code)).catch(() => {}); }
    }, 400);
  };
  Sync.unlist = code => { clearTimeout(listTimer); if (listBeat) { clearInterval(listBeat); listBeat = null; } if (code && db) fb.remove(at('lobby/' + code)).catch(() => {}); };
  Sync.browse = async () => {
    await ensure(); const all = (await fb.get(at('lobby'))).val() || {};
    return Object.entries(all).filter(([, g]) => g && g.at > Date.now() - LIST_FRESH && g.host !== Sync.uid).sort((a, b) => b[1].at - a[1].at);
  };

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
      await fb.set(path(code, 'settings'), Object.assign({ map: settings.map, mode: settings.mode, host: Sync.uid, status: 'lobby', first: '', order: [Sync.uid], max: settings.max || 8, pub: !!settings.pub, fill: settings.fill || '' }, settings.customMap ? { customMap: settings.customMap } : {}));
      await fb.set(path(code, 'players/' + Sync.uid), { name: me.name, ready: false, guest: !Sync.registered });
      await fb.set(path(code, 'lease'), { uid: Sync.uid, dev: Sync.dev, at: Sync.now() }).catch(() => {});
      await fb.update(at('roomIndex/' + code), { host: Sync.uid, status: 'lobby', map: settings.map, players: 1, name: me.name, at: Date.now() }).catch(() => {});
      listen(code); Sync.h.joined && Sync.h.joined(code); Sync.indexRoom(code, 'host'); if (settings.pub) setTimeout(() => Sync.listing(), 800); return true;
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
      if (!mine && Object.keys((await fb.get(path(code, 'players'))).val() || {}).length >= (st.max || 8)) { setStatus('full'); return false; }
      if (mine) {
        if (me.name && me.name !== mine.name) await fb.update(path(code, 'players/' + Sync.uid), { name: me.name });
        if (st.status === 'lobby') await Sync.resetMine(code);
      }
      else await fb.set(path(code, 'players/' + Sync.uid), { name: me.name, ready: false, guest: !Sync.registered });
      listen(code); Sync.h.joined && Sync.h.joined(code); Sync.indexRoom(code, st.host === Sync.uid ? 'host' : 'member'); return true;
    } catch (e) { console.warn(e); Sync.lastError = String(e && (e.code || e.message) || e).slice(0, 80); setStatus(/permission/i.test(Sync.lastError) ? 'rules' : 'error'); return false; }
  };
  Sync.isHost = () => !!(Sync.settings && Sync.uid && Sync.settings.host === Sync.uid);
  /* the device currently running the bots: the creator unless the lease moved */
  Sync.holder = () => (Sync.lease && Sync.lease.uid) || (Sync.settings && Sync.settings.host) || null;
  Sync.isHolder = () => !!Sync.uid && Sync.leaseLoaded && Sync.holder() === Sync.uid && !(Sync.lease && Sync.lease.dev && Sync.lease.dev !== Sync.dev);
  Sync.claimHost = async () => {
    if (!Sync.code) return;
    await fb.set(path(Sync.code, 'lease'), { uid: Sync.uid, dev: Sync.dev, at: Sync.now() });
    /* if this tab goes away, drop the lease at once so the table can take over */
    try { if (fb.onDisconnect) await fb.onDisconnect(at(`rooms/${Sync.code}/lease`)).remove(); } catch (_) { /* fake or offline */ }
  };
  Sync.releaseHost = () => { if (Sync.code && Sync.isHolder()) fb.remove(path(Sync.code, 'lease')).catch(() => {}); };
  Sync.updateSettings = p => Sync.code && fb.update(path(Sync.code, 'settings'), p).catch(e => { rulesError(e); });
  Sync.setMeP = p => fb.update(path(Sync.code, 'players/' + Sync.uid), p);
  Sync.setMe = p => Sync.code && fb.update(path(Sync.code, 'players/' + Sync.uid), p).catch(e => { console.warn(e); if (window.rulesError) window.rulesError(e); });   // a refused field: tell the player the published rules are old
  Sync.startGame = async (first, order) => {
    if (!Sync.code) return;
    try { await fb.set(path(Sync.code, 'turn'), { n: 1, idx: 0, uid: order[0] }); await fb.update(path(Sync.code, 'settings'), { status: 'playing', first: first || '' }); Sync.writeRoomIndex({ status: 'playing', players: order.length }); } catch (e) { console.warn(e); }
  };
  /* host: the finished game is over; take the same table, with the same players, back to its lobby.
     Players clear their own rows and seats when they see the lobby (rules let only them do it). */
  Sync.rematch = async () => {
    if (!Sync.code || !Sync.isHost()) return false;
    const ps = Sync.players || {}, n = ((Sync.settings && Sync.settings.n) || 1) + 1, gone = {};
    const clear = { role: null, char: null, out: null, conv: null, route: null };
    for (const [u, p] of Object.entries(ps)) {
      if (p.bot) Object.keys(clear).forEach(k => { gone[`players/${u}/${k}`] = null; });
      else gone[`secret/${u}`] = null;
    }
    for (const k of ['turn', 'log', 'hatches', 'counts', 'attacks', 'spots', 'requests', 'hostdata']) gone[k] = null;
    try {
      await fb.update(path(Sync.code, ''), Object.assign(gone, { 'settings/status': 'lobby', 'settings/result': null, 'settings/first': '', 'settings/n': n }));
      Sync.writeRoomIndex({ status: 'lobby' });
      return true;
    } catch (e) { rulesError(e); return false; }
  };
  /* this player's own leftovers from the last game: the role they were dealt, their seat checkpoint */
  Sync.resetMine = async code => {
    code = code || Sync.code; if (!code || !Sync.uid || !db) return;
    try {
      const mine = (await fb.get(path(code, 'players/' + Sync.uid))).val();
      if (mine && mine.out !== 'kicked' && (mine.role || mine.out || mine.conv || mine.route || mine.char)) {
        await fb.update(path(code, 'players/' + Sync.uid), { role: null, char: null, out: null, conv: null, route: null, ready: false });
      }
      await fb.remove(path(code, 'seats/' + Sync.uid));
      await fb.remove(path(code, 'journal/' + Sync.uid));
    } catch (e) { console.warn('reset seat', e); }
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
    if (Sync.code && Sync.settings && Sync.settings.pub && Sync.settings.host === Sync.uid) Sync.unlist(Sync.code);
    Sync.h.leaving && Sync.h.leaving();   // last chance to save this player's seat and journal
    unsub.forEach(f => f()); unsub = [];
    if (!quiet && Sync.code && db && Sync.settings && Sync.settings.status === 'lobby') fb.remove(path(Sync.code, 'players/' + Sync.uid)).catch(() => {});
    Sync.code = null; Sync.settings = null; Sync.players = {}; Sync.turn = null; Sync.lease = null; Sync.leaseLoaded = false;
    if (!quiet) setStatus('off');
  };
  Sync.push = e => { if (Sync.code && db) fb.set(path(Sync.code, 'log/' + e.id), Object.assign({ by: Sync.uid }, e)).catch(console.warn); };
  Sync.setHatch = (n, v) => { if (Sync.code && db) fb.set(path(Sync.code, 'hatches/' + n), v ? 1 : 0).catch(console.warn); };

  /* ---------------- admin ---------------- */
  Sync.adminList = async node => { await ensure(); return (await fb.get(at(node))).val() || {}; };
  /* a finished game, anonymous: one new record per game (database rules: write once, admin reads) */
  Sync.record = async rec => { await ensure(); const id = Math.random().toString(36).slice(2, 10) + Date.now().toString(36); return fb.set(at('gameRecords/' + id), rec); };
  Sync.setPath = async (p, v) => { await ensure(); return fb.set(at(p), v); };
  Sync.delPath = async p => { await ensure(); return fb.remove(at(p)); };
  Sync.adminLog = (action, target, detail) => { if (!db) return; fb.push(at('adminlog'), { action, target: target || '', detail: detail || '', by: Sync.uid, at: Date.now() }).catch(() => {}); };
  Sync.report = (kind, target, text) => { if (!db) return Promise.reject(new Error('offline')); return fb.push(at('reports'), { kind, target, text: String(text || '').slice(0, 200), by: Sync.uid, at: Date.now() }); };

  function rulesError(e) {
    const code = String(e && (e.code || e.message) || e);
    if (/permission/i.test(code)) setStatus('rules');
  }
})();
