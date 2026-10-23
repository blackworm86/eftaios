// Leave and come straight back: the note written a moment before leaving, the turn flags and the timeline return,
// and a card request that was in flight is asked again. A closed table takes no more saves. Static server on :8123.
const { assert, setup, startTable, begin } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(2);
  const [H, G] = pages;
  const code = await startTable(pages);
  await begin(pages);
  await H.evaluate(() => Sync.push({ id: 'tl1', turn: 1, who: 'Host', kind: 'noise', sector: 'F05', text: 'noise', at: Date.now() }));
  await G.waitForTimeout(800);
  await G.evaluate(() => { S.notes = [{ sector: 'F05', icon: 'eye', text: 'quick note' }]; S.fed = true; S.phase = 'resolve'; S.res = { stage: 'wait' }; save(); });
  await G.evaluate(() => actions.leavetable()); await G.click('#d-yes');      // before the 1 s save timer runs
  await G.waitForSelector('#flow:not([hidden])');
  await G.fill('#join-code', code); await G.click('[data-act=joinroom]');
  await G.waitForSelector('#app:not([hidden])', { timeout: 15000 }); await G.waitForTimeout(800);
  const s = await G.evaluate(() => ({ notes: S.notes.map(n => n.text), fed: S.fed, res: S.res, log: S.log.map(e => e.id) }));
  assert(s.notes.join() === 'quick note', 'a note written just before Leave is back');
  assert(s.fed === true, 'the turn flags are back');
  assert(s.log.includes('tl1'), 'the other players\' timeline is back');
  assert(s.res && s.res.stage === 'choose', 'a card request left waiting is asked again');

  /* a phone waking up after the host closed the table must not write into it */
  const wrote = await G.evaluate(async () => {
    const p = `rooms/${Sync.code}/journal/${Sync.uid}`, uidNow = Sync.uid;
    S.notes.push({ sector: 'G06', icon: 'eye', text: 'after close' });
    Sync.settings = Object.assign({}, Sync.settings, { status: 'over', result: { reason: 'closed' } });
    Sync.leave(true); await new Promise(r => setTimeout(r, 1500));
    const j = await Sync.getPath(p); return j ? JSON.parse(j.notes).length : 0;
  });
  assert(wrote === 1, 'nothing is saved into a closed table');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
