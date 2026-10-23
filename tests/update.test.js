// A tab or app left open keeps running the version it loaded: when a newer build is deployed it offers a reload
// (a dialog at the start screen, a quiet toast during a game). Static server on :8123.
const { assert, setup, startTable, begin } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(2);
  const [H, G] = pages;
  let build = 'aaa1111';
  for (const p of pages) await p.route('**/version.json', r => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ version: '1.0.0', build }) }));
  await H.goto('http://localhost:8123/'); await H.waitForSelector('#flow:not([hidden])');
  await H.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await H.waitForTimeout(400);
  assert(await H.locator('dialog[open]').count() === 0, 'no prompt while the build is the same');
  build = 'bbb2222';
  await H.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await H.waitForSelector('dialog[open] #d-yes', { timeout: 5000 });
  assert((await H.textContent('dialog[open]')).toLowerCase().includes('new version'), 'a newer build offers a reload at the start screen');
  await H.click('#d-no');
  await H.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await H.waitForTimeout(400);
  assert(await H.locator('dialog[open]').count() === 0, '"Later" is respected until the next load');

  /* during a game: no dialog, a toast */
  build = 'aaa1111';
  await startTable(pages);
  await begin(pages);
  build = 'ccc3333';
  await G.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); await G.waitForTimeout(600);
  assert(await G.locator('dialog[open]').count() === 0, 'no dialog in the middle of a game');
  assert((await G.evaluate(() => document.querySelector('#toast') ? document.querySelector('#toast').textContent : '')).toLowerCase().includes('new version'), 'a toast tells the player instead');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
