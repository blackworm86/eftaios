// The admin dashboard links to the page that shows the current database rules. Static server on :8123.
const { assert, setup } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(1);
  const [P] = pages;
  await P.goto('http://localhost:8123/');
  await P.waitForSelector('#flow:not([hidden])');
  await P.evaluate(() => { Sync.isAdmin = true; S.stage = 'admin'; T.adminTab = 'users'; renderFlow(); });
  for (const tab of ['users', 'rooms', 'maps', 'reports', 'audit']) {
    await P.evaluate(k => { T.adminTab = k; renderFlow(); }, tab);
    assert(await P.locator('#flow-card a[href="firebase-rules.html"]').count() === 1, 'the rules link is on the ' + tab + ' tab');
  }
  const href = await P.evaluate(() => document.querySelector('#flow-card a[href="firebase-rules.html"]').target);
  assert(href === '_blank', 'it opens in a new tab');
  const ok = await P.evaluate(async () => (await fetch('firebase-rules.html')).ok && (await (await fetch('database.rules.json')).json()).rules !== undefined);
  assert(ok, 'the rules page and the rules file are served together');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
