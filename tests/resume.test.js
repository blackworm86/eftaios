// A device that lost its local game (new tab, cleared storage) rebuilds its seat from the private
// checkpoint on the table. Static server on :8123.
const { assert, setup, startTable, begin } = require('./helpers');
(async () => {
  const { b, ctx, pages, errs } = await setup(2);
  const [H, G] = pages;
  const code = await startTable(pages, { map: 'galilei' });
  await begin(pages);
  const before = await G.evaluate(() => ({ uid: Sync.uid, pos: S.pos, char: S.char }));
  await G.waitForTimeout(900);          // the checkpoint is written shortly after each change

  await G.close();
  const G2 = await ctx.newPage();
  await G2.addInitScript(uid => { sessionStorage.fakeuid = uid; }, before.uid);
  await G2.goto('http://localhost:8123/?room=' + code);
  await G2.fill('#flow-name', 'Guest');
  await G2.click('[data-act=joinroom]');
  await G2.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  const after = await G2.evaluate(() => ({ stage: S.stage, pos: S.pos, char: S.char, role: S.role, turn: S.turn }));
  assert(after.stage === 'game', 'a device without a local game reopens straight into the game');
  assert(after.pos === before.pos && after.char === before.char, 'the seat is rebuilt from the private checkpoint');
  assert(after.role, 'the role comes back from the table');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
