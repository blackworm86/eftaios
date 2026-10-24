'use strict';
/* Reference data for rl/tests/test_conformance.py: neighbours and reachable sets taken from the real app code in headless Chrome.
     node tools/serve.js 8123 &  node tools/export-rl-conformance.js */
const fs = require('fs');
const path = require('path');
const B = require('./browser');
(async () => {
  const b = await B.launch();
  const ctx = await b.browser.newContext({ serviceWorkers: 'block' });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8123/');
  await p.waitForFunction(() => window.Hot && T.maps.length > 3);
  const data = await p.evaluate(() => {
    let seed = 12345; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const out = [];
    for (const map of T.maps.filter(m => m.cols === 23 && m.rows === 14)) {
      const cells = []; for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) cells.push([r * map.cols + c, cid(c, r), c, r]);
      const nb = cells.map(([i, id, c, r]) => neighbors(map, c, r).map(([a, b]) => b * map.cols + a));
      const samples = [];
      for (let k = 0; k < 40; k++) {
        const walk = cells.filter(([i, id, c, r]) => map.grid[r][c] !== 'x');
        const [i, id] = walk[Math.floor(rnd() * walk.length)];
        const role = rnd() < 0.5 ? 'human' : 'alien', steps = 1 + Math.floor(rnd() * 3), open = [1, 2, 3, 4].filter(() => rnd() < 0.7);
        S.hatches = { 1: open.includes(1) ? 0 : 1, 2: open.includes(2) ? 0 : 1, 3: open.includes(3) ? 0 : 1, 4: open.includes(4) ? 0 : 1 };
        const reach = reachable(map, id, steps, role), idx = s => { const q = parseId(s); return q[1] * map.cols + q[0]; };
        samples.push({ from: i, role, steps, open, reach: [...reach].map(([s, d]) => [idx(s), d]).sort((a, b) => a[0] - b[0]) });
      }
      out.push({ id: map.id, rows: map.rows, cols: map.cols, odd: map.odd, nb, samples });
    }
    return out;
  });
  fs.writeFileSync(path.join(__dirname, '..', 'rl', 'tests', 'conformance.json'), JSON.stringify(data));
  console.log('maps', data.length, 'samples', data.reduce((a, m) => a + m.samples.length, 0));
  await b.close();
})();
