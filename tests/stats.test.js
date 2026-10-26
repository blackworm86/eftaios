// The statistics screen: rates from the totals, the strip and list of the last games, back to the account. Static server on :8123.
const { assert, setup } = require('./helpers');
(async () => {
  const { b, pages, errs } = await setup(1);
  const [P] = pages;
  await P.goto('http://localhost:8123/'); await P.waitForSelector('#flow:not([hidden])');
  for (const [vp, w, h] of [['desktop', 1000, 640], ['phone', 360, 640]]) {
    await P.setViewportSize({ width: w, height: h });
    await P.evaluate(() => {
      Sync.profile = { handle: 'admin', name: 'Riccardo' }; Sync.registered = true; Sync.user = { email: 'a@b.c' };
      T.stats = { s: { games: 10, turns: 120, kills: 7, botGames: 4, botWins: 1, c_Pilot: 5, cw_Pilot: 4, m_galilei: 10, mw_galilei: 6, wins: 6, humans: 4, winsHuman: 3, aliens: 6, winsAlien: 3, escapes: 2, streak: 2, bestStreak: 4 },
        games: Array.from({ length: 10 }, (_, i) => ({ at: 1e12 + i, result: i % 2 ? 'loss' : 'win', role: i % 3 ? 'alien' : 'human', chars: 'Pilot', map: 'galilei', escaped: false })) };
      S.stage = 'stats'; save(); boot();
    });
    await P.waitForSelector('.stgrid');
    const m = await P.evaluate(() => ({ cards: [...document.querySelectorAll('.stc')].map(c => c.textContent), rows: [...document.querySelectorAll('.glist')].pop().children.length, strip: document.querySelectorAll('.ststrip i').length, over: document.documentElement.scrollWidth > innerWidth + 1 }));
    assert(m.cards.some(c => c.startsWith('60%')) && m.cards.some(c => c.startsWith('75%')) && m.cards.some(c => c.startsWith('50%')), vp + ': win rate, as Human and as Alien come from the totals');
    assert(m.rows === 10 && m.strip === 10, vp + ': the list and the strip hold the last games');
    assert(await P.evaluate(() => document.body.innerText.includes('Pilot') && document.body.innerText.includes('80%') && document.body.innerText.includes('Games with bots: 4')), vp + ': per Character, per map and the bot line show');
    assert(!m.over, vp + ': nothing sticks out sideways');
  }
  await P.click('[data-act=authback]');
  assert(await P.evaluate(() => S.stage) === 'library', 'back returns to the Library tab');
  assert(errs.length === 0, 'no page errors');
  await b.close();
})();
