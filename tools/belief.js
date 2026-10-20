// How good is the Aliens' picture of where Humans are? Reads a sim.js output made with the trace hook.
// For every Alien turn (after its move): predicted Humans here vs Humans really here, and what it did.
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const rows = data.games.flatMap(g => (g.trace || []).map(t => Object.assign({ players: g.players }, t)));
console.log('alien decisions', rows.length, ' with a Human really here', rows.filter(r => r.truth > 0).length);
const bins = [0, 0.02, 0.05, 0.1, 0.2, 0.4, 0.8, 99];
const out = [];
for (let i = 0; i < bins.length - 1; i++) {
  const b = rows.filter(r => r.pred >= bins[i] && r.pred < bins[i + 1]);
  if (!b.length) continue;
  const att = b.filter(r => r.attack);
  out.push({ predBin: bins[i] + '-' + bins[i + 1], n: b.length, avgPred: (b.reduce((s, r) => s + r.pred, 0) / b.length).toFixed(3),
    realHumans: (b.reduce((s, r) => s + r.truth, 0) / b.length).toFixed(3), pHuman: (b.filter(r => r.truth > 0).length / b.length).toFixed(3),
    attackRate: (att.length / b.length).toFixed(2), attackHit: att.length ? (att.filter(r => r.truth > 0).length / att.length).toFixed(2) : '-' });
}
console.table(out);
// oracle: how often could an attack have hit, and what the bot does
const hit = rows.filter(r => r.truth > 0), att = rows.filter(r => r.attack);
console.log('attacks', att.length, 'hit', att.filter(r => r.truth > 0).length, '| turns with a Human here', hit.length, 'attacked', hit.filter(r => r.attack).length);
// ranking: where would a perfect-ordering attacker pick among the turns? average pred when a Human is there vs not
const avg = a => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
console.log('mean pred when a Human is here', avg(hit.map(r => r.pred)).toFixed(3), ' when none', avg(rows.filter(r => !r.truth).map(r => r.pred)).toFixed(3));
