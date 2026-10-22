# Bot harness

The simulator plays the real app code in headless Chrome. On Windows every script here uses Node only; Python and the
`/opt/node22` Playwright install are not needed.

## One-time setup

```
npm install
```

Installs `playwright-core` and `firebase-admin` together from `package.json`; installing one on its own used to prune the other.

Chrome is started from `C:\Program Files\Google\Chrome\Application\chrome.exe` (override with `PW_CHROME`). Playwright's normal
transport uses a named pipe, which the Windows sandbox denies, so `tools/browser.js` starts Chrome with `--remote-debugging-port`
and connects over CDP.

## Commands

```
node tools/serve.js 8123                  # static server, keep it running
node tools/sim.js out.json --games 8 --maps marconi --players 8 --levels hard --seed 1 --workers 8
node tools/report.js out.json             # old-style table
node tools/cluster.js out.json --by-map   # Alien clustering + death audit
node tools/test.js                         # browser tests (starts its own server if needed)
node tools/rules-check.js                  # structural invariants of database.rules.json
node tools/verify-live.js                  # real Firebase + real rules (needs the service-account key)
node tools/cleanup-rooms.js                 # retention sweep, dry run; --apply to delete
npm run test:rules                          # database emulator + all rules cases (needs Java 21)
```

Suite runner (the agreed tables and the train/holdout map split are in `tools/tables.js`):

```
node tools/eval.js --label baseline --games 24 --workers 12 --seed 20261021
node tools/metrics.js tools/rounds/eval-baseline.json --out tools/rounds/baseline.report.txt
```

`--skill '{"hard":{"spread":6}}'` overrides skill numbers for a run. `--no-trace` skips the per-move trace (faster, smaller);
suite runs always pass it. Raw JSON stays in `tools/rounds/` and is gitignored; reports and `NOTES.md` are committed.

## Seeding

`--seed` sets `window.__rng` before each game. The seed is derived from the map, table and game index, so the same
`(seed, map, table, game)` always produces the same game, independent of worker count or scheduling. Use the same seed for
paired A/B comparisons and keep the map split fixed.
