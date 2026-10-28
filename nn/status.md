# Network training status

Updated 2026-10-28 12:02.

- Iteration: **103**
- Speed: 77 seconds per iteration (47 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against simple rule-based players (average of the last 10 evaluations)

| | network | rule-based players | change since the 15 before |
|---|---|---|---|
| Humans (team win %) | 72.3 | 73.0 | n/a |
| Aliens (team win %) | 37.0 | 28.6 | n/a |

## Last log lines

```
2026-10-28 11:53:44 it 97: 25369 decisions in 220 games (37s collect, 39s train), aliens won 31%, loss pol -0.009 val 0.104 ent 0.84
2026-10-28 11:55:00 it 98: 26109 decisions in 212 games (37s collect, 40s train), aliens won 35%, loss pol -0.007 val 0.110 ent 0.87
2026-10-28 11:56:18 it 99: 25764 decisions in 206 games (38s collect, 39s train), aliens won 37%, loss pol -0.007 val 0.109 ent 0.84
2026-10-28 11:57:35 it 100: 25001 decisions in 190 games (38s collect, 38s train), aliens won 38%, loss pol -0.012 val 0.105 ent 0.89
2026-10-28 11:58:37 EVAL it 100 vs rule-based players: as Humans the team wins 69% (rule-based Humans: 73%); as Aliens 42% (rule-based Aliens: 32%)
2026-10-28 11:59:54 it 101: 26063 decisions in 197 games (37s collect, 39s train), aliens won 32%, loss pol -0.008 val 0.118 ent 0.87
2026-10-28 12:01:09 it 102: 25557 decisions in 212 games (36s collect, 39s train), aliens won 39%, loss pol -0.009 val 0.115 ent 0.85
2026-10-28 12:02:28 it 103: 26197 decisions in 217 games (38s collect, 40s train), aliens won 34%, loss pol -0.003 val 0.104 ent 0.87
```
