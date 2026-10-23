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
  await P.route('**/version.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '1.0.0', build: 'abc1234', built: '2026-10-23' }) }));
  await P.goto('http://localhost:8123/firebase-rules.html'); await P.waitForFunction(() => document.getElementById('r').value.length > 1000);
  const page = await P.evaluate(() => ({ stamp: document.getElementById('stamp').textContent, lines: document.getElementById('r').value.split('\n').length, journal: document.getElementById('r').value.includes('"journal"') }));
  assert(page.stamp.includes('abc1234') && page.stamp.includes('2026-10-23'), 'the rules page says which build it belongs to');
  assert(page.lines === 1 && page.journal, 'it shows the current rules as one line, ready to paste');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
