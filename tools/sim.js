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
const MIX = arg('mix', '');   // a mixed table, e.g. 'hard:1,easy:5': the seats play at these levels, in order
const SKILL = arg('skill', '');   // JSON overrides per level, e.g. '{"hard":{"humanCal":0.6}}' (the tuning hook in bot.js)

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
  // Alien attacks and how many of them killed a Human: the accuracy of the attack decision
  const byId = Object.fromEntries(d.seats.map(s => [s.id, s]));
  const alienAttacks = d.log.filter(e => e.kind === 'attack' && byId[e.by] && byId[e.by].role0 === 'alien').length;
  const humanKills = d.log.filter(e => e.kind === 'out' && String(e.text).startsWith('killed|human')).length;
  // kills per Alien seat: the Humans killed right after its attack (the log is newest first)
  const killsBy = {};
  d.log.forEach((e, i) => { if (e.kind !== 'attack' || !byId[e.by]) return;
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) { const o = d.log[j]; if (o.turn !== e.turn) break; if (o.kind === 'out' && String(o.text).startsWith('killed|human') && o.by !== e.by) killsBy[e.by] = (killsBy[e.by] || 0) + 1; } });
  seats.forEach(s => { s.kills = killsBy[s.id] || 0; });
  const escapes = seats.filter(s => s.over === 'escaped').length;
  const res = d.result || {};
  return { n, map: d.map, mode: d.mode, players: n, turns: d.turn, winner: res.aliensWin ? 'alien' : 'human', reason: res.reason,
    kills, attacks, alienAttacks, humanKills, escapes, seats };
}

async function main() {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
  await ctx.addInitScript(skill => { window.__botPace = 0; window.__trace = []; window.__moves = []; if (skill) window.__skill = JSON.parse(skill); }, SKILL);
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  await p.waitForFunction(() => window.Hot && T.maps.length > 3);
  const maps = (MAPS.length ? MAPS : await p.evaluate(() => T.maps.filter(m => m.official || m.pack).map(m => m.id)));
  const out = [];
  const tables = MIX ? [{ n: 0, lvl: 'mix', bots: MIX.split(',').flatMap(x => { const [l, k] = x.split(':'); return Array(+k).fill(l); }) }]
    : PLAYERS.flatMap(n => LEVELS.map(lvl => ({ n, lvl, bots: NAMES.slice(0, n).map(() => lvl) })));
  for (const map of maps) for (const tb of tables) for (let g = 0; g < GAMES; g++) {
    const n = tb.bots.length, lvl = tb.lvl, names = NAMES.slice(0, n), bots = tb.bots;
    const d = await p.evaluate(async ({ names, map, mode, bots }) => {
      window.__trace = []; window.__moves = [];
      await Hot.start(names, map, mode, 'auto', bots);
      const d = Hot.dump(); d.trace = window.__trace; d.moves = window.__moves; return d;
    }, { names, map, mode: MODE, bots });
    if (!d || !d.result) { out.push({ map, players: n, level: lvl, error: 'no result' }); continue; }
    const s = summarize(d, n); s.level = lvl; s.game = g; s.bots = bots; s.trace = d.trace; s.moves = d.moves;
    out.push(s);
  }
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), mode: MODE, games: out, errors: errs }, null, 1));
  console.log('games', out.length, 'written to', OUT, 'page errors', errs.length);
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
