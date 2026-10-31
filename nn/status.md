# Network training status

Updated 2026-10-31 17:20.

- Iteration: **732**
- Speed: 78 seconds per iteration (46 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 78.7 | 75.6 |
| Aliens (team win %) | 53.6 | 24.2 |

Gain over the Hard copy, both sides added: **+32.6 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 720 (gain +35.4).

## Last log lines

```
2026-10-31 17:11:00 it 725: 25449 decisions in 207 games (44s collect, 34s train), aliens won 42%, loss pol 0.002 val 0.134 ent 0.77, kl to the Hard copy 0.343
2026-10-31 17:12:20 it 726: 26122 decisions in 197 games (45s collect, 35s train), aliens won 38%, loss pol -0.014 val 0.131 ent 0.78, kl to the Hard copy 0.329
2026-10-31 17:13:42 it 727: 26635 decisions in 224 games (46s collect, 36s train), aliens won 42%, loss pol 0.001 val 0.141 ent 0.75, kl to the Hard copy 0.325
2026-10-31 17:15:01 it 728: 26091 decisions in 208 games (45s collect, 35s train), aliens won 44%, loss pol -0.008 val 0.138 ent 0.73, kl to the Hard copy 0.346
2026-10-31 17:16:23 it 729: 25482 decisions in 235 games (47s collect, 34s train), aliens won 41%, loss pol -0.007 val 0.133 ent 0.76, kl to the Hard copy 0.342
2026-10-31 17:17:38 it 730: 25432 decisions in 227 games (42s collect, 34s train), aliens won 40%, loss pol -0.000 val 0.150 ent 0.75, kl to the Hard copy 0.330
2026-10-31 17:18:56 it 731: 25544 decisions in 228 games (44s collect, 34s train), aliens won 41%, loss pol 0.001 val 0.139 ent 0.74, kl to the Hard copy 0.338
2026-10-31 17:20:13 it 732: 25533 decisions in 207 games (44s collect, 34s train), aliens won 44%, loss pol -0.004 val 0.134 ent 0.77, kl to the Hard copy 0.327
```
