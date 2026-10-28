# Network training status

Updated 2026-10-28 17:02.

- Iteration: **310**
- Speed: 80 seconds per iteration (45 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 15 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 65.9 | 70.9 | -4.6 |
| Aliens (team win %) | 59.9 | 29.0 | +17.2 |

Verdict: still improving

## Last log lines

```
2026-10-28 16:54:41 it 305: 26792 decisions in 189 games (39s collect, 41s train), aliens won 61%, loss pol -0.015 val 0.111 ent 0.84
2026-10-28 16:56:01 it 306: 26339 decisions in 196 games (39s collect, 40s train), aliens won 55%, loss pol -0.007 val 0.108 ent 0.75
2026-10-28 16:57:16 it 307: 25673 decisions in 200 games (36s collect, 39s train), aliens won 54%, loss pol -0.006 val 0.106 ent 0.78
2026-10-28 16:58:39 it 308: 26384 decisions in 203 games (42s collect, 40s train), aliens won 55%, loss pol -0.017 val 0.116 ent 0.80
2026-10-28 16:59:56 it 309: 26375 decisions in 183 games (37s collect, 41s train), aliens won 49%, loss pol -0.014 val 0.112 ent 0.79
2026-10-28 17:01:18 it 310: 26491 decisions in 210 games (41s collect, 41s train), aliens won 56%, loss pol -0.004 val 0.115 ent 0.83
2026-10-28 17:02:20 EVAL it 310 vs rule-based players: as Humans the team wins 65% (rule-based Humans: 75%); as Aliens 64% (rule-based Aliens: 31%)
2026-10-28 17:02:20 STOP file found: finishing
```
