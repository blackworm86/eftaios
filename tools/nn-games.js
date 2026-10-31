'use strict';
/* Plays games with the network bots (level nn, nn/net.json) in the real app and writes them as game records for Admin > Games > Network:
     node tools/serve.js &  node tools/nn-games.js [out.json] [--seed 1]
   Part 1: every seat is the network, 3-8 players on several maps. Part 2: the network Humans against Hard Aliens, and Hard Humans against network Aliens.
   The file is a list of records ({ id, at, mode, n, label, game }) like the ones the app stores for finished games. */
const fs = require('fs');
const B = require('./browser');
const argv = process.argv.slice(2), OUT = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'nn/games.json', SEED = argv.includes('--seed') ? +argv[argv.indexOf('--seed') + 1] : 1;
const PER = argv.includes('--per') ? +argv[argv.indexOf('--per') + 1] : 2;   // games per setup and table size
const IT = (() => { try { return require('../nn/net.json').iteration; } catch (_) { return '?'; } })();
const LEVEL = argv.includes('--level') ? argv[argv.indexOf('--level') + 1] : 'nn';   // another bot level in the place of the network, e.g. hard (for the rules audit)
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'], MAPS = ['galilei', 'fermi', 'volta', 'socrates', 'marconi', 'engarde'];
(async () => {
  const b = await B.launch(), ctx = await b.browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block', locale: 'en-US' });
  await ctx.addInitScript(() => {
    window.__botPace = 0;
    window.__mkRng = a => { a = a >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
  });
  const p = await ctx.newPage(); p.on('pageerror', e => console.log('page error', e.message));
  await p.goto('http://localhost:8123/'); await p.waitForFunction(() => window.Hot && window.NN && T.maps.length > 3);
  if (LEVEL === 'nn' && !(await p.evaluate(() => NN.load()))) throw new Error('nn/net.json could not be loaded');
  const plan = [];
  for (const n of [3, 4, 5, 6, 7, 8]) for (let k = 0; k < 3; k++) plan.push({ n, label: 'every seat is the network', bots: Array(n).fill(LEVEL) });
  for (const n of [4, 6, 8]) for (let k = 0; k < PER; k++) { plan.push({ n, label: 'network Humans against Hard Aliens', rm: { human: LEVEL, alien: 'hard' } }); plan.push({ n, label: 'Hard Humans against network Aliens', rm: { human: 'hard', alien: LEVEL } }); }
  if (LEVEL === 'nn') for (const n of [4, 6, 8]) for (let k = 0; k < PER; k++) plan.push({ n, label: 'reference: Hard bots only', bots: Array(n).fill('hard') });
  const out = [];
  for (let i = 0; i < plan.length; i++) {
    const t = plan[i], map = MAPS[(i + SEED) % MAPS.length];
    const rec = await p.evaluate(async a => {
      window.__rng = window.__mkRng(a.seed);
      let bots = a.bots, setup;
      if (a.rm) { setup = dealRoles(a.n); bots = setup.map(d => a.rm[d.role]); }
      await Hot.start(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].slice(0, a.n), a.map, 'ultimate', 'auto', bots, setup);
      const d = Hot.dump(); return { v: 1, at: Date.now(), build: '', mode: d.mode, n: d.seats.length, label: a.label + ' (network iteration ' + a.it + ')', game: Records.build(d) };
    }, { n: t.n, map, seed: SEED * 1000 + i, bots: t.bots, rm: t.rm, label: t.label, it: IT });
    rec.id = 'nn' + String(i + 1).padStart(3, '0'); out.push(rec);
    console.log(`${i + 1}/${plan.length} ${t.label}, ${t.n} players on ${map}: ${rec.game.result && rec.game.result.aliensWin ? 'Aliens' : 'Humans'} win, ${rec.game.turns} turns`);
  }
  fs.writeFileSync(OUT, JSON.stringify(out)); console.log('written', OUT, (fs.statSync(OUT).size / 1024).toFixed(0) + ' KB');
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
