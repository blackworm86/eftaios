# Network training status

Updated 2026-10-28 15:03.

- Iteration: **234**
- Speed: 78 seconds per iteration (46 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 15 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 67.7 | 70.5 | -5.0 |
| Aliens (team win %) | 52.1 | 29.4 | +15.5 |

Verdict: still improving

## Last log lines

```
2026-10-28 14:54:48 it 228: 26382 decisions in 175 games (39s collect, 40s train), aliens won 51%, loss pol -0.014 val 0.102 ent 0.88
2026-10-28 14:56:08 it 229: 26364 decisions in 171 games (40s collect, 40s train), aliens won 50%, loss pol -0.010 val 0.110 ent 0.92
2026-10-28 14:57:28 it 230: 27325 decisions in 190 games (39s collect, 42s train), aliens won 46%, loss pol -0.007 val 0.110 ent 0.85
2026-10-28 14:58:27 EVAL it 230 vs rule-based players: as Humans the team wins 63% (rule-based Humans: 71%); as Aliens 59% (rule-based Aliens: 26%)
2026-10-28 14:59:46 it 231: 26703 decisions in 196 games (39s collect, 41s train), aliens won 51%, loss pol -0.014 val 0.107 ent 0.83
2026-10-28 15:01:03 it 232: 26102 decisions in 177 games (37s collect, 40s train), aliens won 54%, loss pol -0.005 val 0.110 ent 0.89
2026-10-28 15:02:21 it 233: 26389 decisions in 190 games (38s collect, 40s train), aliens won 52%, loss pol -0.011 val 0.105 ent 0.88
2026-10-28 15:03:39 it 234: 25243 decisions in 184 games (39s collect, 38s train), aliens won 40%, loss pol -0.008 val 0.121 ent 0.88
```
