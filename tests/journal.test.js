// Everything a player writes or flags during an online game (notes, drawings, suspicions, Alien fed, turn step)
// is kept on the table and comes back on a device with no local game. Static server on :8123.
const { assert, setup, startTable, begin } = require('./helpers');
(async () => {
  const { b, ctx, pages, errs } = await setup(2);
  const [H, G] = pages;
  const code = await startTable(pages, { map: 'galilei' });
  await begin(pages);
  const uid = await G.evaluate(() => Sync.uid);
  await G.evaluate(() => {
    S.notes = [{ sector: 'F05', icon: 'eye', text: 'looks safe' }];
    S.annos = [{ type: 'stamp', icon: 'x', color: '#f00', x: 10, y: 20 }];
    S.sus = { 'u:abc': 'alien' }; S.shapes = { 'u:abc': 2 };
    S.fed = true; S.reborn = true; S.cat = true; S.phase = 'resolve'; S.res = { stage: 'done', say: 'Noise in your sector' };
    save();
  });
  await G.waitForTimeout(2500);          // seat and journal are written shortly after each change

  await G.close();
  const G2 = await ctx.newPage();
  await G2.addInitScript(u => { sessionStorage.fakeuid = u; }, uid);
  await G2.goto('http://localhost:8123/?room=' + code);
  await G2.fill('#flow-name', 'Guest');
  await G2.click('[data-act=joinroom]');
  await G2.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await G2.waitForTimeout(500);
  const s = await G2.evaluate(() => ({ notes: S.notes, annos: S.annos, sus: S.sus, shapes: S.shapes, fed: S.fed, reborn: S.reborn, cat: S.cat, phase: S.phase, res: S.res }));
  assert(s.notes.length === 1 && s.notes[0].text === 'looks safe', 'sector notes come back from the table');
  assert(s.annos.length === 1 && s.annos[0].type === 'stamp', 'drawings and stamps come back from the table');
  assert(s.sus['u:abc'] === 'alien' && s.shapes['u:abc'] === 2, 'suspicions and player shapes come back');
  assert(s.fed === true && s.reborn === true && s.cat === true, 'fed, mutated and Cat flags come back');
  assert(s.phase === 'resolve' && s.res && s.res.stage === 'done', 'the step of the turn comes back');

  /* a second device keeps editing: the first one picks the change up instead of overwriting it */
  await G2.evaluate(() => { S.notes.push({ sector: 'G06', icon: 'eye', text: 'second device' }); save(); });
  await G2.waitForTimeout(2500);
  const read = await G2.evaluate(async () => JSON.parse((await Sync.getPath(`rooms/${Sync.code}/journal/${Sync.uid}`)).notes).length);
  assert(read === 2, 'a later change is saved to the table too');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
