'use strict';
/* Runs the agreed table suite with tools/sim.js and merges the results.
   Usage:
     node tools/eval.js --label baseline --games 24 --workers 8 --seed 1
     node tools/eval.js --label screen1 --tables h1n2,n1e2,hard6 --games 8 --sets train --skill '{"hard":{...}}'
   Raw per-table JSON stays in tools/rounds/ (gitignored); the merged file is what tools/metrics.js reads. */
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { TRAIN, HOLDOUT, TABLES } = require('./tables');

const ROOT = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const LABEL = arg('label', 'run');
const GAMES = +arg('games', 24);
const WORKERS = Math.max(1, +arg('workers', 8));
const SEED = +arg('seed', 1);
const SKILL_FILE = arg('skill-file', '');
const SKILL = SKILL_FILE ? fs.readFileSync(path.join(ROOT, SKILL_FILE), 'utf8') : arg('skill', '');
const SETS = arg('sets', 'train,holdout').split(',').filter(Boolean);
const NAMES = arg('tables', Object.keys(TABLES).join(',')).split(',').filter(Boolean);
const MAP_SETS = { train: TRAIN, holdout: HOLDOUT };

function run(cmd, args) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const c = spawn(cmd, args, { cwd: ROOT, stdio: 'inherit', windowsHide: true });
    c.on('exit', code => resolve({ code, ms: Date.now() - t0 }));
  });
}

(async () => {
  const out = path.join('tools', 'rounds', `eval-${LABEL}.json`);
  let runs = [], runSeed = SEED;
  if (argv.includes('--merge-only')) {
    const prev = JSON.parse(fs.readFileSync(path.join(ROOT, out), 'utf8'));
    runs = prev.runs;
    runSeed = +arg('seed', prev.seed || SEED);
    console.log(`re-merging ${runs.length} existing table files (seed ${runSeed})`);
  } else {
    for (const set of SETS) {
      if (!MAP_SETS[set]) { console.error('unknown set ' + set); process.exit(1); }
      for (const name of NAMES) {
        const t = TABLES[name];
        if (!t) { console.error('unknown table ' + name); process.exit(1); }
        const maps = t.maps || MAP_SETS[set];
        // a fixed-map table (Marconi 8) is evaluated on the holdout pass only
        if (t.maps && set !== 'holdout') continue;
        const file = path.join('tools', 'rounds', `eval-${LABEL}-${name}-${set}.json`);
        const games = t.games || GAMES;
        const args = [path.join('tools', 'sim.js'), file, '--games', String(games), '--maps', maps.join(','), '--seed', String(SEED), '--workers', String(WORKERS), '--no-trace'];
        if (t.mix) args.push('--mix', t.mix); else args.push('--players', String(t.players), '--levels', t.levels);
        if (SKILL) args.push('--skill', SKILL);
        console.log(`\n### ${label(name, set)}  games/map=${games} maps=${maps.length} workers=${WORKERS}`);
        const r = await run(process.execPath, args);
        if (r.code !== 0 || !fs.existsSync(path.join(ROOT, file))) { console.error(`run failed: ${name}/${set} (exit ${r.code})`); process.exit(1); }
        runs.push({ table: name, set, file, seconds: +(r.ms / 1000).toFixed(1) });
        console.log(`### ${name}/${set} done in ${(r.ms / 1000).toFixed(0)}s`);
      }
    }
  }
  const merged = { at: new Date().toISOString(), label: LABEL, seed: runSeed, games: [], maps: {}, runs };
  for (const r of runs) {
    const d = JSON.parse(fs.readFileSync(path.join(ROOT, r.file), 'utf8'));
    Object.assign(merged.maps, d.maps);
    d.games.forEach(g => {
      delete g.trace; delete g.moves;   // --no-trace normally leaves these null; strip anyway
      g.table = r.table; g.set = r.set; merged.games.push(g);
    });
  }
  fs.writeFileSync(path.join(ROOT, out), JSON.stringify(merged));
  console.log(`\nmerged ${merged.games.length} games -> ${out}`);
  console.log(runs.map(r => `${r.table}/${r.set}: ${r.seconds}s`).join('\n'));
})().catch(e => { console.error(e); process.exit(1); });

function label(name, set) { return `${name}-${set}`; }
