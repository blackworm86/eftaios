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
const NO_TRACE = has('no-trace');   // suite runs do not need the per-move trace; it calls Hot.dump on every move and is slow
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
      id: s.id, bot: s.bot, role0: s.role0, role: s.role, char: s.char, ab: s.ab, over: s.over, reborn: s.reborn, steps: path.length - 1,
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
  // friendly fire: a kill whose victim is on the attacker's own side (Alien kills Alien, Human's Attack card kills Human)
  const sideOf = s => (s.reborn ? 'alien' : s.role0);
  let friendlyKills = 0;
  d.log.forEach((e, i) => { if (e.kind !== 'attack' || !byId[e.by]) return;
    for (let j = i - 1; j >= Math.max(0, i - 4); j--) { const o = d.log[j]; if (o.turn !== e.turn) break;
      if (o.kind === 'out' && String(o.text).startsWith('killed') && o.by !== e.by && byId[o.by] && byId[o.by].role0 === byId[e.by].role0) friendlyKills++; } });
  // items and powers: cards played (defense/clone count when they save a life), cards still held at the end, powers used
  const itemUse = {}, itemsLeft = {};
  d.log.forEach(e => { if (e.kind === 'item') itemUse[e.text] = (itemUse[e.text] || 0) + 1; });
  d.seats.forEach(s => (s.items || []).forEach(k => { itemsLeft[k] = (itemsLeft[k] || 0) + 1; }));
  // cards a Human was still holding at the end (an Alien keeps cards only to look Human; most of them it cannot play)
  const humanHeld = d.seats.filter(s => s.role === 'human').reduce((a, s) => a + (s.items || []).filter(k => k !== 'defense' && k !== 'clone').length, 0);
  const powers = d.seats.reduce((a, x) => a + Object.values(x.ab || {}).reduce((b, n) => b + n, 0), 0);   // Character powers used (the bot counts each use in its seat's ab)
  const turnMs = {};
  (d.turnMs || []).forEach(([l, ms]) => { const t = turnMs[l] || (turnMs[l] = { n: 0, sum: 0, max: 0 }); t.n++; t.sum += ms; t.max = Math.max(t.max, ms); });
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
    const converted = !!(o && s.reborn && o.text.startsWith('killed|human'));   // a mutated Human killed later as an Alien is a plain death
    if (converted) rebornKills++;
    if (s.over && !o) missingOut++;
    if (!s.over && o && !converted) outWithoutSeat++;
    if (o && POSITIONS && !converted) movesAfterOut += s.route.filter(r => r.t > o.turn).length;
  });
  return {
    n, map: d.map, mode: d.mode, players: n, turns: d.turn, winner: res.aliensWin ? 'alien' : 'human', reason: res.reason,
    noises: d.log.filter(e => e.kind === 'noise' && e.sector).map(e => ({ by: e.by, sector: e.sector, turn: e.turn })),
    kills, attacks, alienAttacks, humanKills, friendlyKills, itemUse, itemsLeft, humanHeld, powers, turnMs, escapes, seats, outs,
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

async function open(n) {
  const b = await B.launch();
  const pages = [], errs = [];
  let dead = false;
  b.browser.on('disconnected', () => { dead = true; });
  for (let i = 0; i < n; i++) {
    const ctx = await b.browser.newContext({ viewport: { width: 900, height: 800 }, locale: 'en-US', serviceWorkers: 'block' });
    await ctx.addInitScript(o => {
      const trace = !o.noTrace;
      window.__botPace = 0; window.__turnMs = []; window.__trace = trace ? [] : null; window.__moves = trace ? [] : null;
      window.__mkRng = a => { a = a >>> 0; return () => { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; };
      if (o.skill) window.__skill = JSON.parse(o.skill);
    }, { noTrace: NO_TRACE, skill: SKILL });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(e.message));
    p.on('crash', () => { dead = true; console.log('page crashed'); });
    await p.goto('http://localhost:8123/');
    await p.waitForFunction(() => window.Hot && T.maps.length > 3);
    // time every bot turn (the host's phone is slower than this machine; tools/yardstick.js says so)
    await p.evaluate(() => { const o = Bot.turn; Bot.turn = async c => { const t = performance.now(); try { return await o(c); } finally { window.__turnMs.push([c.me.bot, performance.now() - t]); } }; });
    pages.push(p);
  }
  return { b, pages, errs, isDead: () => dead, close: () => b.close() };
}

async function main() {
  fs.mkdirSync(path.dirname(path.resolve(OUT)), { recursive: true });
  const errs = [];
  let sess = await open(WORKERS);
  const maps = (MAPS.length ? MAPS : await sess.pages[0].evaluate(() => T.maps.filter(m => m.official || m.pack).map(m => m.id)));
  // adjacency of every played map, so tools/cluster.js can measure distance without re-implementing the grid
  const boards = {};
  for (const id of maps) {
    boards[id] = await sess.pages[0].evaluate(mapId => {
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
  let pending = tasks.map((_, i) => i);
  let attempt = 0;
  const t0 = Date.now();
  while (pending.length && attempt < 4) {
    if (attempt > 0) {
      console.log(`reopening browser for ${pending.length} unfinished games (attempt ${attempt + 1})`);
      sess = await open(WORKERS);
    }
    attempt++;
    errs.push(...sess.errs);
    let qi = 0;
    const dead = sess.isDead;
    await Promise.all(sess.pages.map(async p => {
      while (true) {
        if (dead()) break;
        const i = pending[qi++];
        if (i === undefined) break;
        const task = tasks[i];
        try {
          const d = await p.evaluate(async a => {
            window.__rng = window.__mkRng(a.seed);
            if (window.__trace) window.__trace = [];
            if (window.__moves) window.__moves = [];
            window.__turnMs = [];
            await Hot.start(a.names, a.map, a.mode, 'auto', a.bots);
            const d = Hot.dump(); d.trace = window.__trace; d.moves = window.__moves; d.turnMs = window.__turnMs; return d;
          }, { names: NAMES.slice(0, task.n), map: task.map, mode: MODE, bots: task.bots, seed: task.seed });
          if (!d || !d.result) out[i] = { map: task.map, players: task.n, level: task.lvl, seed: task.seed, error: 'no result' };
          else out[i] = summarize(d, task.n, { level: task.lvl, game: task.game, bots: task.bots, seed: task.seed, trace: d.trace, moves: d.moves });
        } catch (e) {
          out[i] = { map: task.map, players: task.n, level: task.lvl, seed: task.seed, error: e.message };
          if (dead() || /closed|crash|disconnected/i.test(e.message)) { console.log(`browser lost during ${task.map} game ${task.game}`); break; }
        }
        const finished = out.filter(Boolean).length;
        if (finished % 25 === 0 || finished === tasks.length) {
          const s = (Date.now() - t0) / 1000;
          console.log(`${finished}/${tasks.length} games  ${s.toFixed(0)}s  ${(finished / Math.max(1, s)).toFixed(2)}/s`);
        }
      }
    }));
    await sess.close();
    pending = pending.filter(i => !out[i] || (out[i].error && /closed|crash|disconnected/i.test(out[i].error)));
    pending.forEach(i => { out[i] = undefined; });
    if (pending.length && attempt >= 4) console.log(`${pending.length} games still unfinished after ${attempt} attempts`);
  }
  const games = out.filter(Boolean);
  fs.writeFileSync(OUT, JSON.stringify({ at: new Date().toISOString(), mode: MODE, seed: SEED, workers: WORKERS, games, maps: boards, errors: errs }, null, 1));
  console.log('games', games.length, 'errors', games.filter(g => g.error).length, 'page errors', errs.length, 'written to', OUT);
}
main().catch(e => { console.error(e); process.exit(1); });
