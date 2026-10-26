# Network training status

Updated 2026-10-26 20:44.

- Iteration: **1062**
- Speed: 2491 seconds per iteration (1 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 15 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 62.4 | 70.9 | +0.8 |
| Aliens (team win %) | 76.4 | 28.2 | -1.0 |

Verdict: flat: it has stopped getting better with this setup

## Last log lines

```
2026-10-26 07:18:23 it 1060: 25923 decisions in 275 games (42s collect, 38s train), aliens won 71%, loss pol -0.005 val 0.096 ent 0.83
2026-10-26 07:19:14 EVAL it 1060 vs rule-based players: as Humans the team wins 67% (rule-based Humans: 72%); as Aliens 75% (rule-based Aliens: 20%)
2026-10-26 07:20:31 it 1061: 26418 decisions in 311 games (38s collect, 39s train), aliens won 72%, loss pol -0.001 val 0.108 ent 0.73
2026-10-26 07:20:31 STOP file found: finishing
2026-10-26 07:20:32 stopped after 1061 iterations (1458 minutes this session)
2026-10-26 20:43:03 resumed from iteration 1061
2026-10-26 20:43:03 device cuda, 15 workers, 91461 parameters
2026-10-26 20:44:25 it 1062: 25585 decisions in 300 games (43s collect, 39s train), aliens won 66%, loss pol -0.006 val 0.114 ent 0.74
```
