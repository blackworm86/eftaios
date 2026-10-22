'use strict';
/* Runs a list of skill candidates against one table.
   Usage:
     node tools/screen.js --candidates tools/candidates/s1.json --games 8 --seed 777 --workers 12
     node tools/screen.js --candidates ... --maps holdout --players 8 --levels hard
   The skill JSON is passed to tools/sim.js as one exact argument (no shell quoting). */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { TRAIN, HOLDOUT } = require('./tables');
const { metrics } = require('./score');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const CAND = arg('candidates', '');
const GAMES = +arg('games', 8);
const SEED = +arg('seed', 777);
const WORKERS = Math.max(1, +arg('workers', 12));
const MAPS = arg('maps', 'train');
const PLAYERS = arg('players', '');
const LEVELS = arg('levels', 'hard');
const MIX = arg('mix', '');
const TAG = arg('tag', 's');

if (!CAND) { console.error('usage: node tools/screen.js --candidates <json> [--maps train|holdout|list] [--players 6 --levels hard | --mix ...]'); process.exit(1); }
const maps = TRAIN && MAPS === 'train' ? TRAIN : MAPS === 'holdout' ? HOLDOUT : MAPS.split(',');
const candidates = JSON.parse(fs.readFileSync(path.join(ROOT, CAND), 'utf8'));

function run(args) {
  return new Promise(resolve => {
    const c = spawn(process.execPath, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    c.on('exit', code => resolve(code));
  });
}

(async () => {
  console.log(`candidates ${candidates.length}  maps ${MAPS}(${maps.length})  games/map ${GAMES}  seed ${SEED}  workers ${WORKERS}`);
  const rows = [];
  for (const c of candidates) {
    const out = path.join('tools', 'rounds', `${TAG}-${c.tag}.json`);
    const args = [path.join('tools', 'sim.js'), out, '--games', String(GAMES), '--maps', maps.join(','), '--seed', String(SEED), '--workers', String(WORKERS), '--no-trace', '--skill', JSON.stringify(c.skill || {})];
    if (MIX) args.push('--mix', MIX); else args.push('--players', PLAYERS || '6', '--levels', LEVELS);
    const code = await run(args);
    if (code !== 0) { console.log(c.tag + '  FAILED exit ' + code); continue; }
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, out), 'utf8'));
    const m = metrics(d);
    rows.push({ tag: c.tag, ...m });
    const pct = x => (100 * x).toFixed(1);
    if (MIX) {
      const e = l => m.levels[l];
      const parts = Object.keys(m.levels).sort().map(l => {
        const x = e(l);
        return `${l}: escape ${pct(x.esc / Math.max(1, x.asHuman))}% kills/alien ${(x.kills / Math.max(1, x.asAlien)).toFixed(2)}`;
      });
      console.log(`${String(c.tag).padEnd(22)} alienWin=${pct(m.alienWin)}%  ${parts.join('  ')}  cluster=${pct(m.clusterRate)}%  audit=${m.auditBad ? 'BAD' : 'ok'}`);
    } else {
      console.log(`${String(c.tag).padEnd(22)} alienWin=${pct(m.alienWin)}%±${m.alienWinHalf.toFixed(1)}  escape=${pct(m.escape)}%±${m.escapeHalf.toFixed(1)}  kills/g=${m.kills.toFixed(2)}  cluster=${pct(m.clusterRate)}%  run10+=${m.gamesRun10}/${m.games}  audit=${m.auditBad ? 'BAD' : 'ok'}`);
    }
  }
  const txt = rows.map(r => `${r.tag}\t${(100 * r.alienWin).toFixed(1)}\t${(100 * r.escape).toFixed(1)}\t${r.kills.toFixed(2)}\t${(100 * r.clusterRate).toFixed(1)}\t${r.gamesRun10}\t${r.games}\t${r.auditBad}`).join('\n');
  fs.writeFileSync(path.join(ROOT, 'tools', 'rounds', `${TAG}.tsv`), 'tag\talienWin\tescape\tkills\tcluster\trun10\tgames\tauditBad\n' + txt + '\n');
  console.log(`\nwrote tools/rounds/${TAG}.tsv`);
})().catch(e => { console.error(e); process.exit(1); });
