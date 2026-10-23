// One account open on two devices (a phone and a computer, or two tabs) must not play the bots twice:
// each bot declares once per turn, and only one device runs them. Static server on :8123.
const { assert, setup } = require('./helpers');
(async () => {
  const { b, ctx, pages, errs } = await setup(1);
  const [H] = pages;
  const spy = () => { window.__calls = []; const w = setInterval(() => { if (window.Bot && !Bot.__w) { Bot.__w = 1; const o = Bot.turn; Bot.turn = function (c) { window.__calls.push(c.me.name + ':' + c.H.turn); return o.apply(this, arguments); }; clearInterval(w); } }, 5); };
  await H.addInitScript(spy);
  await H.goto('http://localhost:8123/'); await H.fill('#flow-name', 'Host'); await H.click('[data-act=hostsetup]');
  await H.click('[data-act=hostcreate]'); await H.waitForSelector('.roomcard b');
  for (const n of [2, 3]) { await H.click('[data-act=addlobbybot]'); await H.waitForFunction(k => document.querySelectorAll('.plist li').length === k, n); }
  await H.click('[data-act=ready]'); await H.waitForFunction(() => !document.querySelector('.startbtn').disabled);
  await H.click('.startbtn'); await H.waitForSelector('#app:not([hidden])'); await H.evaluate(() => closeDlg());

  /* the same account opens the running table on a second device */
  const code = await H.evaluate(() => Sync.code), uid = await H.evaluate(() => Sync.uid);
  const H2 = await ctx.newPage();
  await H2.addInitScript(u => { sessionStorage.fakeuid = u; }, uid); await H2.addInitScript(spy);
  await H2.goto('http://localhost:8123/?room=' + code); await H2.fill('#flow-name', 'Host'); await H2.click('[data-act=joinroom]');
  await H2.waitForSelector('#app:not([hidden])', { timeout: 15000 }); await H2.evaluate(() => closeDlg());
  assert(await H.evaluate(() => Sync.isHolder()) && !(await H2.evaluate(() => Sync.isHolder())), 'the device that already runs the bots keeps them; the new one does not');

  for (let k = 0; k < 30; k++) {
    const n = await H.evaluate(() => T.turnState && T.turnState.n); if (n >= 3 || await H.evaluate(() => Sync.settings.status !== 'playing')) break;
    const who = await H.evaluate(() => T.turnState.uid);
    if (who.startsWith('bot_')) { await H.waitForFunction(u => T.turnState.uid !== u || Sync.settings.status !== 'playing', who, { timeout: 30000 }); continue; }
    await H.evaluate(async () => { closeDlg(); if (S.over) return; const id = [...T.reach.keys()].find(x => !'1234'.includes(at(T.map, x))) || [...T.reach.keys()][0]; selectCell(id); confirmMove();
      if (S.res && S.res.stage === 'choose' && at(T.map, S.pos) === '.') { await drawSector(); if (T.pick) { const cb = T.pick.cb; T.pick = null; await cb(S.pos); } } else if (S.res && S.res.stage === 'choose') announce({ say: 'x' }); closeDlg(); endTurn(); });
    await H.waitForFunction(u => T.turnState.uid !== u || Sync.settings.status !== 'playing', who, { timeout: 30000 });
  }
  await H.waitForTimeout(1500);
  const per = await H.evaluate(() => { const m = {}; S.log.filter(e => String(e.by).startsWith('bot_')).forEach(e => { const k = e.who + ' T' + e.turn; m[k] = (m[k] || 0) + 1; }); return m; });
  const calls = await H.evaluate(() => window.__calls), calls2 = await H2.evaluate(() => window.__calls);
  assert(Object.keys(per).length >= 4 && Object.values(per).every(c => c === 1), 'every bot declares exactly once per turn ' + JSON.stringify(per));
  assert(calls.length >= 4 && calls2.length === 0, 'only one device plays the bots (' + calls.length + ' turns here, ' + calls2.length + ' on the other)');

  /* taking over moves the bots to the new device and stops them on the old one */
  await H2.evaluate(() => Sync.claimHost()); await H.waitForFunction(() => !Sync.isHolder()); await H2.waitForFunction(() => Sync.isHolder());
  assert(true, 'taking over moves the bots to the other device');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
