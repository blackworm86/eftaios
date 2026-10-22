'use strict';
/* Metrics for a tools/sim.js output. Usage: node tools/score.js file.json [file2 ...] */
const fs = require('fs');
const { summarise } = require('./cluster');

const pct = x => (100 * (x || 0)).toFixed(1) + '%';
function wilsonHalf(k, n) {
  if (!n) return 0;
  const p = k / n, z = 1.96, d = 1 + z * z / n;
  return 100 * (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / d);
}
function metrics(d) {
  const gs = d.games.filter(g => !g.error);
  const aw = gs.filter(g => g.winner === 'alien').length;
  const humans = gs.reduce((a, g) => a + g.seats.filter(s => s.role0 === 'human').length, 0);
  const esc = gs.reduce((a, g) => a + g.seats.filter(s => s.role0 === 'human' && s.over === 'escaped').length, 0);
  const kills = gs.reduce((a, g) => a + g.kills, 0);
  const attacks = gs.reduce((a, g) => a + g.attacks, 0);
  const hit = gs.reduce((a, g) => a + g.humanKills, 0);
  const c = summarise({ games: gs, maps: d.maps });
  const bad = gs.filter(g => g.audit && (!g.audit.stateMatchesLog || g.audit.movesAfterOut || g.audit.missingOut || g.audit.outWithoutSeat)).length;
  const levels = {};
  gs.forEach(g => g.seats.forEach(s => {
    const b = levels[s.bot] = levels[s.bot] || { seats: 0, asHuman: 0, esc: 0, asAlien: 0, kills: 0, sideWins: 0 };
    b.seats++;
    if (s.role0 === 'alien' ? g.winner === 'alien' : g.winner === 'human') b.sideWins++;
    if (s.role0 === 'human') { b.asHuman++; if (s.over === 'escaped') b.esc++; }
    else { b.asAlien++; b.kills += s.kills || 0; }
  }));
  return {
    n: gs.length, alienWin: aw / gs.length, alienWinHalf: wilsonHalf(aw, gs.length),
    escape: esc / Math.max(1, humans), escapeHalf: wilsonHalf(esc, humans),
    kills: kills / Math.max(1, gs.length), hitRate: hit / Math.max(1, attacks),
    clusterRate: c.clusterRate, gamesRun10: c.gamesRun10, games: c.games, auditBad: bad, levels
  };
}
function line(label, d) {
  const m = metrics(d);
  return `${String(label).padEnd(22)} n=${String(m.n).padStart(4)}  alienWin=${pct(m.alienWin).padStart(6)}±${m.alienWinHalf.toFixed(1)}  escape=${pct(m.escape).padStart(6)}±${m.escapeHalf.toFixed(1)}  kills/g=${m.kills.toFixed(2)}  hit=${pct(m.hitRate)}  cluster=${pct(m.clusterRate)}  run10+=${m.gamesRun10}/${m.games}  audit=${m.auditBad ? m.auditBad + 'BAD' : 'ok'}`;
}
module.exports = { metrics, line, pct, wilsonHalf };

if (require.main === module) {
  for (const f of process.argv.slice(2)) {
    try { console.log(line(f.replace(/^.*[\\/]/, ''), JSON.parse(fs.readFileSync(f, 'utf8')))); }
    catch (e) { console.log(f + '  ERROR ' + e.message); }
  }
}
