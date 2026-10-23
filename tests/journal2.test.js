// Two devices, one player: a change made on the other device is picked up, and a change this device made
// while away is sent to the table instead of being overwritten. Static server on :8123.
const { assert, setup, startTable, begin } = require('./helpers');
(async () => {
  const { b, ctx, pages, errs } = await setup(2);
  const [H, G] = pages;
  const code = await startTable(pages, { map: 'galilei' });
  await begin(pages);
  const uid = await G.evaluate(() => Sync.uid);
  const note = text => ({ sector: 'F05', icon: 'eye', text });
  const dbNotes = p => p.evaluate(async () => JSON.parse((await Sync.getPath(`rooms/${Sync.code}/journal/${Sync.uid}`)).notes).map(n => n.text));
  await G.evaluate(n => { S.notes = [n]; save(); }, note('A'));
  await G.waitForTimeout(2500);

  /* the same account opens a second device and adds a note */
  const G2 = await ctx.newPage();
  await G2.addInitScript(u => { sessionStorage.fakeuid = u; }, uid);
  await G2.goto('http://localhost:8123/?room=' + code);
  await G2.fill('#flow-name', 'Guest');
  await G2.click('[data-act=joinroom]');
  await G2.waitForSelector('#app:not([hidden])', { timeout: 15000 });
  await G2.evaluate(n => { S.notes.push(n); save(); }, note('B'));
  await G2.waitForTimeout(2500);
  assert((await dbNotes(G2)).join() === 'A,B', 'the second device saved its note');

  /* the first device comes back and picks it up */
  await G.reload(); await G.waitForSelector('#app:not([hidden])', { timeout: 15000 }); await G.waitForTimeout(800);
  assert((await G.evaluate(() => S.notes.map(n => n.text))).join() === 'A,B', 'a note from the other device appears');

  /* an edit made here and not yet saved survives the reload and reaches the table */
  await G.evaluate(n => { S.notes.push(n); localStorage.setItem(STORE, JSON.stringify(S)); }, note('C'));
  await G.reload(); await G.waitForSelector('#app:not([hidden])', { timeout: 15000 }); await G.waitForTimeout(2800);
  assert((await G.evaluate(() => S.notes.map(n => n.text))).join() === 'A,B,C', 'an unsaved local note is kept after a reload');
  assert((await dbNotes(G)).join() === 'A,B,C', 'and it is sent to the table');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
