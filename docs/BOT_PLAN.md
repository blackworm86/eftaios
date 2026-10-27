# Bot rework plan (agreed with the owner, 2026-10-23)

## Targets
- **Hard:** very hard. An experienced player beats it about 1 game in 4.
- **Normal:** between Easy and Hard, and clearly better than Easy at the same table.
- **Easy:** a beginner wins most games. Bots make visible mistakes but play by the rules.
- **No cheating at any level.** A bot knows only what a person in its seat would know: public announcements, its own role, cards and position.
- **Hidden factions are the core of the game.** No bot knows who its allies are. Aliens infer fellow Aliens from behaviour (2-sector moves, attacks, routes that don't fit a Human) and avoid killing them. Humans do the same. All coordination is implicit: a bot chooses what to do from what it believes the others are doing.
- **Bluffing grows with level:** rare on Easy, sometimes on Normal, deliberate on Hard (fake routes, an Alien moving 1 sector to look Human, misleading noises).
- **Thinking time:** up to 5 seconds per bot turn on the host's phone.
- **Tables:** all sizes from 2 to 8 players, weighted equally.
- **Rules:** Ultimate first, since items and the 16 character powers are the weakest part today. Basic gets the movement and deduction work.
- **Checkpoints:** after each phase, a plain-language report with measured results, then the owner plays a few games before the next phase.

## Today (from bot.js and tools/rounds/NOTES.md)
- Bots keep a per-player position map and faction guess, built from public announcements only. They plan one turn at a time.
- Humans use 4 of 10 items (Adrenaline, Spotlight, Attack, Sedatives), never Cat, Sensor, Teleport or Mutation. Character powers are almost unused.
- Aliens bunch together: in 8-player hard games, more than half the turns have 4+ Aliens in one small area.
- Hard is not reliably better than Normal at the same table. Weight tuning (rounds 5-12) has plateaued.

## Phases
0. **Measure.** Define the yardstick on paired seeds with tools/sim.js: win rate per level in mixed tables, items and powers used per game, speed of closing in on a heard noise, Alien bunching, friendly-fire kills, and time per turn.
1. **Use everything held.** Sensible rules for all items and all 16 character powers, for both roles. This includes Aliens using their character item.
2. **Read the whole table.** Every public event narrows positions and factions: attack results and kills, Spotlight and Sensor reveals, pods closing, eliminations, and movement speed as a faction clue. Each bot keeps a belief about who its allies are.
3. **Plan ahead.**
   - Humans plan 2-3 turns towards the safest reachable pod, against the sectors Aliens could reach.
   - Aliens choose a role from what they believe the others are doing (hunt, guard a pod, intercept a noise) and cut the path instead of following it.
   - Friendly-fire risk weighs every attack.
4. **Real levels.** Easy uses the simple model with mistakes. Normal adds the full reading and short plans. Hard adds deeper plans and deliberate bluffs. Verified in mixed tables against the targets.
5. **Play-test with the owner** and tune from the saved game logs.

## Decisions since the plan was agreed
- **Game records (owner, 2026-10-24):** store anonymous results of finished games from players, with a notice and an opt-out switch in settings (default on), so the bots can be tuned over time from real games. Names stripped, admin-only read, records tagged with the bot code version. Built (records.js): on by default, switch in More and on the start screen, notice on the game-over screen; records are one write each, read only by the admin; opted-out humans are left out of online tables. Admin > Bot tests > "Send players' game records to the repo" writes them to data/game-records/.
- **Alien Teleport:** an Alien does not always open with its Teleport on turn 1 (1 in 4 does). Done.
- **Work happens on `main` only; no new branches.**
- **Speed:** the 5 s bot turn limit must hold on the host's phone; desktop worst case measured 2 s in Phase 2, which is too close.

## The path (decided with the owner, 2026-10-25): the network becomes the bots

No more changes of direction. The trained network improves the bots and, step by step, replaces the hand-built ones.

| Stage | What | Who | Done when |
|---|---|---|---|
| A | Measure the first network against Easy, Normal and Hard in the simulator (`nn` level, rl/ training, nn.js) | owner exports and pushes `nn/net.json`; Claude runs the tables | a table: network win rates by side against each level |
| B | The training engine learns the full rules: all 10 Items and 16 Character powers, with new decisions and inputs; checked against the app like movement was | Claude | tests pass; the Python engine matches the app on items and powers |
| C | Train network v3 with the full rules (imitation of the rule-based item play first, then self-play) | owner runs `run_training.bat` for as long as needed; Claude reads the evaluation | v3 beats the v2 network and the Hard bot in the simulator at every table size and map |
| D | Levels: Easy and Normal from earlier checkpoints / weaker settings, Hard from the best network, tuned to the targets in this plan | Claude; owner plays and rates | the ladder easy < normal < hard holds, Hard is "very hard" for the owner |
| E | Replace the hand-built bots in the app (online and pass-and-play), keep them as the fallback if the network file cannot load; speed checked on a phone | Claude; owner tests on the phone | all levels run on the network, 5 s per bot turn |
| F | Keep improving from the game records (anonymous real games) and league training | both | ongoing |

Rule for the rest of this plan: results decide how long a stage runs, not whether the path continues. If a stage misses its target we train longer, enlarge the network or fix the inputs.

### Fixing the network (after the first comparison, 2026-10-26)

Diagnosis: the network's Humans play at Easy level, its Aliens spam attacks (no counter-play in the training game), and its sparring partners (simple Python rule-based players) are far weaker than the app's Hard bot.
Method: learn from the real teacher first, then improve beyond it.

| Step | What | Who |
|---|---|---|
| 1 | Record the teacher: the real Hard bots playing full-rules games in the app engine, every move / attack / decoy decision saved in the network's input format | Claude builds the recorder; owner runs it on the PC (about 20 min) |
| 2 | Distil: train the network to copy the Hard bot (all seats, all table sizes and maps) | owner runs the training; Claude measures against Hard in the simulator. Target: the network is as strong as Hard |
| 3 | Full rules in the training engine (stage B) with the Humans' counter-play, and Item / power decisions recorded from the teacher and distilled too | Claude |
| 4 | Improve beyond the teacher: self-play and league training with the full rules, the distilled-Hard network as a frozen sparring partner, evaluated against the real Hard bot every few hundred iterations | owner runs; Claude measures |
| 5 | Levels and replacement of the hand-built bots (stages D and E) | both |

**Step 1 done (2026-10-27):** `tools/sim.js --teach` records the real Hard bot (hook in `bot.js` `teach()`, same inputs as `nn.js`); `rl/data/teacher/hard-a.jsonl.gz` holds 164,658 decisions from 1,512 all-Hard games (18 maps, tables of 2-8). Step 2 is menu item 9 of NN.bat (`eftaios_rl/distill.py`).
