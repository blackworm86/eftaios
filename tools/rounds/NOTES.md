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
