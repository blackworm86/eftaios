// How well do the Aliens choose where to move? Reads a sim.js output with the move trace.
// For each Alien move: does the chosen sector hold a Human, and would other rules (best belief, best next-turn prediction) have done better?
const fs = require('fs');
const data = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const mv = data.games.flatMap(g => g.moves || []);
const best = (o, k) => o.reduce((m, x) => (x[k] > m[k] ? x : m), o[0]);
let n = 0, any = 0, ch = 0, bp = 0, bn = 0, rnd = 0, cnt = 0;
mv.forEach(m => { const o = m.opts; if (!o.length) return; n++; any += o.some(x => x.truth > 0); ch += o.find(x => x.chosen).truth > 0;
  bp += best(o, 'pred').truth > 0; bn += best(o, 'next').truth > 0; rnd += o.filter(x => x.truth > 0).length / o.length; cnt += o.length; });
const pct = x => (100 * x / n).toFixed(1) + '%';
console.log('alien moves', n, ' avg options', (cnt / n).toFixed(1));
console.log('a Human stands in some option:', pct(any), '(the ceiling)');
console.log('random option holds a Human:  ', pct(rnd));
console.log('chosen option holds a Human:  ', pct(ch));
console.log('best-by-belief (pred) option:  ', pct(bp));
console.log('best-by-next (humans arriving) option:', pct(bn));
