// Right after a sign-in the database can refuse the first profile reads (the connection still carries the old login).
// The app must retry instead of asking a registered player to create their profile again. Static server on :8123.
const { assert, setup } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(1);
  const [P] = pages;
  /* the first two profile reads fail the way a stale connection fails */
  await P.addInitScript(() => { const o = window.__FAKE_FB; window.__FAKE_FB = async () => { const f = await o(); const g = f.fb.get; window.__reads = 0;
    f.fb.get = async r => { if (/\/profile$/.test(r.path) && window.__failProfile > 0) { window.__failProfile--; window.__reads++; const e = new Error('permission_denied'); e.code = 'PERMISSION_DENIED'; throw e; } return g(r); }; return f; }; });
  await P.goto('http://localhost:8123/'); await P.waitForSelector('#flow:not([hidden])');
  const got = await P.evaluate(async () => {
    await Sync.ensure(); await Sync.setPath(`users/${Sync.uid}/profile`, { handle: 'riccardo', name: 'Riccardo', created: 1 });
    window.__failProfile = 2; const u = { uid: Sync.uid, getIdToken: async () => 'fresh' }; Sync.user = u;
    const p = await Sync.readProfileSure(u); return { p, failed: window.__reads, err: Sync.profileError, loading: Sync.profileLoading };
  });
  assert(got.p && got.p.handle === 'riccardo' && got.failed === 2, 'two refused reads are retried and the profile arrives (' + got.failed + ' refusals)');
  assert(!got.err && got.loading === false, 'no error is left once it arrives');
  /* if the reads keep failing, the account screen offers Retry, never the "create your profile" form */
  await P.evaluate(() => { Sync.registered = false; Sync.profile = null; Sync.profileError = 'PERMISSION_DENIED'; Sync.user = { uid: Sync.uid, isAnonymous: false }; S.stage = 'account'; save(); boot(); });
  const scr = await P.evaluate(() => ({ retry: !!document.querySelector('[data-act=accountretry]'), form: !!document.querySelector('#a-handle') }));
  assert(scr.retry && !scr.form, 'a failed read shows Try again, not the profile form');
  await P.evaluate(() => { Sync.profileError = ''; Sync.profileLoading = true; renderFlow(); });
  assert(await P.evaluate(() => !document.querySelector('#a-handle')), 'while the profile is loading, no form either');
  /* the profile was lost but this account still owns its handle: it is rebuilt, not asked again */
  const rebuilt = await P.evaluate(async () => {
    await Sync.delPath(`users/${Sync.uid}/profile`); await Sync.setPath('handles/riccardo', Sync.uid);
    const p = await Sync.restoreProfile({ uid: Sync.uid, displayName: 'Riccardo R', isAnonymous: false });
    return { p, stored: await Sync.getPath(`users/${Sync.uid}/profile`) };
  });
  assert(rebuilt.p && rebuilt.p.handle === 'riccardo' && rebuilt.stored && rebuilt.stored.handle === 'riccardo', 'a missing profile is rebuilt from the handle the account owns');
  const none = await P.evaluate(async () => { await Sync.delPath('handles/riccardo'); return Sync.restoreProfile({ uid: Sync.uid, isAnonymous: false }); });
  assert(none === null, 'without a handle of its own, nothing is invented');
  /* the start screen never says "finish your account" while the profile is loading or failed */
  await P.evaluate(() => { Sync.user = { uid: Sync.uid, isAnonymous: false, email: 'a@b.c' }; Sync.registered = false; Sync.profile = null; Sync.profileLoading = false; Sync.profileError = 'PERMISSION_DENIED'; S.stage = 'welcome'; save(); boot(); });
  const row = await P.evaluate(() => document.querySelector('.idrow').textContent);
  assert(!/Finish your account/.test(row) && /could not be loaded/.test(row), 'the start screen says the profile could not be loaded, not "finish your account"');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
