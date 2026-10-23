// A device that lost its local game (new tab, cleared storage) rebuilds its seat from the private
// checkpoint on the table. Static server on :8123.
const { assert, setup, startTable, begin } = require('./helpers');
(async () => {
  const { b, ctx, pages, errs } = await setup(2);
  const [H, G] = pages;
  const code = await startTable(pages, { map: 'galilei' });
  await begin(pages);
  const before = await G.evaluate(() => ({ uid: Sync.uid, pos: S.pos, char: S.char }));
  /* the other player's timeline: a public declaration and a closed hatch, written before the guest leaves */
  await H.evaluate(() => { Sync.push({ id: 'tl1', turn: 1, who: 'Host', kind: 'noise', sector: 'F05', text: 'noise', at: Date.now() }); Sync.setHatch(1, 1); });
  await G.waitForTimeout(900);          // the checkpoint is written shortly after each change

  await G.close();
  const G2 = await ctx.newPage();
  await G2.addInitScript(uid => { sessionStorage.fakeuid = uid; }, before.uid);
  /* real Firebase streams the live log first and answers one-off reads later: make the fake do the same */
  await G2.addInitScript(() => { const o = window.__FAKE_FB; window.__FAKE_FB = async () => { const f = await o(); const g = f.fb.get; f.fb.get = async (...a) => { await new Promise(r => setTimeout(r, 400)); return g(...a); }; return f; }; });
  await G2.goto('http://localhost:8123/?room=' + code);
  await G2.fill('#flow-name', 'Guest');
  await G2.click('[data-act=joinroom]');
  await G2.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  const after = await G2.evaluate(() => ({ stage: S.stage, pos: S.pos, char: S.char, role: S.role, turn: S.turn }));
  assert(after.stage === 'game', 'a device without a local game reopens straight into the game');
  assert(after.pos === before.pos && after.char === before.char, 'the seat is rebuilt from the private checkpoint');
  assert(after.role, 'the role comes back from the table');
  await G2.waitForTimeout(500);
  const tl = await G2.evaluate(() => ({ log: S.log.map(e => e.id), hatch1: S.hatches[1] }));
  assert(tl.log.includes('tl1'), 'the other players\' declarations are still on the timeline after re-entering');
  assert(tl.hatch1 === 1, 'a closed hatch is still closed after re-entering');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
