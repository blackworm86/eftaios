'use strict';
/* Accounts: a guest plays from a table code; a registered player keeps rooms, maps and stats.
   One uid throughout: signing in upgrades the anonymous guest in place. */
const Auth = (() => {
  const msg = e => {
    const c = String(e && (e.code || e.message) || e || '');
    if (/taken/.test(c)) return t('That handle is already taken.');
    if (/bad-handle/.test(c)) return t('Use 3 to 16 letters, numbers or _.');
    if (/email-required/.test(c)) return t('Enter the email you used to ask for the link.');
    if (/invalid-email/.test(c)) return t('That email address does not look right.');
    if (/wrong-password|invalid-credential|user-not-found/.test(c)) return t('Email or password not recognised.');
    if (/email-already-in-use/.test(c)) return t('That email already has an account. Sign in instead.');
    if (/weak-password/.test(c)) return t('Use at least 6 characters.');
    if (/popup-closed|cancelled/.test(c)) return '';
    if (/network/.test(c)) return t('Network error. Try again.');
    return c.slice(0, 90) || t('Something went wrong.');
  };
  const bar = () => {
    const u = Sync.user, p = Sync.profile;
    if (!Sync.enabled) return '';
    const chev = `<i class="go" aria-hidden="true">${ico('next', 18)}</i>`;
    if (p) return `<button class="idrow" data-act="account"><span class="who"><b>${esc(p.name)}</b><small>@${esc(p.handle)}</small></span><span class="tag">${t('Account')}</span>${chev}</button>`;
    /* a signed-in account whose profile has not arrived yet is not a new account: never ask it to finish its profile */
    if (u && !u.isAnonymous && (Sync.profileLoading || Sync.profileError)) return `<button class="idrow guest" data-act="account"><span class="who"><b>${t(Sync.profileLoading ? 'Loading your account…' : 'Your profile could not be loaded')}</b><small>${esc(u.email || '')}</small></span>${Sync.profileError ? `<span class="tag">${t('Try again')}</span>` : ''}${chev}</button>`;
    return `<button class="idrow guest" data-act="account"><span class="who"><b>${u && !u.isAnonymous ? t('Finish your account') : t('Playing as a guest')}</b><small>${t('Sign in to keep your games')}</small></span><span class="tag">${t('Sign in')}</span>${chev}</button>`;
  };
  const head = title => `<header class="fhead"><button class="icon-btn" data-act="authback" aria-label="${t('Back')}">${'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>'}</button><h2>${title}</h2></header>`;

  function html() {
    if (S.stage === 'account') return accountHtml();
    if (S.stage === 'games') return gamesHtml();
    if (S.stage === 'stats') return statsHtml();
    return signInHtml();
  }
  function signInHtml() {
    const pending = Sync.linkEmailPending();
    return `${head(t('Sign in'))}
      ${Sync.authError === 'banned' ? `<p class="banner">${t('This account is banned.')}</p>` : ''}
      ${T.authReason ? `<p class="banner">${esc(T.authReason)}</p>` : ''}
      <p class="dim hintline">${t('Guests can join a table with a code. An account keeps your games, maps and statistics, and lets you host.')}</p>
      ${pending ? `<p class="dim hintline">${t('We sent a sign-in link. Open it on this device, or enter the email again below.')}</p>` : ''}
      ${Sync.isLink()
        ? `<button class="btn primary big wide" data-act="authcomplete">${t('Complete the sign-in')}</button>`
        : `${Sync.inAppBrowser() ? `<p class="banner">${t('Google sign-in does not work inside this app. Open the page in Safari or Chrome, or use your email below.')}</p>` : ''}<button class="btn primary big wide" data-act="authgoogle">${t('Continue with Google')}</button>
      <div class="or"><span>${t('or')}</span></div>
      <label class="field"><span>${t('Email')}</span><input id="a-email" type="email" autocomplete="email" value="${esc(T.authEmail || '')}" placeholder="you@example.com"></label>
      <label class="field"><span>${t('Password')}</span><input id="a-pass" type="password" autocomplete="current-password" placeholder="${t('At least 6 characters')}"></label>
      <button class="btn wide" data-act="authsignin">${t('Sign in')}</button>
      <button class="btn link wide" data-act="authsignup">${t('Create account')}</button>
      <div class="row two"><button class="btn link" data-act="authreset">${t('Forgot the password?')}</button><button class="btn link" data-act="authlink">${t('Email me a link instead')}</button></div>`}
      ${T.authMsg ? `<p class="dim hintline" role="status">${esc(T.authMsg)}</p>` : ''}`;
  }
  function accountHtml() {
    const p = Sync.profile || {}, u = Sync.user || {};
    return `${head(t('Your account'))}
      ${p.handle ? `<dl class="kv"><dt>${t('Handle')}</dt><dd>@${esc(p.handle)}</dd><dt>${t('Email')}</dt><dd>${esc(u.email || '—')}</dd></dl>
        <label class="field"><span>${t('Display name')}</span><input id="a-name" maxlength="20" value="${esc(p.name || '')}"></label>
        <button class="btn primary wide" data-act="accountsave">${t('Save')}</button>
        <div class="row two acctnav"><button class="btn" data-act="accountgames">${t('Your games')}</button><button class="btn" data-act="accountstats">${t('Statistics')}</button></div>
        <div class="acctend"><button class="btn link wide" data-act="accountsignout">${t('Sign out')}</button>
        <button class="btn danger wide" data-act="accountdelete">${t('Delete my account')}</button></div>`
      : Sync.profileLoading ? `<p class="dim" role="status">${t('Loading…')}</p>`
      : Sync.profileError ? `<p class="banner">${t('Your profile could not be loaded. Check your connection and try again; your account is safe.')} <code>${esc(Sync.profileError)}</code></p><button class="btn primary wide" data-act="accountretry">${t('Try again')}</button>
        <button class="btn link wide" data-act="accountsignout">${t('Sign out')}</button>`
      : `
        <p class="dim hintline">${t('Choose a handle once: it is how the table and the statistics know you.')}</p>
        <label class="field"><span>${t('Handle')}</span><input id="a-handle" maxlength="16" autocapitalize="off" placeholder="riccardo" value="${esc(p.handle || '')}"></label>
        <label class="field"><span>${t('Display name')}</span><input id="a-name" maxlength="20" value="${esc(p.name || (u.displayName || ''))}"></label>
        <button class="btn primary wide" data-act="accountcreate">${t('Create account')}</button>
        <button class="btn link wide" data-act="accountsignout">${t('Sign out')}</button>`}
      ${T.authMsg ? `<p class="dim hintline" role="status">${esc(T.authMsg)}</p>` : ''}`;
  }
  function gamesHtml() {
    if (!T.myGames) return `${head(t('Your games'))}<p class="dim">${t('Loading…')}</p>`;
    if (!T.myGames.length) return `${head(t('Your games'))}<p class="dim hintline">${t('No games yet. Host a table to start one.')}</p><button class="btn primary wide" data-act="hostsetup">${t('Host a table')}</button>`;
    const per = 5, pages = Math.max(1, Math.ceil(T.myGames.length / per));
    const page = Math.min(Math.max(T.gamesPage || 0, 0), pages - 1);
    T.gamesPage = page;
    const rows = T.myGames.slice(page * per, page * per + per).map(([code, g]) => `<li class="grow"><span class="pname">${esc(code)}<small>${esc(g.status || '')}</small></span><button class="btn" data-act="resumeroom" data-c="${esc(code)}">${t('Open')}</button><button class="x" data-act="forgetroom" data-c="${esc(code)}" aria-label="${t('Remove')}">${ico('close', 16)}</button></li>`).join('');
    const pager = pages > 1
      ? `<div class="pager"><button class="prev" data-act="gamespage" data-d="-1" ${page === 0 ? 'disabled' : ''} aria-label="${t('Previous')}">${ico('next', 16)}</button><span>${page + 1} / ${pages}</span><button data-act="gamespage" data-d="1" ${page === pages - 1 ? 'disabled' : ''} aria-label="${t('Next')}">${ico('next', 16)}</button></div>`
      : '';
    return `${head(t('Your games'))}<ul class="plist glist">${rows}</ul>${pager}<p class="dim hintline">${t('Finished games stay here for your last 20.')}</p>`;
  }

  async function open(stage) { S.stage = stage; save(); renderFlow(); if (stage === 'auth') Sync.preloadSignIn(); }
  async function loadGames() {
    T.myGames = null; renderFlow();
    const rooms = await Sync.myRooms();
    const out = [];
    for (const [code, g] of rooms) {
      let st = null; try { st = await Sync.getPath(`rooms/${code}/settings`); } catch (_) { /* noop */ }
      if (!st) { Sync.delPath(`users/${Sync.uid}/rooms/${code}`).catch(() => {}); continue; }   // a closed table is deleted: drop it from the list
      out.push([code, { at: g.at, role: g.role, status: st ? (st.status === 'playing' ? t('In progress') : st.status === 'over' ? t('Finished') : t('Lobby')) : t('Gone'), ok: !!st }]);
    }
    T.myGames = out; renderFlow();
  }
  /* the statistics screen: totals kept forever, plus the last games (result, role, Character, map) */
  async function loadStats() {
    if (T.statsLoading) return; T.statsLoading = true;
    try { const [s, g] = await Promise.all([Sync.readStats(), Sync.getPath(`users/${Sync.uid}/games`)]); T.stats = { s: s || {}, games: Object.values(g || {}).sort((x, y) => (y.at || 0) - (x.at || 0)) }; }
    catch (_) { T.stats = { s: {}, games: [] }; }
    T.statsLoading = false; renderFlow();
  }
  function statsHtml() {
    if (!T.stats) { loadStats(); return `${head(t('Statistics'))}<p class="dim">${t('Loading…')}</p>`; }
    const { s, games } = T.stats, pc = (n, d) => d ? Math.round(n / d * 100) + '%' : '–';
    const card = (l, v) => `<div class="stc"><b>${v}</b><span>${l}</span></div>`;
    const hum = s.humans || 0, ali = s.aliens || 0;
    if (!(s.games > 0)) return `${head(t('Statistics'))}<p class="dim hintline">${t('No finished games yet. Play a game while signed in and it is counted here.')}</p>`;
    const strip = games.slice(0, 50).reverse().map(g => `<i class="${g.result === 'win' ? 'w' : 'l'}" title="${esc(g.result === 'win' ? t('Win') : t('Loss'))}"></i>`).join('');
    const rows = games.slice(0, 50).map(g => `<li class="grow"><span class="pname">${esc(g.result === 'win' ? t('Win') : t('Loss'))} · ${esc(t(g.role === 'alien' ? 'Alien' : 'Human'))}${g.escaped ? ' · ' + esc(t('escaped')) : ''}<small>${esc([g.chars, g.map, g.at ? new Date(g.at).toLocaleDateString(LANG === 'it' ? 'it-IT' : undefined) : ''].filter(Boolean).join(' · '))}</small></span></li>`).join('');
    const by = pre => Object.keys(s).filter(k => k.startsWith(pre + '_')).map(k => [k.slice(2), s[k], s[pre + 'w_' + k.slice(2)] || 0]).sort((x, y) => y[1] - x[1]).slice(0, 6);   // c_ / cw_: Characters, m_ / mw_: maps
    const list = (title, rows) => rows.length ? `<h3 class="sth">${title}</h3><ul class="plist glist">${rows.map(([n, g, w]) => `<li class="grow"><span class="pname">${esc(n)}<small>${g} · ${pc(w, g)}</small></span></li>`).join('')}</ul>` : '';
    const bots = s.botGames ? `<p class="dim hintline">${t('Games with bots: {n}, won {w}', { n: s.botGames, w: pc(s.botWins || 0, s.botGames) })}</p>` : '';
    return `${head(t('Statistics'))}<div class="stgrid">${card(t('Games'), s.games)}${card(t('Win rate'), pc(s.wins || 0, s.games))}${card(t('As Human'), pc(s.winsHuman || 0, hum))}${card(t('As Alien'), pc(s.winsAlien || 0, ali))}${card(t('Escape rate'), pc(s.escapes || 0, hum))}${card(t('Current streak'), s.streak || 0)}${card(t('Best win streak'), s.bestStreak || 0)}${s.kills ? card(t('Kills'), s.kills) : ''}${card(t('Turns per game'), Math.round((s.turns || 0) / s.games) || '–')}</div>${bots}${list(t('By Character'), by('c'))}${list(t('By map'), by('m'))}
      <h3 class="sth">${t('Last games')}</h3><div class="ststrip" aria-hidden="true">${strip}</div><ul class="plist glist">${rows}</ul>`;
  }

  const acts = {
    async accountretry() { T.authMsg = ''; await Sync.retryProfile(); renderFlow(); },
    account() { T.authMsg = ''; open(Sync.registered ? 'account' : (Sync.user && !Sync.user.isAnonymous ? 'account' : 'auth')); },
    authback() { S.stage = S.stage === 'stats' ? 'account' : 'welcome'; T.authMsg = ''; T.authReason = ''; save(); renderFlow(); },
    authgoogle() { guard(async () => { await Sync.signInGoogle(); T.authMsg = ''; postSignIn(); }); },
    authsignin() { guard(async () => { const email = $('#a-email').value.trim(), pass = $('#a-pass').value; await Sync.signInEmail(email, pass); postSignIn(); }); },
    authsignup() { guard(async () => { const email = $('#a-email').value.trim(), pass = $('#a-pass').value; await Sync.signUpEmail(email, pass, S.name); postSignIn(); }); },
    authlink() { guard(async () => { const email = $('#a-email').value.trim(); if (!email) throw new Error('invalid-email'); await Sync.sendLink(email); T.authMsg = t('Link sent. Check your inbox.'); renderFlow(); }); },
    authreset() { guard(async () => { const email = $('#a-email').value.trim(); if (!email) throw new Error('invalid-email'); await Sync.resetPassword(email); T.authMsg = t('If that address has an account, a reset mail is on its way.'); renderFlow(); }); },
    authcomplete() { guard(async () => { await Sync.completeLink(($('#a-email') || {}).value); postSignIn(); }); },
    accountcreate() { guard(async () => { await Sync.saveProfile({ handle: $('#a-handle').value, name: $('#a-name').value }); T.authMsg = t('Account ready.'); postSignIn(); }); },
    accountsave() { guard(async () => { await Sync.renameMe($('#a-name').value); T.authMsg = t('Saved.'); renderFlow(); }); },
    accountgames() { S.stage = 'games'; T.gamesPage = 0; save(); loadGames(); },
    gamespage(b) { T.gamesPage = Math.max(0, (T.gamesPage || 0) + Number(b.dataset.d)); renderFlow(); },
    accountstats() { S.stage = 'stats'; T.stats = null; save(); renderFlow(); },
    accountsignout() { guard(async () => { await Sync.signOut(); S.stage = 'welcome'; T.authMsg = ''; save(); renderFlow(); }); },
    accountdelete() {
      if (!Sync.registered) return;
      confirmDlg(t('Delete your account?'), t('Live rooms are handed to another player. Finished games, maps and statistics are deleted.'), () => guard(async () => { await Sync.deleteSelf(); S.stage = 'welcome'; renderFlow(); }));
    },
    resumeroom(b) {
      guard(async () => {
        const code = b.dataset.c;
        T.pendingRoom = null; T.myGames = null;
        const ok = await Sync.join(code, { name: S.name || t('Player') });
        if (!ok) { S.stage = 'games'; save(); loadGames(); }
      });
    },
    forgetroom(b) {
      const code = b.dataset.c;
      confirmDlg(t('Remove this game from your list?'), t('The room is closed for everyone if you host it. This cannot be undone.'), () => guard(async () => {
        await Sync.forgetRoom(code); T.myGames = null; loadGames();
      }));
    }
  };
  async function postSignIn() {
    T.authMsg = '';
    try { await Sync.awaitAuth(); } catch (_) { /* fall through */ }
    if (!Sync.registered) { open('account'); return; }
    if (T.afterAuth) { S.stage = T.afterAuth; T.afterAuth = null; save(); renderFlow(); return; }
    if (S.stage === 'lobby' || S.stage === 'game') { renderFlow(); return; }
    S.stage = 'welcome'; save(); renderFlow();
  }
  async function guard(fn) {
    try { await fn(); }
    catch (e) { T.authMsg = msg(e); renderFlow(); }
  }
  return { html, bar, actions: acts, guard, loadGames };
})();
window.Auth = Auth;
