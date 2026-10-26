# Network training status

Updated 2026-10-26 21:53.

- Iteration: **1113**
- Speed: 81 seconds per iteration (44 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 15 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 61.6 | 72.5 | -0.5 |
| Aliens (team win %) | 76.1 | 27.9 | -2.1 |

Verdict: flat: it has stopped getting better with this setup

## Last log lines

```
2026-10-26 21:45:50 it 1108: 25037 decisions in 289 games (38s collect, 38s train), aliens won 67%, loss pol -0.007 val 0.105 ent 0.72
2026-10-26 21:47:04 it 1109: 25333 decisions in 253 games (36s collect, 38s train), aliens won 67%, loss pol 0.001 val 0.109 ent 0.78
2026-10-26 21:48:21 it 1110: 25743 decisions in 278 games (38s collect, 39s train), aliens won 66%, loss pol 0.002 val 0.107 ent 0.72
2026-10-26 21:49:08 EVAL it 1110 vs rule-based players: as Humans the team wins 65% (rule-based Humans: 75%); as Aliens 75% (rule-based Aliens: 28%)
2026-10-26 21:50:26 it 1111: 25758 decisions in 271 games (40s collect, 38s train), aliens won 69%, loss pol -0.002 val 0.099 ent 0.79
2026-10-26 21:51:43 it 1112: 25611 decisions in 260 games (39s collect, 38s train), aliens won 68%, loss pol 0.003 val 0.100 ent 0.77
2026-10-26 21:53:04 it 1113: 26133 decisions in 287 games (42s collect, 39s train), aliens won 70%, loss pol -0.019 val 0.101 ent 0.75
2026-10-26 21:53:04 STOP file found: finishing
```
