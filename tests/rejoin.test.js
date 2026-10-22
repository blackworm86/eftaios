// Coming back to a table: the host's lease can be taken over, and a player resumes from My games with the same secret state.
// Static server on :8123.
const { assert, setup, startTable } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(2);
  const [H, G] = pages;
  const code = await startTable(pages, { map: 'galilei' });
  await H.click('[data-act=addlobbybot]').catch(() => {});
  await H.waitForFunction(() => Object.values(Sync.players).some(p => p.bot));
  await H.click('.startbtn');
  for (const p of pages) await p.waitForSelector('#app:not([hidden])');
  for (const p of pages) await p.evaluate(() => closeDlg());
  assert(await G.evaluate(() => !!S.role), 'the guest is in the game');

  // the host goes away: after its heartbeat goes stale the guest is told and can take over
  await H.evaluate(() => Sync.setPath('rooms/' + Sync.code + '/lease', { uid: Sync.uid, at: Date.now() - 90000 }));
  await H.close();
  await G.waitForTimeout(1200);
  assert((await G.textContent('#turnbar')).includes('host is away'), 'the guest is told the host is away');
  await G.click('[data-act=takeover]');
  await G.waitForTimeout(1500);
  assert(await G.evaluate(() => Sync.isHolder()), 'the guest holds the host lease');
  assert(await G.evaluate(() => !!Online._hd()), 'the bot and deck state is loaded on the new host');

  // leaving the table and opening it again from My games keeps the secret state
  const before = await G.evaluate(() => ({ pos: S.pos, char: S.char }));
  await G.click('[data-tab=more]');
  await G.click('[data-act=newgame]');
  await G.click('#d-yes');
  await G.waitForSelector('[data-act=accountgames]', { timeout: 8000 });
  await G.click('[data-act=accountgames]');
  await G.waitForSelector('[data-act=resumeroom]', { timeout: 8000 });
  assert((await G.textContent('.plist')).includes(code), 'the table is listed under My games');
  await G.click('[data-act=resumeroom]');
  await G.waitForTimeout(2500);
  const back = await G.evaluate(() => ({ stage: S.stage, pos: S.pos, char: S.char }));
  assert(back.stage === 'game', 'opening the table from the list returns to the game');
  assert(back.pos === before.pos && back.char === before.char, 'the route and character are the ones this device had');

  // removing it forgets the table and closes it, since this device is the host
  await G.evaluate(() => { Sync.leave(true); S.stage = 'welcome'; S.room = null; T.turnState = null; save(); boot(); });
  await G.waitForSelector('[data-act=accountgames]', { timeout: 8000 });
  await G.click('[data-act=accountgames]');
  await G.waitForSelector('[data-act=forgetroom]', { timeout: 8000 });
  await G.click('[data-act=forgetroom]');
  await G.click('#d-yes');
  await G.waitForFunction(() => Array.isArray(T.myGames) && T.myGames.length === 0, null, { timeout: 8000 });
  assert(true, 'removing the game empties the list');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
