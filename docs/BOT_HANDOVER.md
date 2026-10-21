# EFTAIOS bots: handover for the tuning and training work

This document is for the AI (or person) who takes over the bot computation. It says what the project is, what has already
been tried, the tools that exist, the target we want, and how to run and report the work. Read it fully before running anything.

## 1. The project in one paragraph

EFTAIOS is a vanilla JavaScript web app (no build step) for a social deduction board game: Humans try to reach an Escape Pod,
Aliens hunt them, and a Bot plays any seat that no person takes. The rules live in `cards.js`, `game.js`, `hot.js` (pass and play)
and `online.js` (Firebase tables). The bots live in `bot.js`. Everything is in the git repository `blackworm86/eftaios`.

## 2. Where things are

- Repository: `/home/user/eftaios` (remote `blackworm86/eftaios`).
- Work branch: `claude/admiring-maxwell-bjyq0a`. Commit and push there. Do not push to `main` or to `ccr-6928b416-rtom29`
  directly; open a pull request into `ccr-6928b416-rtom29` only when the owner asks for one.
- The bot code: `bot.js`. Its tuning hook is `window.__skill`, read by `skill(lvl)`; a per-level override such as
  `{"hard":{"spread":6}}` replaces the defaults for that level only.
- Defaults per level: `SKILL` at the top of `bot.js` (`easy`, `normal`, `hard`). Each key is documented in a comment next to it.
- Current keys that matter for the planner: `chase`, `lam`, `spread`, `mem`, `dw`, `camp`, `pot`, `attackAt`, `decoy`,
  `humanCal`, `here`, `fear`, `podPick`, `bluffW`, `laneW`. `fear`, `podPick`, `here` and `laneW` default to 0 (off).
- Full history of every experiment, with numbers: `tools/rounds/NOTES.md`. Read it before proposing anything. Rounds 1–12 are there.

## 3. The simulator (what to use, what to trust)

Everything runs the real game code in headless Chromium (Playwright). Nothing is re-implemented, so results match the app.

Prerequisites:
- Node with Playwright at `/opt/node22/lib/node_modules/playwright` (the scripts hard-code this path).
- A static server on port 8123 serving the repository root. Start it with
  `setsid nohup python3 -m http.server 8123 >/dev/null 2>&1 &`. It stops from time to time; if every run fails with
  `ERR_CONNECTION_REFUSED`, restart it. Check with `curl -s -o /dev/null -w "%{http_code}" localhost:8123/`.

Commands:
- `node tools/sim.js OUT.json --games N --players 4,6 --levels easy,normal,hard` plays whole games (all official and expansion maps
  by default; `--maps marconi,galilei` to restrict). `--mix 'hard:1,easy:5'` plays a mixed table, which is how levels are compared.
  `--skill '{"hard":{"spread":6}}'` overrides the bot parameters for that run. `--mode basic` also exists.
- `node tools/report.js OUT.json` prints a table: Alien win rate, Human escape rate, turns, kills, attacks, hit rate, cycling.
  For mixed tables it adds a per-level skill ladder (win rate of each level's seats, and their kills and escapes).
- `tools/ab.sh TAG 'mix' 'skillJSON' GAMES` runs one comparison into `tools/rounds/ab-TAG.*`.
- `tools/marconi8.sh TAG 'skillJSON' GAMES` is the 8-player Marconi table that the user reported.
- Speed: about 1.5 s per 3-player game and 3 s per 8-player game, in one browser. Run several batches in parallel only if they use
  different output names; each batch is one Chromium process.

Sample size (important):
- Team win rates at 32 games per row have a margin of about ±8 points; at 64 games about ±6. Do not decide on fewer than 500
  games per row unless the effect is very large. Several earlier "wins" (lane term at 32 games, pod choice at 576, decoy/bluffing
  weight) disappeared at larger sizes. Use fixed random seeds for paired comparisons if you can add them; otherwise use many games.
- Compare against the baseline run in the same session, not against an old number: identical settings have moved by up to
  5 points between runs.

## 4. What has been tried (do not repeat without a new reason)

From `tools/rounds/NOTES.md`:
- Memory penalty for revisiting sectors: kept. Alien shuffling dropped from 20–29% to 5–6%.
- Alien pursuit of recent noise: reverted (no gain in attacks).
- Alien attack calibration `humanCal`: a balance knob (more attacks, more Alien wins), not a skill gain.
- Alien planner `chase`/`spread`/`lam`: kept on for hard and normal (3-player all-hard: Alien win 38.5% to 48.4%).
- Human fear (`fear`): worse. Humans escape less when they avoid sectors near Aliens.
- Human pod choice (`podPick`): no effect at 1152 games.
- Bluffing weight (`bluffW`): flat between 0.25 and 1.0. The deception scoring itself is worth about 8 points for Humans.
- Hard `dw`, `camp`, `pot`, `attackAt` sweeps: within noise.
- Stronger `spread` on 8-player Marconi: no clear change (round 11).
- Alien lanes (`laneW`): 32-game gain did not hold at 64 games (round 12).

Known open problem (the user's report): on 8-player Marconi with 7 hard bots, Aliens cluster in the same few sectors for many turns,
and Humans walk into covered sectors on their way to the pods. Round 11 and 12 did not fix it.

## 5. The target (the user's words, made concrete)

The user wants:
- Hard bots at hard difficulty are very difficult to beat, both as Aliens and as Humans.
- Easy bots are beatable by a new player.
- Normal bots sit between them.

Proposed measurable targets (confirm with the owner before tuning towards them; these are a proposal):
1. Ladder in mixed tables (`--mix 'hard:1,normal:5'` and `--mix 'normal:1,easy:5'`, and the reverse): each seat's escape rate or kill
   rate should increase with level. Gap goal: hard seat at least 15 points better than normal seat on escape (Humans) and kills
   per game (Aliens).
2. Hard in an all-hard table (3, 6 and 8 players): Human escape at most 35% and Alien win at least 55%, and the reverse for a
   Human-side check. Say which side you are measuring in the report.
3. Easy in an all-easy table: Human escape at least 50%, Alien win at most 50%.
4. No structural failures in the logs: the Alien clustering (4+ Aliens in one 3-sector area for 10+ turns) should be rare in
   8-player games (define the count from `tools/moves.js` or a new check), and killed players must always be marked dead.

The simulator cannot measure how hard the bots feel to a person. Every candidate must be played by the owner before it is merged.

## 6. Recommended method: learn the weights, not the structure

Do not start with a neural network. First:
1. Parameterise each level's behaviour as a vector of the existing skill numbers (about 15 for hard, similar for normal and easy).
   Keep the code paths; only the numbers change.
2. Optimise the vector with an evolution strategy (for example CMA-ES or a simple (mu, lambda) search). Fitness: a weighted
   combination of the targets in section 5, each computed on at least 500 games per candidate (use mixed tables so that the seats
   play against the real opponents). Use a held-out set of maps and seeds to check the best candidate; the training maps
   are the official ones, the test maps are the expansion pack.
3. Run one optimiser per level, with the other levels fixed, then repeat until nothing changes.
4. Accept a candidate only if it wins on held-out maps and on the 8-player Marconi table.

Phase 2 (only if phase 1 cannot meet the targets): a small learned move scorer (an MLP over the same belief features the planner
uses, trained on game results). This is a bigger change and needs an order of magnitude more games. Report phase 1's ceiling first.

Phase 3 (optional, later): self-play, with Humans and Aliens learning side by side. Expect instability; keep the rule-based
bots as the fixed reference opponents.

## 7. Rules for any change

- Every change to bot behaviour sits behind a skill key with the old value as the default, until it is accepted.
- Keep the layout and UI tests green: run `for f in tests/*.test.js; do ...; done` as in previous commits. `turns.test.js` times out
  already and is a known issue; do not hide it.
- Keep `tools/rounds/NOTES.md` up to date: a table of every run with its game count, the setting, and the verdict. Negative results
  count; record them.
- Do not commit raw simulator output (`tools/rounds/*.json` is ignored). Commit the reports and notes.
- Commit messages and pull request text must not name the model or tool that wrote them. Keep the attribution footer as
  the session's standing instructions say.
- Save the simulated batches with their parameters, so any result can be reproduced.

## 8. Reporting back

At each checkpoint (for example every 4–6 hours of simulation), give the owner:
- the best candidate parameters, as a JSON `skill` override;
- its numbers against section 5 targets, with game counts and confidence (give the margin);
- what changed since the previous checkpoint and whether it helped;
- a clear recommendation: play it, keep searching, or stop.
Do not merge anything into `bot.js` defaults without the owner's approval, and do not open a pull request unless asked.

## 9. First steps for the new owner of this work

1. Read `tools/rounds/NOTES.md` and `bot.js` (the `SKILL` table and the `alienMove`, `humanMove` and `chooseDecoy` functions).
2. Start the server, run `tools/marconi8.sh base "{}" 64` and `node tools/report.js` on the output, and check that the numbers
   match the table in `NOTES.md` round 12 (within noise). If they do not, the environment is different; find out why before tuning.
3. Write the search harness (a script under `tools/`, not in `bot.js`) that takes a parameter vector, runs the mixed tables, and
   returns the section 5 numbers. Test it on the baseline first.
4. Only then start the optimiser, in the background, with checkpoints written to `tools/rounds/`.
