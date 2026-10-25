// The view keeps up with its screen: the map follows a resize or a rotation, the Table legend folds away on short phones,
// a map card shows all its details, and every player colour keeps readable text. Static server on :8123.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(); const errs = [];
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' }); await ctx.addInitScript(() => { window.__botPace = 0; });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/'); await p.waitForFunction(() => window.Hot && T.maps.length > 3);

  /* a map card is never cut mid-word: the details and the description each have their own line */
  await p.setViewportSize({ width: 360, height: 640 });
  await p.evaluate(() => { S.stage = 'hotsetup'; save(); boot(); });
  const card = await p.evaluate(() => [...document.querySelectorAll('.mapcard .mapname small')].map(e => [e.scrollWidth <= e.clientWidth + 1, e.getBoundingClientRect().width]));
  assert(card.length >= 2 && card.every(([fits, w]) => fits && w > 150), 'the map card shows its details and description in full');

  await p.setViewportSize({ width: 390, height: 844 });
  await p.evaluate(async () => { await Hot.start(['Me', 'Bot 1', 'Bot 2'], 'galilei', 'ultimate', 'auto', [null, 'normal', 'normal']); });
  await p.waitForSelector('#app:not([hidden])'); await p.evaluate(() => { try { closeDlg(); } catch (e) { /* none */ } });
  await p.waitForTimeout(600);

  /* resize: the point at the centre of the map stays at the centre */
  const centre = () => p.evaluate(() => { const r = stageRect(); return [(r.width / 2 - view.x) / view.k, (r.height / 2 - view.y) / view.k]; });
  const c0 = await centre();
  await p.setViewportSize({ width: 844, height: 390 }); await p.waitForTimeout(400);
  const c1 = await centre();
  assert(Math.hypot(c0[0] - c1[0], c0[1] - c1[1]) < 3, 'turning the phone keeps the same map point at the centre');
  /* a view that was fitted is fitted again */
  await p.evaluate(() => fit()); await p.waitForTimeout(100);
  await p.setViewportSize({ width: 1280, height: 800 }); await p.waitForTimeout(400);
  assert(await p.evaluate(() => { const r = stageRect(); return Math.abs(view.k - Math.min(r.width / mapW, r.height / mapH) * 0.98) < 1e-6; }), 'a fitted map is fitted again after a resize');

  /* the Table legend folds on a short phone and can be opened */
  await p.setViewportSize({ width: 360, height: 640 }); await p.waitForTimeout(300);
  await p.click('[data-tab=table]'); await p.click('[data-act=tsec][data-k=sheet]'); await p.waitForSelector('.legendtoggle');
  assert(await p.locator('.legend').count() === 0, 'the legend is folded on a short phone');
  await p.click('.legendtoggle'); assert(await p.locator('.legend').count() > 0, 'the legend opens on tap');
  await p.click('.legendtoggle'); assert(await p.locator('.legend').count() === 0, 'and folds again');

  /* readable text on every player colour */
  const worst = await p.evaluate(() => { const L = h => { const v = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(x => x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; }; return Math.min(...PALETTE.map(([bg, ink]) => { const a = L(bg), c = L(ink); return (Math.max(a, c) + 0.05) / (Math.min(a, c) + 0.05); })); });
  assert(worst >= 4.5, 'every player colour has text with at least 4.5:1 contrast (' + worst.toFixed(2) + ')');
  assert(errs.length === 0, 'no page errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
