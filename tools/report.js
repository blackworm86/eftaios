// Aggregates a tools/sim.js output into the metrics the redesign is judged on. Usage: node tools/report.js file.json
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const games = data.games.filter(g => !g.error);
const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const pct = x => (100 * x).toFixed(1) + '%';

// A seat's position in the last 6 moves: how many distinct sectors. Low = camping or shuffling.
function groups(keyFn) {
  const m = new Map();
  games.forEach(g => keyFn(g).forEach(([k, v]) => { if (!m.has(k)) m.set(k, []); m.get(k).push(v); }));
  return m;
}
const byLevel = groups(g => [[g.level, g]]);
const rows = [];
byLevel.forEach((gs, lvl) => {
  const seats = gs.flatMap(g => g.seats);
  const aliens = seats.filter(s => s.role0 === 'alien'), humans = seats.filter(s => s.role0 === 'human');
  rows.push({
    level: lvl, games: gs.length,
    alienWin: pct(avg(gs.map(g => (g.winner === 'alien' ? 1 : 0)))),
    escapeRate: pct(avg(gs.map(g => g.escapes / Math.max(1, g.players - Math.ceil(g.players / 2))))),
    turns: avg(gs.map(g => g.turns)).toFixed(1),
    kills: avg(gs.map(g => g.kills)).toFixed(2),
    attacks: avg(gs.map(g => g.attacks)).toFixed(2),
    alienHitRate: pct(avg(gs.map(g => g.alienAttacks ? g.humanKills / g.alienAttacks : 0))),
    alienMoveRate: pct(avg(aliens.map(s => s.changeRate))),
    humanMoveRate: pct(avg(humans.map(s => s.changeRate))),
    alienCycle: pct(avg(aliens.map(s => s.cycleRate))),
    humanCycle: pct(avg(humans.map(s => s.cycleRate))),
    alienMaxStay: avg(aliens.map(s => s.maxStay)).toFixed(1),
    humanMaxStay: avg(humans.map(s => s.maxStay)).toFixed(1),
  });
});
console.table(rows);
console.log('cycle = share of moves that go back to the sector of two moves before (A-B-A shuffling); target: low');
console.log('maxStay = longest run of turns in the same sector; compare with humanMaxStay (secure sectors are fine)');

// Skill ladder for mixed tables: a seat's side wins how often, by the seat's own level.
// Compare levels across the same tables: a stronger level should win more often than a weaker one, whatever its role.
const mixed = games.filter(g => g.bots && g.level === 'mix');
if (mixed.length) {
  const by = new Map();
  mixed.forEach(g => g.seats.forEach(s => {
    const won = s.role0 === 'alien' ? g.winner === 'alien' : g.winner === 'human';
    if (!by.has(s.bot)) by.set(s.bot, { escaped: 0, kills: 0, n: 0, won: 0, asAlien: 0, asAlienWon: 0, asHuman: 0, asHumanWon: 0 });
    const b = by.get(s.bot); b.n++; if (won) b.won++; if (s.role0 === 'human' && s.over === 'escaped') b.escaped++; if (s.role0 === 'alien') b.kills += s.kills || 0;
    if (s.role0 === 'alien') { b.asAlien++; if (won) b.asAlienWon++; } else { b.asHuman++; if (won) b.asHumanWon++; }
  }));
  console.log('\nSkill ladder (mixed tables): seat-side win rate by level');
  console.table([...by].map(([lvl, b]) => ({ level: lvl, seats: b.n, sideWin: pct(b.won / b.n),
    asAlien: pct(b.asAlienWon / Math.max(1, b.asAlien)), asHuman: pct(b.asHumanWon / Math.max(1, b.asHuman)),
    humanEscapes: pct(b.escaped / Math.max(1, b.asHuman)), alienKills: (b.kills / Math.max(1, b.asAlien)).toFixed(2) })));
}
