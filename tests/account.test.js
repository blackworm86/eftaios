// The account screen has a clear rhythm: the form is one tight group, the shortcuts are set apart from it, and the
// sign out / delete pair sits apart from both, behind a dividing line. Static server on :8123.
const { assert, setup } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(1);
  const [P] = pages;
  await P.goto('http://localhost:8123/'); await P.waitForSelector('#flow:not([hidden])');
  const longEmail = 'riccardo.rodolfi.architetto.with.a.very.long.address@example-company.com';
  for (const [vp, w, h] of [['desktop', 1000, 640], ['phone', 390, 844], ['small phone', 360, 640]]) {
    await P.setViewportSize({ width: w, height: h });
    await P.evaluate(em => { Sync.profile = { handle: 'admin', name: 'Riccardo Rodolfi' }; Sync.registered = true; Sync.user = { email: em }; S.stage = 'account'; save(); boot(); }, longEmail);
    await P.waitForTimeout(200);
    const m = await P.evaluate(() => {
      const c = document.querySelector('#flow-card'), r = e => e.getBoundingClientRect();
      const q = s => c.querySelector(s), save = q('[data-act=accountsave]'), nav = q('.setrow'), end = q('.acctend');
      const out = q('[data-act=accountsignout]'), del = q('[data-act=accountdelete]');
      return { save: r(save), nav: r(nav), end: r(end), out: r(out), del: r(del), saveH: r(save).height, delH: r(del).height,
        scrollW: document.documentElement.scrollWidth, innerW: innerWidth, card: r(c), dd: [...c.querySelectorAll('.kv dd')].map(e => r(e).right <= r(c).right + 1) };
    });
    assert(m.nav.top - m.save.bottom >= 16, vp + ': the settings row is set apart from Save (' + Math.round(m.nav.top - m.save.bottom) + 'px)');
    assert(m.end.top - m.nav.bottom >= 18, vp + ': sign out and delete are set apart from the settings (' + Math.round(m.end.top - m.nav.bottom) + 'px)');
    assert(m.del.top - m.out.bottom >= 8, vp + ': sign out and delete do not touch (' + Math.round(m.del.top - m.out.bottom) + 'px)');
    assert(Math.abs(m.delH - m.saveH) < 1, vp + ': Save and Delete are the same height');
    assert(m.scrollW <= m.innerW + 1 && m.dd.every(Boolean), vp + ': a long email stays inside the card');
  }
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
