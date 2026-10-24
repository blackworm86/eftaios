# Bot redesign rounds (tools/sim.js, 864 games: 18 maps x 4/6 players x 3 levels x 8 seeds)

| round | change | result |
|---|---|---|
| baseline | current bots | Alien shuffle 20-29%, Human 12-17%; Alien win easy 35 / normal 29 / hard 41% |
| 1 | per-level memory penalty for recently visited sectors (both roles) | shuffle Alien 5-6%, Human 6-9%; win easy 28 / normal 31 / hard 42%; kept, merged (PR #38) |
| 2 | Aliens pursue Human noise announced in the last 2 turns (distance-weighted) | attacks flat (0.85/2.14/4.44 vs 0.96/2.20/4.47); win easy 32 / normal 27 / hard 39%; reverted |

Open question: attacks do not respond to noise, so the limit is probably the attack decision itself
(an Alien only strikes when a Human is in its reach this turn), not the movement.

## Round 3: Alien attack calibration (hard), sweep of humanCal (tools/sweep.sh)

sim now records alienAttacks and humanKills, so alienHitRate = share of Alien attacks that kill a Human.

| humanCal | alien win | attacks/game | alienHitRate |
|---|---|---|---|
| 0.35 (current) | 38.2% | 4.48 | 34.6% |
| 0.70 | 47.6% | 7.70 | 42.4% |
| 1.00 | 52.8% | 9.83 | 37.5% |

Finding: humanCal changes how often Aliens attack, not how well they choose targets (hit rate stays 35-42%).
It is a balance knob. Left at 0.35 until the target win rates are agreed.

## Round 4: skill ladder (mixed tables)

tools/sim.js --mix 'hard:1,easy:5' puts seats of different levels in the same game; report.js prints each level's
side win rate (the side the seat played on: Aliens or Humans).

| table | level | seat side wins |
|---|---|---|
| 1 hard + 5 easy | hard | 50.0% (144 seats) |
| 1 hard + 5 easy | easy | 50.0% (720 seats) |
| 1 easy + 5 hard | easy | 50.7% (144 seats) |
| 1 easy + 5 hard | hard | 49.9% (720 seats) |

Finding: today the levels have no measurable skill difference. A hard seat wins no more often than an easy seat at the same table.
The win-rate gap in the homogeneous tables (easy 35%, hard 41%) comes from the table, not from the seat's skill.

Proposed target (to confirm): in a mixed table, hard seats win clearly more often than easy seats,
and in an all-easy table the bots are beatable by a person's play, i.e. the ladder ordering is what defines the levels.

## Round 4 correction: the ladder exists (personal metrics)

Team win rate hides skill (one seat of six barely moves the outcome). Per-seat metrics, one seat among five of another level:

| table | seat | Human escape | Alien kills/game |
|---|---|---|---|
| 1 hard + 5 easy | hard / easy | 84.6% / 52.6% | 1.00 / 0.19 |
| 1 normal + 5 easy | normal / easy | 77.3% / 56.6% | 0.82 / 0.16 |
| 1 hard + 5 normal | hard / normal | 71.4% / 56.1% | 0.64 / 0.32 |
| 1 easy + 5 hard | easy / hard | 47.3% / 52.2% | 0.54 / 0.41 |

easy < normal < hard holds, but is compressed against hard opponents (last row).

## Round 5: tuning sweep for hard (dw, camp, pot, attackAt), 1 hard + 5 normal, 144 games each

Runs with identical baseline settings (dw=28, camp=16, pot=8, attackAt=0.8) differed by up to 13 points in Human escape and 0.15 in kills:
at 144 games per batch differences under ~10 points are noise. Candidates: dw=14, camp=8.

A/B, 576 games each (tools/ab.sh):

| | side win | Human escape | Alien kills |
|---|---|---|---|
| baseline | 54.3% | 66.1% | 0.84 |
| dw=14, camp=8 | 49.0% | 72.7% | 0.90 |

Result: not adopted (side win drops, escape gain ~1.7 sigma). The hard parameters are near a local optimum:
further gains need new behaviours (fear, bluffing, personalities), not retuning.

## Round 6: Alien target judgement

Trace hooks (window.__trace, window.__moves in bot.js, read by tools/belief.js and tools/moves.js; hard, 6 players, 144 games):
- Alien turns: 10,425; a Human really stood in the sector in 512 (4.9%); Aliens attacked in 141 of those (27.5%); attack hit rate 19%.
- The belief is informative (expected Humans 0.42 where one stands, 0.12 elsewhere) and the attack calibration (humanCal 0.35) is about right.
- Move choice: a Human stands in some reachable sector in 22.4% of moves (ceiling); a random option holds one 3.4%; the chosen option 4.4%;
  the best-by-belief option 8.9%; the best-by-predicted-arrival option 2.6% (worse than random).
- pot sweep (0/2/4/8): contact falls to 2.3% with pot=0, so the arrival term helps in combination.
- New skill key `here` (weight on current belief in the move score, default 0). Contact up (21% -> 28% of the ceiling at here=6) but,
  in the 576-game A/B (1 hard + 5 normal): side win 51.7% vs 54.3%, Alien side 33.0% vs 37.1%, kills 0.88 vs 0.84. Not adopted.

Lesson: a one-step contact metric does not predict results; the game is dynamic (killing a Human changes who plays and how).
Weight changes do not lift the Aliens; a real gain needs a different decision rule (multi-turn planning, herding Humans toward
hatches where Aliens camp), to be tested with the same A/B.

## Round 7: Alien planner (chase / spread / lam)

New skill keys in the Alien move score: `chase` (pull toward the whole picture of where Humans may be, by walking distance, falloff `lam`)
and `spread` (penalty for ending where the other Aliens already cover). 3 players, all hard (1 Human + 2 Aliens), 576 games per row:

| chase / spread / lam | Alien win | kills/game | attacks/game |
|---|---|---|---|
| 0 / 0 / - (before) | 38.5% | 0.42 | 1.64 |
| 4 / 0 / 3 | 38.9% | 0.47 | 1.82 |
| 8 / 0 / 3 | 42.4% | 0.52 | 1.89 |
| 8 / 2 / 3 | 42.9% | 0.52 | 1.83 |
| 16 / 2 / 3 | 42.9% | 0.51 | 1.82 |
| 16 / 2 / 5 | 45.0% | 0.55 | 2.07 |
| 16 / 2 / 8 | 45.5% | 0.50 | 1.84 |
| 30 / 2 / 5 | 48.4% | 0.59 | 1.94 |

Adopted: hard chase 30, spread 2, lam 5; normal chase 12, spread 1, lam 4; easy unchanged (no planner).

Validation (576 seats per row unless noted), seat-side win / human escape / alien kills per game:

| table | before | after |
|---|---|---|
| 1 hard + 5 normal: hard seat | 54.3% / 66.1% / 0.84 | 51.0% / 62.5% / 0.85 (normal opponents are stronger too: kills 0.31 -> 0.39) |
| 1 normal + 5 easy: normal seat | 77.3% Human escape, 0.82 kills | 81.0%, 0.97 |
| 1 hard + 5 easy: hard seat | 84.6% / 1.00 kills | 82.1% / 1.40 kills |
| 6 hard (16 games per map) | Alien hit rate 35% | Alien win 44.4%, hit rate 43.1%, 1.79 kills, Alien shuffle 5.3% |

Ladder order kept: kills hard 1.40 vs easy 0.18 in the same table.

## Round 8: Human fear (3 players, all hard, 576 games per row)

`fear` penalises Human moves into sectors the tracker places within two steps of an Alien.

| fear | Alien win | Human escape | turns |
|---|---|---|---|
| 0 (current) | 47.2% | 52.8% | 10.5 |
| 3 | 49.1% | 50.9% | 11.7 |
| 8 | 56.1% | 43.9% | 13.4 |

Result: fear hurts the Humans. Avoiding the sectors near the Aliens' belief pushes them away from the pods and into longer routes.
Not adopted: `fear` stays 0. The Human side needs a different idea (for example, routes to pods that respect the Aliens' belief
without being pushed away from them), tested with the same A/B.

## Round 9: Human pod choice (podPick), 3 players, all hard

Pods are costed by how much Alien belief covers them (within two steps).

| podPick | 576 games: escape | 1152 games: escape | Alien win (1152) |
|---|---|---|---|
| 0 | 50.0% | 55.3% | 44.7% |
| 3 | 53.3% | - | - |
| 8 | 53.6% | 54.0% | 46.0% |

Result: the 576-game gain did not hold at 1152 games (baseline moved by 5 points between runs, so the noise floor here is about 2-3 points).
Not adopted: podPick stays 0.

Lesson for the Human side: none of the three ideas (fear, pod choice) beats the baseline. Humans may be near a plateau with
this tracker; bluffing (the Human's announcements) is the next lever, as agreed.

## Round 10: bluffing (3 players, all hard, 576 games per row)

Existing bluffing: a Human holding "noise in any sector" scores each decoy by what the Aliens' tracker would make of it (decoy level 2).

| setting | Alien win | Human escape |
|---|---|---|
| decoy 2, bluffW 0.5 (current) | 44.6% | 55.4% |
| decoy 1 (basic decoy) | 50.0% | 50.0% |
| decoy 0 (no deception scoring) | 52.8% | 47.2% |
| decoy 2, bluffW 1.0 | 45.5% | 54.5% |
| decoy 2, bluffW 0.25 | 43.9% | 56.1% |

Result: the deception scoring is worth about 8 points for Humans, and it is already in place. Its weight (bluffW) is flat between 0.25 and 1.0, so bluffW stays at 0.5.

## Round 11: 8 hard players on Marconi (the user's reported table), 32 games per row

| spread | Alien win | Human escape | turns | Alien kills/game | Alien attack hit rate |
|---|---|---|---|---|---|
| 2 (current) | 62.5% | 49.2% | 22.5 | 2.75 | 19.2% |
| 6 | 53.1% | 43.0% | 22.0 | 3.06 | 21.1% |
| 12 | 59.4% | 33.6% | 18.2 | 3.16 | 23.7% |

Result: no clear winner; the margin at 32 games is about ±8 points. Stronger spreading does not stop the clustering seen in the user's log.
Not adopted; the next step is the clustering itself (what keeps Aliens in the same few sectors), not the weight.

## Round 12: Alien lanes (laneW), 8 hard players on Marconi

Each Alien leans toward its own map quadrant (chosen from its id), so Aliens chase different parts of the Human picture.

| laneW | games | Alien win | Human escape | kills/game | attack hit |
|---|---|---|---|---|---|
| 0 | 32 | 59.4% | 49.2% | 2.78 | 19.8% |
| 2 | 32 | 50.0% | 41.4% | 3.03 | 22.7% |
| 4 | 32 | 71.9% | 39.8% | 3.31 | 23.6% |
| 0 | 64 | 57.8% | 46.1% | 3.17 | 19.6% |
| 4 | 64 | 60.9% | 44.1% | 2.84 | 20.4% |

Result: the 32-game gain at weight 4 did not hold at 64 games (the difference is within noise, and kills went down). Not adopted: laneW stays 0.

## Round 13: portable seeded harness and baseline (2026-10-21)

The simulator now runs on the Windows development machine: Chrome is driven over CDP (the default Playwright transport needs a
named pipe the Windows sandbox denies), the static server is Node, and every game has a fixed seed through the existing
`window.__rng` hook. This removes the run-to-run drift that made earlier comparisons hard (up to 5 points on identical settings).

Design of the baseline:
- 12 training maps: socrates, galvani, morgenland, volta, levimontalcini, engarde, sinistra, dilemma, cavour, balena, ascesa, garibaldi.
- 6 held-out maps: galilei, marconi, fermi, frenzy, machiavelli, soundofsilence.
- 24 games per map per table (288 training / 144 held-out games per row), 64 games for 8-player Marconi, seed 20261021.
- 95% intervals in the report are Wilson intervals. Map-to-map variance is larger than these intervals; the train/holdout split is
  there to expose it.
- Reproducibility: five 3-player hard Marconi games at seed 42 were run twice and the game records were identical; the same five
  games with 1 worker and with 4 workers were also identical. Raw data: `tools/rounds/eval-baseline.json` (ignored);
  report: `tools/rounds/baseline.report.txt`.

### Homogeneous tables (Alien win / Human escape)

| table | train (288) | holdout (144) |
|---|---|---|
| 3 hard | 52.1% / 47.9% | 57.6% / 42.4% |
| 6 hard | 44.8% / 47.3% | 52.8% / 41.9% |
| 8 hard | 50.7% / 41.8% | 67.4% / 36.8% |
| 6 normal | 34.7% / 51.7% | 30.6% / 57.2% |
| 6 easy | 30.6% / 66.2% | 33.3% / 71.3% |
| 8 hard Marconi (64) | - | 68.8% / 45.7% |

Targets: hard Alien win at least 55% and Human escape at most 35%; easy Human escape at least 50% and Alien win at most 50%.
Easy passes on both sets. Hard passes Alien win only on the 8-player holdout and Marconi; Human escape is 36.8-47.9% everywhere
(8-player holdout is closest at 36.8%).

### Mixed tables (seat Human escape; kills per Alien seat)

| table | set | strong seat | weak seat | escape gap | kill gap |
|---|---|---|---|---|---|
| 1 hard + 5 normal | train | 57.7% | 52.4% | +5.3 | +0.40 |
| 1 hard + 5 normal | holdout | 82.8% | 51.6% | +31.2 | +0.64 |
| 1 normal + 5 hard | train | 50.8% | 51.4% | -0.6 | -0.01 |
| 1 normal + 5 hard | holdout | 47.1% | 55.8% | -8.7 | +0.06 |
| 1 normal + 5 easy | train | 75.5% | 56.0% | +19.5 | +0.72 |
| 1 normal + 5 easy | holdout | 90.3% | 58.9% | +31.4 | +0.75 |
| 1 easy + 5 normal | train | 50.6% | 59.2% | -8.6 | -0.03 |
| 1 easy + 5 normal | holdout | 55.2% | 50.0% | +5.2 | +0.36 |
| 3p: 1 hard + 2 normal | train | 71.0% | 60.5% | +10.5 | +0.18 |
| 3p: 1 hard + 2 normal | holdout | 76.9% | 56.2% | +20.7 | +0.20 |
| 3p: 1 normal + 2 easy | train | 94.8% | 68.0% | +26.8 | +0.26 |
| 3p: 1 normal + 2 easy | holdout | 100.0% | 60.6% | +39.4 | +0.36 |

The hard-vs-normal gap changes sign with which level is the minority: +5.3/+31.2 when hard is the lone seat, -0.6/-8.7 when normal
is the lone seat. Normal-vs-easy shows the same pattern (+19.5/+31.4 as minority, -8.6/+5.2 as majority). So the current levels are
still mostly a table-composition effect, not a seat-skill effect, which is the problem round 4 identified and rounds 7-12 only
partly moved.

### Clustering and deaths

| table | set | cluster turns | games with a 10+ run | worst run |
|---|---|---|---|---|
| 6 hard | train | 19.3% | 19/288 | 28 |
| 6 hard | holdout | 14.8% | 10/144 | 13 |
| 8 hard | train | 57.6% | 89/288 | 41 |
| 8 hard | holdout | 52.8% | 47/144 | 41 |
| 8 hard Marconi | holdout | 33.8% | 8/64 | 17 |
| 6 easy | train | 4.3% | 2/288 | 14 |
| 6 normal | train | 16.1% | 9/288 | 18 |

The user's report is reproduced: in 8-player hard games more than half of all turns have four or more Aliens inside one 3-sector
area, and 31-33% of games contain a run of ten or more such turns. Death audit: clean on all 4,816 games (every killed/escaped/trapped
end state has a matching log entry, no movement after elimination, reborn Humans counted as conversions).

### Tests

`node tools/test.js` on this machine: 32/34 pass, including bots, kills, layout, online, lobby and all map/marker tests.
Two failures are environment/known issues, not caused by the harness:
- `scan.test.js` needs `python3` with PIL to build a Y4M video; Python is not installed on this machine.
- `turns.test.js` still fails with the known turn-flow problem (the End turn button is intercepted by the dialog).

The test runner pins `en-US` (otherwise labels differ and assertions fail), uses `CDPScreenshotNewSurface` for screenshots, and
disables background throttling so timing tests are stable.

### Verdict

1. The seeded harness works and is worth keeping: identical settings now reproduce exactly, so future A/B rows can use paired seeds.
2. The primary target is not met. 6-player hard loses to the Humans on the training set (Alien win 44.8%) and Human escape stays
   above 35% in every hard table.
3. Hard is not reliably better than normal at the same table. The ladder gap is below +15 points and flips sign with seat composition.
4. Easy is already beatable and meets its target on both map sets.
5. The Marconi clustering is real and large, not a 32-game artefact.

Next: screen the hard Alien parameters on paired seeds (3-player and 6-player hard plus the mixed ladder), then test one structural
anti-clustering term if the weights plateau. Do not start a full 15-dimensional search yet: map variance is larger than the effect
we are looking for.


## Phase 0 (docs/BOT_PLAN.md): the yardstick

`node tools/yardstick.js a.json b.json --out report.txt` reads tools/sim.js outputs. sim.js now also records friendly-fire kills,
cards played and held at the end, powers used (`kind: 'power'` log entries; none exist yet), the public noises, and the time of every bot turn.
Baseline: 900 games (sizes 2-8 x easy/normal/hard x 18 maps x 2 seeds, plus 72 games each of 1 hard + 5 normal and 1 normal + 5 easy), seed 20261023,
`--no-trace --workers 8`. Report: `p0-baseline.report.txt`. Re-run the same three commands after a change to compare on paired seeds.

Findings on the current bots:
- Items: 0.2-1.6 cards played per game against 3-13 still held at the end. Cat, Sensor, Teleport and Mutation are never played; Attack 0.03 per game. Powers: 0.
- Ladder: in mixed tables hard seats win 59.7% (72 seats), normal 48.6%, easy 49.7%. Normal and easy are not separable.
- Friendly fire: 0.25-0.50 kills per game at 8 players (hard), almost all Alien-on-Alien.
- Closing in on a Human noise (nearest Alien, one round later): 0.1-0.4 sectors, hard no better than easy.
- Bunching: 14.8% of turns have 4+ Aliens in a small area; 49 of 900 games have a 10+ turn run.
- Turn time on this machine: mean 2-25 ms, worst 1.35 s (hard, 8 players). The host phone is slower, so the 5 s budget is the thing to watch from Phase 2 on.
- Small tables (2-3 players) are very Human-favoured at every level (Human escape 58-94%).

## Phase 1: use everything held (same 900 games and seed as Phase 0; report `p1.report.txt`)

bot.js now plays every item and power it can: Teleport (Blink Aliens too), Cat, Sensor, Mutation, Adrenaline/Sedatives for the Surge/Silent Alien,
and the powers of Captain, Pilot, Soldier, Executive Officer, Co-pilot, Medic, Fast, Lurking and Psychic Alien (Engineer was already used; Brute and Invisible are passive).
Medic and Co-pilot reveals and Mutation are now read by the belief tracker. Bots count each power use in `seat.ab`; sim.js reads it.

| | Phase 0 | Phase 1 |
|---|---|---|
| powers used per game (hard, 8 players) | 0 | 5.0 |
| cards played per game (hard, 8 players) | 1.17 | 1.86 |
| cards a Human still holds at the end (hard, 8 players) | n/a | 0.64 |
| Cat / Sensor / Mutation / Teleport played per game | 0 / 0 / 0 / 0 | 0.04 / 0.07 / 0.01 / 0.01 |

Most of the 3-13 "cards left" in Phase 0 were Aliens' cards, kept to look Human; Humans now end with under one unplayed card (hard).
Easy still plays no cards on purpose (its skill `items` is false). Attack stays rare (0.02/game): Aliens are rarely believed to stand in a Human's own sector.
Loosening the Attack/Spotlight/Sensor thresholds (atkAt 1.0, spotAt 0.35, sensorAt 0.05) changed play counts by under 0.02 per game, so the thresholds are not the limit; left as is.
Win rates moved within noise (about 10 points at 36 games per cell), except the mixed ladder: hard seats 41.7% vs 59.7% in Phase 0 (72 seats, about +/-11): to re-check at larger size before drawing a conclusion.
Turn time (this machine): worst 0.92 s (hard, 7 players), mean under 20 ms.
Fixed in sim.js: a mutated Human killed later as an Alien is a plain death, not a conversion, in the death audit.

## Phase 1 play-test (owner, 4 games, tests/play-logs/)

| test | seat | rating | what the owner saw |
|---|---|---|---|
| 1 Alien powers | Human | 3 | Blink Alien killed by the Fast Alien on turn 3; Lurking never used its power; Aliens attack early and show themselves; Humans won |
| 2 Alien items | Human | 2 | very low challenge (Humans escaped on turn 31); Silent Alien killed Surge Alien on turn 3 |
| 3 Human powers | Alien | 1 | Soldier never attacked, Executive Officer never stayed, Medic revealed another Human; Aliens won |
| 4 Human items | Alien | 3 | Spotlight and Sensor used; Co-pilot kept cat, mutation, cat, clone, sedatives and escaped |

Findings (from the logs and 3 x 8 hard games):
- Two of the three friendly kills came on turn 3 right after an Alien attacked: another Alien walked into the attacked sector and attacked.
  The tracker still read the first Alien as a Human (an Alien's Character item counted as proof of a Human, cancelling its attack). Fixed: such items are weak evidence.
- That is not the whole cause: in 321 hard attacks, 25 (8%) hit a sector with an Alien in it, and in those the tracker expected a Human there (0.25-1.1) and an Alien only 0-0.15.
  Aliens look Human to each other, so avoiding friendly fire needs the Phase 2 work (inferring allies from behaviour).
- Powers are used in simulation (hard, 6-8 players, uses per seat: Psychic 2.3, Captain 0.8, Fast 0.8, Medic 0.8, Pilot 0.6, Executive Officer 0.6, Soldier 0.4, Engineer 0.3, Lurking 0.14 before the threshold fix, Co-pilot 0.2),
  but Humans in the owner's games died by turn 5-6, before they could use the once-only ones.
- Bots are too weak at hard in the owner's games: Humans won tests 1, 2 and 4. Phase 3 (planning) is where the Aliens get stronger.

## Phase 2: read the whole table (same 900 games and seed; report `p2.report.txt`; Normal and Hard only, Easy unchanged)

New in the belief tracker (bot.js, skill key `table`):
- An attack that hit nobody (no death, Defense, Clone or Brute reveal logged right after it) rules every other player out of that sector at that moment, and counts as evidence for their faction.
- A Human killed or mutated into an Alien restarts / stays where the rules put them (Alien sector / same place) instead of carrying on as a Human.
- The number of Aliens at the table is known (start count, plus kills and mutations, minus dead Aliens): the doubts about who is an Alien are scaled to add up to it.
- Aliens do not always open with Teleport on turn 1 (1 in 4 does).

| hard | Human escape P1 | P2 | kills/game P1 | P2 | friendly kills P1 | P2 |
|---|---|---|---|---|---|---|
| 4 players | 48.6% | 41.7% | 1.28 | 1.39 | 0.25 | 0.14 |
| 5 players | 50.0% | 27.8% | 1.17 | 1.69 | 0.25 | 0.22 |
| 6 players | 36.1% | 26.9% | 2.19 | 2.31 | 0.47 | 0.42 |
| 7 players | 48.1% | 34.3% | 2.14 | 2.39 | 0.72 | 0.56 |
| 8 players | 36.8% | 31.3% | 2.92 | 3.19 | 0.86 | 0.78 |

Seat ladder (1 hard + 5 normal / 1 normal + 5 easy, all seats): Alien kills per game hard 0.65 -> 0.92, normal 0.56 -> 0.66, easy 0.16 -> 0.18; Human escape hard 57% -> 40%, normal 54% -> 43%, easy 61% -> 58%.
Friendly fire drops only 5-30%: the other Aliens still look Human to each other, so the remaining cases need the Phase 3 planner (which also weighs every attack).
Turn time on this machine: worst 2.0 s (normal, 8 players), mean 10-40 ms. On a phone that may break the 5 s budget; chooseDecoy (one belief run per candidate sector) is the first place to cut.
