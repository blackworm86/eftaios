'use strict';
/* Phase 0 yardstick for the bot rework (docs/BOT_PLAN.md): one report from tools/sim.js outputs.
   Usage: node tools/yardstick.js out1.json [out2.json ...] [--out report.txt]
   Run sim.js with --no-trace so turn times are not inflated by the trace hook. Seeds pair across runs
   with the same (seed, map, table, game), so run the same command before and after a change. */
const fs = require('fs');
const argv = process.argv.slice(2);
const oi = argv.indexOf('--out'), OUT = oi >= 0 ? argv[oi + 1] : null;
const files = argv.filter((a, i) => !a.startsWith('--') && (oi < 0 || i !== oi + 1));
if (!files.length) { console.error('usage: node tools/yardstick.js <sim.json>... [--out file]'); process.exit(1); }
const games = [], boards = {};
files.forEach(f => { const d = JSON.parse(fs.readFileSync(f, 'utf8')); d.games.filter(g => !g.error).forEach(g => games.push(g)); Object.assign(boards, d.maps); });
const lines = [], say = s => { lines.push(s); console.log(s); };
const pct = x => (100 * x).toFixed(1) + '%', avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const wins = g => ({ alien: g.winner === 'alien' });
const posAt = (s, t) => { let p = null; for (const r of s.route || []) { if (r.t <= t) p = r.pos; else break; } return p; };
const bfs = (nb, from) => { const d = Array(nb.length).fill(Infinity); d[from] = 0; const q = [from]; for (let i = 0; i < q.length; i++) nb[q[i]].forEach(j => { if (d[j] === Infinity) { d[j] = d[q[i]] + 1; q.push(j); } }); return d; };

// closing speed: for each Human noise (a noise is announced by the sector, so Aliens hear it), how much nearer
// the closest living Alien is one round later. Positive = Aliens close in on the noise.
const distCache = {};
function closing(g) {
  const b = boards[g.map]; if (!b) return [];
  const idx = Object.fromEntries(b.cells.map((c, i) => [c, i]));
  const byId = Object.fromEntries(g.seats.map(s => [s.id, s]));
  const outTurn = {}; (g.outs || []).forEach(o => { outTurn[o.by] = o.turn; });
  const aliens = g.seats.filter(s => s.role0 === 'alien');
  const res = [];
  (g.noises || []).forEach(n => {
    const src = byId[n.by]; if (!src || src.role0 !== 'human' || idx[n.sector] === undefined) return;
    const d = distCache[g.map + n.sector] || (distCache[g.map + n.sector] = bfs(b.nb, idx[n.sector]));
    const near = t => { const ds = aliens.filter(s => outTurn[s.id] === undefined || outTurn[s.id] > t).map(s => posAt(s, t)).filter(p => idx[p] !== undefined).map(p => d[idx[p]]); return ds.length ? Math.min(...ds) : null; };
    const a = near(n.turn), z = near(n.turn + 1);
    if (a !== null && z !== null) res.push(a - z);
  });
  return res;
}

const group = (arr, f) => { const m = new Map(); arr.forEach(x => { const k = f(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
say(`EFTAIOS bot yardstick   ${games.length} games from ${files.length} file(s)`);
say('');
say('## per table (level x players), games with the same table are paired by seed across runs');
say('table'.padEnd(18) + 'games  alienWin  escape  kills  friendly  items-used  items-left  powers  closing  turn ms (mean/max)');
const tables = group(games, g => (g.level === 'mix' ? 'mix ' + (g.bots || []).join(',').replace(/(\w+)(,\1)+/g, '$1*') : g.level) + ' x' + g.players);
[...tables.keys()].sort().forEach(k => {
  const gs = tables.get(k);
  const esc = gs.reduce((a, g) => a + g.escapes, 0), hum = gs.reduce((a, g) => a + g.seats.filter(s => s.role0 === 'human').length, 0);
  const cl = gs.flatMap(closing);
  const ms = gs.flatMap(g => Object.values(g.turnMs || {})), n = ms.reduce((a, t) => a + t.n, 0);
  const used = avg(gs.map(g => Object.values(g.itemUse || {}).reduce((a, x) => a + x, 0))), left = avg(gs.map(g => Object.values(g.itemsLeft || {}).reduce((a, x) => a + x, 0)));
  say(k.padEnd(18) + String(gs.length).padStart(5) + pct(avg(gs.map(g => +wins(g).alien))).padStart(10) + pct(esc / Math.max(1, hum)).padStart(8)
    + avg(gs.map(g => g.kills)).toFixed(2).padStart(7) + avg(gs.map(g => g.friendlyKills || 0)).toFixed(2).padStart(10)
    + used.toFixed(2).padStart(12) + left.toFixed(2).padStart(12) + avg(gs.map(g => g.powers || 0)).toFixed(2).padStart(8)
    + (cl.length ? avg(cl).toFixed(2) : '-').padStart(9) + (n ? `  ${(ms.reduce((a, t) => a + t.sum, 0) / n).toFixed(1)}/${Math.max(...ms.map(t => t.max)).toFixed(0)}` : '  -'));
});

say('');
say('## items played per game, by card (defense/clone = saves)');
const cards = [...new Set(games.flatMap(g => Object.keys(g.itemUse || {}).concat(Object.keys(g.itemsLeft || {}))))].sort();
say('card'.padEnd(12) + 'played/game  held-at-end/game');
cards.forEach(c => say(c.padEnd(12) + avg(games.map(g => (g.itemUse || {})[c] || 0)).toFixed(3).padStart(11) + avg(games.map(g => (g.itemsLeft || {})[c] || 0)).toFixed(3).padStart(18)));

say('');
say('## skill ladder in mixed tables (seat side win, by level)');
const mixed = games.filter(g => g.level === 'mix'), by = new Map();
mixed.forEach(g => g.seats.forEach(s => { const won = s.role0 === 'alien' ? g.winner === 'alien' : g.winner === 'human'; const b = by.get(s.bot) || { n: 0, w: 0 }; b.n++; b.w += +won; by.set(s.bot, b); }));
by.forEach((b, l) => say(`${l.padEnd(8)} ${String(b.n).padStart(5)} seats  ${pct(b.w / b.n)}`));
if (!by.size) say('(no mixed tables in these files)');

say('');
say('## Alien bunching (4+ Aliens within one small area)');
const { summarise } = require('./cluster');
const c = summarise({ games, maps: boards });
say(`cluster turns ${pct(c.clusterRate)}   games with a 10+ turn run ${c.gamesRun10}/${c.games}   death audit ${c.auditBad ? c.auditBad + ' BAD' : 'clean'}`);
say('');
say('turn ms is measured on this machine; the host phone is several times slower, so the 5 s budget is met when max stays well under ~1000 ms here');
if (OUT) fs.writeFileSync(OUT, lines.join('\n') + '\n');
