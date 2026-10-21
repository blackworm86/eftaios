'use strict';
/* Alien-clustering and death-state audit for a tools/sim.js output.
   Definition used here (the handover's "4+ Aliens in one 3-sector area for 10+ turns"):
   a turn is a cluster turn when at least four living Aliens are all within one step of some sector
   and those Aliens occupy at most three distinct sectors. A run is consecutive cluster turns.
   Usage: node tools/cluster.js tools/rounds/<run>.json [--by-map] */
const fs = require('fs');

function posAt(seat, turn) {
  let pos = null;
  for (const r of seat.route || []) { if (r.t <= turn) pos = r.pos; else break; }
  return pos;
}

function analyseGame(g, boards) {
  const board = boards[g.map];
  if (!board) return null;
  const idx = Object.fromEntries(board.cells.map((c, i) => [c, i]));
  const nb = board.nb;
  // Aliens at the start, plus Humans who are reborn as Aliens after their conversion turn
  const aliens = g.seats.filter(s => s.role0 === 'alien' || (s.reborn && s.role === 'alien'));
  const outTurn = {};
  (g.outs || []).forEach(o => { outTurn[o.by] = o.turn; });
  const aliveAt = (s, t) => {
    const o = outTurn[s.id];
    if (o === undefined) return true;
    return s.reborn ? t > o : t <= o;
  };
  let clusterTurns = 0, turns = 0, run = 0, maxRun = 0;
  const maxTurn = Math.max(1, g.turns || 0);
  for (let t = 1; t <= maxTurn; t++) {
    const live = [];
    for (const s of aliens) {
      if (!aliveAt(s, t)) continue;
      const p = posAt(s, t);
      if (p !== null && idx[p] !== undefined) live.push(idx[p]);
    }
    if (live.length < 4) { turns++; run = 0; continue; }
    turns++;
    let cluster = false;
    for (let c = 0; c < board.cells.length && !cluster; c++) {
      let n = 0; const distinct = new Set();
      for (const a of live) if (a === c || nb[c].includes(a)) { n++; distinct.add(a); }
      if (n >= 4 && distinct.size <= 3) cluster = true;
    }
    if (cluster) { clusterTurns++; run++; maxRun = Math.max(maxRun, run); } else run = 0;
  }
  return { map: g.map, players: g.players, turns, clusterTurns, maxRun };
}

function summarise(data) {
  const boards = data.maps || {};
  const games = data.games.filter(g => !g.error);
  const rows = games.map(g => analyseGame(g, boards)).filter(Boolean);
  const sum = rows.reduce((a, r) => ({ turns: a.turns + r.turns, cluster: a.cluster + r.clusterTurns }), { turns: 0, cluster: 0 });
  const runs = rows.map(r => r.maxRun).sort((a, b) => a - b);
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
  const q = p => runs.length ? runs[Math.min(runs.length - 1, Math.floor(p * runs.length))] : 0;
  const bad = games.filter(g => g.audit && (!g.audit.stateMatchesLog || g.audit.movesAfterOut || g.audit.missingOut || g.audit.outWithoutSeat));
  return {
    games: rows.length, turns: sum.turns, clusterTurns: sum.cluster,
    clusterRate: sum.turns ? sum.cluster / sum.turns : 0,
    avgMaxRun: avg(runs), medianMaxRun: q(0.5), p90MaxRun: q(0.9), worstRun: runs.length ? runs[runs.length - 1] : 0,
    gamesRun10: rows.filter(r => r.maxRun >= 10).length,
    auditBad: bad.length, auditSample: bad.slice(0, 5).map(g => ({ map: g.map, seed: g.seed, audit: g.audit })),
    rows
  };
}

module.exports = { analyseGame, summarise };

if (require.main === module) {
  const file = process.argv[2];
  if (!file) { console.error('usage: node tools/cluster.js <sim.json> [--by-map]'); process.exit(1); }
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  const s = summarise(data);
  const pct = x => (100 * x).toFixed(1) + '%';
  console.log(`file            ${file}`);
  console.log(`games           ${s.games}`);
  console.log(`cluster turns   ${s.clusterTurns} / ${s.turns}  (${pct(s.clusterRate)})`);
  console.log(`max run         avg ${s.avgMaxRun.toFixed(2)}  median ${s.medianMaxRun}  p90 ${s.p90MaxRun}  worst ${s.worstRun}`);
  console.log(`games with a 10+ turn run: ${s.gamesRun10} / ${s.games} (${pct(s.games ? s.gamesRun10 / s.games : 0)})`);
  if (process.argv.includes('--by-map')) {
    const by = {};
    s.rows.forEach(r => { (by[r.map] = by[r.map] || []).push(r); });
    console.log('\nmap            games  cluster-turns  rate    avgMaxRun  gamesRun10+');
    Object.keys(by).sort().forEach(m => {
      const rs = by[m], t = rs.reduce((a, r) => a + r.turns, 0), c = rs.reduce((a, r) => a + r.clusterTurns, 0);
      const avg = rs.reduce((a, r) => a + r.maxRun, 0) / rs.length;
      console.log(`${m.padEnd(14)} ${String(rs.length).padStart(5)} ${String(c).padStart(13)}  ${pct(t ? c / t : 0).padStart(6)}  ${avg.toFixed(2).padStart(8)}  ${rs.filter(r => r.maxRun >= 10).length}`);
    });
  }
  console.log(`\ndeath audit     ${s.auditBad === 0 ? 'clean across ' + s.games + ' games' : s.auditBad + ' games with a mismatch'}`);
  if (s.auditBad) { s.auditSample.forEach(x => console.log(`${x.map} seed ${x.seed}: ${JSON.stringify(x.audit)}`)); process.exitCode = 1; }
}
