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
