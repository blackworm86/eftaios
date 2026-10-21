// Headless bot simulator: plays whole games with the real game code (Hot.start + bot.js) in Chrome and
// writes the metrics of every game to a JSON file. Usage:
//   node tools/sim.js [out.json] [--games 8] [--maps galilei,fermi] [--players 4,6] [--levels normal,hard]
//                      [--mix 'hard:1,easy:5'] [--skill '{"hard":{"spread":6}}'] [--seed 1] [--workers 4]
// The static server must be running on :8123 (node tools/serve.js).
const fs = require('fs');
const path = require('path');
const B = require('./browser');

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const has = k => argv.includes('--' + k);
const OUT = argv[0] && !argv[0].startsWith('--') ? argv[0] : 'tools/sim-out.json';
const GAMES = +arg('games', 8), MODE = arg('mode', 'ultimate');
const PLAYERS = arg('players', '4,6').split(',').map(Number);
const LEVELS = arg('levels', 'normal').split(',');
const MAPS = arg('maps', '').split(',').filter(Boolean);
const MIX = arg('mix', '');       // a mixed table, e.g. 'hard:1,easy:5': the seats play at these levels, in order
const SKILL = arg('skill', '');   // JSON overrides per level, e.g. '{"hard":{"humanCal":0.6}}' (the tuning hook)
const SEED = +arg('seed', 1);
const WORKERS = Math.max(1, +arg('workers', 1));
const POSITIONS = !has('no-positions');
const NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// stable per-game seed, independent of scheduling order: the same (seed, map, table, game) always pairs
function hash(s) { let h = 2166136261 >>> 0; for (const ch of String(s)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; }

// everything about one finished game, from the dump the app exposes
function summarize(d, n, meta) {
  const seats = d.seats.map(s => {
    const path = (s.path || []).filter(p => p.note !== 'reborn');
    let changes = 0, abab = 0, moves = 0, maxStay = 0, stay = 0;
    for (let i = 1; i < path.length; i++) {
      moves++;
      if (path[i].pos !== path[i - 1].pos) { changes++; stay = 0; } else { stay++; maxStay = Math.max(maxStay, stay); }
      if (i >= 2 && path[i].pos === path[i - 2].pos && path[i].pos !== path[i - 1].pos) abab++;   // A-B-A back and forth
    }
    return {
      id: s.id, bot: s.bot, role0: s.role0, role: s.role, over: s.over, reborn: s.reborn, steps: path.length - 1,
      changeRate: moves ? changes / moves : 0, cycleRate: moves ? abab / moves : 0, maxStay,
      // per-turn positions of the real route; used by tools/cluster.js for the Alien-clustering check
      route: POSITIONS ? path.map(p => ({ t: p.turn, pos: p.pos })) : undefined
    };
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
  // outs: the compact end-of-game record used by the death audit
  const outs = d.log.filter(e => e.kind === 'out').map(e => ({ by: e.by, who: e.who, turn: e.turn, text: String(e.text || ''), sector: e.sector || null }));
  const dead = seats.filter(s => s.over === 'dead').length;
  const escaped = seats.filter(s => s.over === 'escaped').length;
  const trapped = seats.filter(s => s.over === 'trapped').length;
  const killedLog = outs.filter(e => e.text.startsWith('killed')).length;
  const escapedLog = outs.filter(e => e.text.startsWith('escaped')).length;
  const trapsLog = outs.filter(e => e.text.startsWith('trapped')).length;
  const outBy = Object.fromEntries(outs.map(e => [e.by, e]));
  let movesAfterOut = 0, missingOut = 0, outWithoutSeat = 0, rebornKills = 0;
  seats.forEach(s => {
    const o = outBy[s.id];
    const converted = !!(o && s.reborn && o.text.startsWith('killed'));
    if (converted) rebornKills++;
    if (s.over && !o) missingOut++;
    if (!s.over && o && !converted) outWithoutSeat++;
    if (o && POSITIONS && !converted) movesAfterOut += s.route.filter(r => r.t > o.turn).length;
  });
  return {
    n, map: d.map, mode: d.mode, players: n, turns: d.turn, winner: res.aliensWin ? 'alien' : 'human', reason: res.reason,
    kills, attacks, alienAttacks, humanKills, escapes, seats, outs,
    audit: {
      dead, escaped, trapped, killedLog, escapedLog, trapsLog, rebornKills,
      // every death/escape/trap in the log must correspond to an end state, and vice versa.
      // A killed Human who is reborn is a conversion, not a death.
      stateMatchesLog: dead + rebornKills === killedLog && escaped === escapedLog && trapped === trapsLog,
      deadButNoLog: dead + rebornKills - killedLog, logButNotDead: killedLog - dead - rebornKills,
      movesAfterOut, missingOut, outWithoutSeat
    },
    ...meta
  };
}

async function main() {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  const b = await B.launch();
  const errs = [];
  const pages = [];
  for (let i = 0; i < WORKERS; i++) {
    const ctx = await b.browser.newContext({ viewport: { width: 900, height: 800 }, serviceWorkers: 'block' });
    await ctx.addInitScript(s => {
      window.__botPace = 0; window.__trace = []; window.__moves = [];
      window.__mkRng = a => { a = a >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
      if (s) window.__skill = JSON.parse(s);
    }, SKILL);
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    await p.goto('http://localhost:8123/');
    await p.waitForFunction(() => window.Hot && T.maps.length > 3);
    pages.push(p);
  }
  const maps = (MAPS.length ? MAPS : await pages[0].evaluate(() => T.maps.filter(m => m.official || m.pack).map(m => m.id)));
  // adjacency of every played map, so tools/cluster.js can measure distance without re-implementing the grid
  const boards = {};
  for (const id of maps) {
    boards[id] = await pages[0].evaluate(mapId => {
      const map = T.maps.find(m => m.id === mapId), cells = [], idx = {};
      for (let r = 0; r < map.rows; r++) for (let c = 0; c < map.cols; c++) if (map.grid[r][c] !== 'x') { idx[cid(c, r)] = cells.length; cells.push(cid(c, r)); }
      const nb = cells.map(id => { const [c, r] = parseId(id); return neighbors(map, c, r).map(([a, b]) => idx[cid(a, b)]).filter(j => j !== undefined); });
      return { cells, nb };
    }, id);
  }
  const tables = MIX
    ? [{ n: 0, lvl: 'mix', bots: MIX.split(',').flatMap(x => { const [l, k] = x.split(':'); return Array(+k).fill(l); }) }]
    : PLAYERS.flatMap(n => LEVELS.map(lvl => ({ n, lvl, bots: NAMES.slice(0, n).map(() => lvl) })));
  const tasks = [];
  for (const map of maps) for (const tb of tables) for (let g = 0; g < GAMES; g++) {
    tasks.push({ map, n: tb.bots.length, lvl: tb.lvl, bots: tb.bots, game: g,
      seed: (SEED + hash(map + '|' + tb.lvl + '|' + tb.bots.join(',') + '|' + g)) >>> 0 });
  }
  const out = new Array(tasks.length);
  let next = 0, done = 0;
  const t0 = Date.now();
  await Promise.all(pages.map(async p => {
    while (true) {
      const i = next++;
      if (i >= tasks.length) break;
      const task = tasks[i];
      try {
        const d = await p.evaluate(async a => {
          window.__rng = window.__mkRng(a.seed);
          window.__trace = []; window.__moves = [];
          await Hot.start(a.names, a.map, a.mode, 'auto', a.bots);
          const d = Hot.dump(); d.trace = window.__trace; d.moves = window.__moves; return d;
        }, { names: NAMES.slice(0, task.n), map: task.map, mode: MODE, bots: task.bots, seed: task.seed });
        if (!d || !d.result) out[i] = { map: task.map, players: task.n, level: task.lvl, seed: task.seed, error: 'no result' };
        else out[i] = summarize(d, task.n, { level: task.lvl, game: task.game, bots: task.bots, seed: task.seed, trace: d.trace, moves: d.moves });
      } catch (e) {
        out[i] = { map: task.map, players: task.n, level: task.lvl, seed: task.seed, error: e.message };
      }
      done++;
      if (done % 25 === 0 || done === tasks.length) {
        const s = (Date.now() - t0) / 1000;
        console.log(`${done}/${tasks.length} games  ${s.toFixed(0)}s  ${(done / Math.max(1, s)).toFixed(2)}/s`);
      }
    }
  }));
  const games = out.filter(Boolean);
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), mode: MODE, seed: SEED, workers: WORKERS, games, maps: boards, errors: errs }, null, 1));
  console.log('games', games.length, 'errors', games.filter(g => g.error).length, 'page errors', errs.length, 'written to', OUT);
  await b.close();
}
main().catch(e => { console.error(e); process.exit(1); });
