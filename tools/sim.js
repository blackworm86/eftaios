// Headless bot simulator: plays whole games with the real game code (Hot.start + bot.js) in Chromium and
// writes the metrics of every game to a JSON file. Usage:
//   node tools/sim.js [out.json] [--games 8] [--maps galilei,fermi] [--players 4,6] [--levels normal,hard] [--mode ultimate]
// Needs the static server on :8123 (python3 -m http.server 8123).
const fs = require('fs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const OUT = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : 'tools/sim-out.json';
const GAMES = +arg('games', 8), MODE = arg('mode', 'ultimate');
const PLAYERS = arg('players', '4,6').split(',').map(Number);
const LEVELS = arg('levels', 'normal').split(',');
const MAPS = arg('maps', '').split(',').filter(Boolean);
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// everything about one finished game, from the dump the app exposes
function summarize(d, n) {
  const seats = d.seats.map(s => {
    const path = (s.path || []).filter(p => p.note !== 'reborn');
    let changes = 0, abab = 0, moves = 0, maxStay = 0, stay = 0;
    for (let i = 1; i < path.length; i++) {
      moves++;
      if (path[i].pos !== path[i - 1].pos) { changes++; stay = 0; } else { stay++; maxStay = Math.max(maxStay, stay); }
      if (i >= 2 && path[i].pos === path[i - 2].pos && path[i].pos !== path[i - 1].pos) abab++;   // A-B-A back and forth
    }
    return { id: s.id, bot: s.bot, role0: s.role0, role: s.role, over: s.over, reborn: s.reborn, steps: path.length - 1,
      changeRate: moves ? changes / moves : 0, cycleRate: moves ? abab / moves : 0, maxStay };
  });
  const kills = d.log.filter(e => e.kind === 'out' && String(e.text).startsWith('killed')).length;
  const attacks = d.log.filter(e => e.kind === 'attack').length;
  const escapes = seats.filter(s => s.over === 'escaped').length;
  const res = d.result || {};
  return { n, map: d.map, mode: d.mode, players: n, turns: d.turn, winner: res.aliensWin ? 'alien' : 'human', reason: res.reason,
    kills, attacks, escapes, seats };
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { window.__botPace = 0; });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.waitForFunction(() => window.Hot && T.maps.length > 3);
  const maps = (MAPS.length ? MAPS : await p.evaluate(() => T.maps.filter(m => m.official || m.pack).map(m => m.id)));
  const out = [];
  for (const map of maps) for (const n of PLAYERS) for (const lvl of LEVELS) for (let g = 0; g < GAMES; g++) {
    const names = NAMES.slice(0, n), bots = names.map(() => lvl);
    const d = await p.evaluate(async ({ names, map, mode, bots }) => {
      await Hot.start(names, map, mode, 'auto', bots);
      return Hot.dump();
    }, { names, map, mode: MODE, bots });
    if (!d || !d.result) { out.push({ map, players: n, level: lvl, error: 'no result' }); continue; }
    const s = summarize(d, n); s.level = lvl; s.game = g;
    out.push(s);
  }
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), mode: MODE, games: out, errors: errs }, null, 1));
  console.log('games', out.length, 'written to', OUT, 'page errors', errs.length);
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
