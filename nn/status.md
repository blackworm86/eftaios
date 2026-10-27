# Network training status

Updated 2026-10-27 07:05.

- Iteration: **246**
- Speed: 77 seconds per iteration (47 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 15 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 65.1 | 70.6 | -5.5 |
| Aliens (team win %) | 62.2 | 28.9 | +20.5 |

Verdict: still improving

## Last log lines

```
2026-10-27 06:55:46 it 240: 25977 decisions in 198 games (40s collect, 38s train), aliens won 66%, loss pol -0.009 val 0.078 ent 1.07
2026-10-27 06:56:33 EVAL it 240 vs rule-based players: as Humans the team wins 66% (rule-based Humans: 76%); as Aliens 65% (rule-based Aliens: 30%)
2026-10-27 06:57:52 it 241: 25802 decisions in 224 games (41s collect, 38s train), aliens won 57%, loss pol -0.006 val 0.108 ent 1.06
2026-10-27 06:59:09 it 242: 25889 decisions in 199 games (38s collect, 38s train), aliens won 62%, loss pol -0.004 val 0.092 ent 1.08
2026-10-27 07:00:22 it 243: 24937 decisions in 176 games (37s collect, 36s train), aliens won 67%, loss pol -0.003 val 0.085 ent 1.14
2026-10-27 07:01:40 it 244: 26534 decisions in 208 games (39s collect, 39s train), aliens won 63%, loss pol -0.011 val 0.086 ent 1.01
2026-10-27 07:02:58 it 245: 25994 decisions in 221 games (40s collect, 38s train), aliens won 63%, loss pol -0.000 val 0.079 ent 1.12
2026-10-27 07:04:13 it 246: 25753 decisions in 198 games (37s collect, 38s train), aliens won 64%, loss pol -0.005 val 0.089 ent 1.10
```
