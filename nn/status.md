# Network training status

Updated 2026-10-27 04:36.

- Iteration: **138**
- Speed: 76 seconds per iteration (47 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 13 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 69.0 | 71.1 | n/a |
| Aliens (team win %) | 47.2 | 27.9 | n/a |

## Last log lines

```
2026-10-27 04:27:58 it 131: 25688 decisions in 238 games (37s collect, 38s train), aliens won 52%, loss pol -0.001 val 0.123 ent 1.11
2026-10-27 04:29:14 it 132: 26042 decisions in 217 games (38s collect, 38s train), aliens won 57%, loss pol -0.008 val 0.111 ent 1.12
2026-10-27 04:30:31 it 133: 25745 decisions in 260 games (39s collect, 38s train), aliens won 57%, loss pol -0.004 val 0.107 ent 1.08
2026-10-27 04:31:47 it 134: 26239 decisions in 245 games (38s collect, 38s train), aliens won 54%, loss pol -0.001 val 0.110 ent 1.09
2026-10-27 04:33:00 it 135: 25715 decisions in 225 games (36s collect, 38s train), aliens won 55%, loss pol -0.006 val 0.110 ent 1.04
2026-10-27 04:34:15 it 136: 25958 decisions in 221 games (37s collect, 38s train), aliens won 60%, loss pol 0.003 val 0.115 ent 1.04
2026-10-27 04:35:33 it 137: 25523 decisions in 256 games (40s collect, 37s train), aliens won 57%, loss pol -0.001 val 0.106 ent 1.03
2026-10-27 04:36:47 it 138: 25229 decisions in 235 games (37s collect, 37s train), aliens won 54%, loss pol -0.003 val 0.104 ent 1.07
```
