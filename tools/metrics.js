'use strict';
/* Human-readable target report for a merged tools/eval.js output.
   Usage: node tools/metrics.js tools/rounds/eval-<label>.json [--out report.txt] */
const fs = require('fs');
const { summarise } = require('./cluster');
const { TABLES } = require('./tables');

const file = process.argv[2];
if (!file) { console.error('usage: node tools/metrics.js <eval.json> [--out file]'); process.exit(1); }
const outIdx = process.argv.indexOf('--out');
const OUT = outIdx > 0 ? process.argv[outIdx + 1] : null;
const data = JSON.parse(fs.readFileSync(file, 'utf8'));
const games = data.games.filter(g => !g.error);
const lines = [];
const say = s => { lines.push(s); console.log(s); };

const pct = x => (100 * (x || 0)).toFixed(1) + '%';
const num = (x, d = 2) => (x || 0).toFixed(d);
// Wilson 95% interval for a proportion; returns the half-width in points
function wilsonHalf(k, n) {
  if (!n) return 0;
  const p = k / n, z = 1.96, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d;
  const h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d;
  return 100 * h;
}
const group = (arr, fn) => { const m = new Map(); arr.forEach(x => { const k = fn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); }); return m; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

function homog(gs) {
  const alienWins = gs.filter(g => g.winner === 'alien').length;
  const humans = gs.reduce((a, g) => a + g.seats.filter(s => s.role0 === 'human').length, 0);
  const esc = gs.reduce((a, g) => a + g.seats.filter(s => s.role0 === 'human' && s.over === 'escaped').length, 0);
  const kills = gs.reduce((a, g) => a + g.kills, 0);
  const attacks = gs.reduce((a, g) => a + g.attacks, 0);
  const hit = gs.reduce((a, g) => a + g.humanKills, 0);
  const as = summarise({ games: gs, maps: data.maps });
  const badAudit = gs.filter(g => g.audit && (!g.audit.stateMatchesLog || g.audit.movesAfterOut || g.audit.missingOut || g.audit.outWithoutSeat)).length;
  return {
    n: gs.length, alienWin: alienWins / gs.length, alienWinHalf: wilsonHalf(alienWins, gs.length),
    escape: esc / Math.max(1, humans), escapeHalf: wilsonHalf(esc, humans),
    turns: avg(gs.map(g => g.turns)), kills: kills / gs.length, attacks: attacks / gs.length,
    hitRate: hit / Math.max(1, attacks), auditBad: badAudit, cluster: as
  };
}

function mixed(gs) {
  const by = new Map();
  gs.forEach(g => g.seats.forEach(s => {
    if (!by.has(s.bot)) by.set(s.bot, { level: s.bot, seats: 0, asHuman: 0, escapes: 0, asAlien: 0, kills: 0, sideWins: 0 });
    const b = by.get(s.bot); b.seats++;
    const won = s.role0 === 'alien' ? g.winner === 'alien' : g.winner === 'human';
    if (won) b.sideWins++;
    if (s.role0 === 'human') { b.asHuman++; if (s.over === 'escaped') b.escapes++; }
    else { b.asAlien++; b.kills += s.kills || 0; }
  }));
  return by;
}

const tableSets = group(games, g => g.table + '|' + g.set);
const order = Object.keys(TABLES).filter(t => tableSets.has(t + '|train') || tableSets.has(t + '|holdout'));

say(`EFTAIOS bot evaluation: ${data.label || file}   seed ${data.seed}   ${games.length} games`);
say(`generated ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`);
say('');

for (const tname of order) {
  const t = TABLES[tname];
  for (const set of ['train', 'holdout']) {
    const gs = (tableSets.get(tname + '|' + set) || []);
    if (!gs.length) continue;
    say(`## ${tname} / ${set} (${gs.length} games)`);
    if (!t.mix) {
      const r = homog(gs);
      const target = tname === 'hard3' || tname === 'hard6' || tname === 'hard8'
        ? `  target: alien win >=55%, human escape <=35%`
        : tname === 'easy6' ? `  target: human escape >=50%, alien win <=50%` : '';
      say(`alien win ${pct(r.alienWin)} +/-${num(r.alienWinHalf, 1)}   human escape ${pct(r.escape)} +/-${num(r.escapeHalf, 1)}   turns ${num(r.turns, 1)}   kills/game ${num(r.kills)}   hit rate ${pct(r.hitRate)}${target}`);
      say(`cluster turns ${pct(r.cluster.clusterRate)}   max run avg ${num(r.cluster.avgMaxRun)} / worst ${r.cluster.worstRun}   games with 10+ run ${r.cluster.gamesRun10}/${r.cluster.games}   death audit ${r.auditBad ? r.auditBad + ' BAD' : 'clean'}`);
    } else {
      const by = mixed(gs);
      const strong = t.pair[0], weak = t.pair[1];
      const a = by.get(strong), b = by.get(weak);
      say(`level     seats  humanSeats  escapeRate   alienSeats  kills/alienSeat  sideWin`);
      [strong, weak].forEach(l => {
        const x = by.get(l);
        say(`${l.padEnd(9)} ${String(x.seats).padStart(5)}  ${String(x.asHuman).padStart(10)}  ${pct(x.escapes / Math.max(1, x.asHuman)).padStart(10)}   ${String(x.asAlien).padStart(10)}  ${num(x.kills / Math.max(1, x.asAlien)).padStart(15)}  ${pct(x.sideWins / x.seats).padStart(7)}`);
      });
      if (a && b) {
        const gapE = 100 * (a.escapes / Math.max(1, a.asHuman) - b.escapes / Math.max(1, b.asHuman));
        const gapK = a.kills / Math.max(1, a.asAlien) - b.kills / Math.max(1, b.asAlien);
        say(`gap ${strong}-${weak}: escape ${gapE >= 0 ? '+' : ''}${gapE.toFixed(1)} pts   kills/alienSeat ${gapK >= 0 ? '+' : ''}${gapK.toFixed(2)}   (target escape gap >= +15 pts)`);
      }
      const c = summarise({ games: gs, maps: data.maps });
      const badAudit = gs.filter(g => g.audit && (!g.audit.stateMatchesLog || g.audit.movesAfterOut || g.audit.missingOut || g.audit.outWithoutSeat)).length;
      say(`cluster turns ${pct(c.clusterRate)}   games with 10+ run ${c.gamesRun10}/${c.games}   death audit ${badAudit ? badAudit + ' BAD' : 'clean'}`);
    }
    say('');
  }
}

// target scorecard, holdout first because it is the unbiased check
say('## target scorecard');
for (const tname of ['hard6', 'hard8', 'marconi8', 'easy6', 'h1n5', 'n1h5', 'n1e5', 'e1n5']) {
  for (const set of ['holdout', 'train']) {
    const gs = tableSets.get(tname + '|' + set) || [];
    if (!gs.length) continue;
    const t = TABLES[tname];
    if (!t.mix) {
      const r = homog(gs);
      const checks = [];
      if (['hard6', 'hard8', 'marconi8'].includes(tname)) {
        checks.push(['alien win >=55%', r.alienWin >= 0.55, pct(r.alienWin)]);
        checks.push(['human escape <=35%', r.escape <= 0.35, pct(r.escape)]);
      }
      if (tname === 'easy6') {
        checks.push(['human escape >=50%', r.escape >= 0.50, pct(r.escape)]);
        checks.push(['alien win <=50%', r.alienWin <= 0.50, pct(r.alienWin)]);
      }
      say(`${tname}/${set}: ` + checks.map(c => `${c[0]} ${c[1] ? 'PASS' : 'FAIL'} (${c[2]})`).join('   '));
    } else {
      const by = mixed(gs), a = by.get(t.pair[0]), b = by.get(t.pair[1]);
      const gap = 100 * (a.escapes / Math.max(1, a.asHuman) - b.escapes / Math.max(1, b.asHuman));
      say(`${tname}/${set}: ${t.pair[0]} escape ${pct(a.escapes / Math.max(1, a.asHuman))} vs ${t.pair[1]} ${pct(b.escapes / Math.max(1, b.asHuman))} -> gap ${gap >= 0 ? '+' : ''}${gap.toFixed(1)} pts ${gap >= 15 ? 'PASS' : 'FAIL'} (target +15)`);
    }
  }
}

if (OUT) { fs.writeFileSync(OUT, lines.join('\n') + '\n'); console.log('\nwritten to ' + OUT); }
