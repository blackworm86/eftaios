# Network training status

Updated 2026-10-31 19:16.

- Iteration: **808**
- Speed: 79 seconds per iteration (46 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 78.3 | 73.9 |
| Aliens (team win %) | 57.2 | 25.7 |

Gain over the Hard copy, both sides added: **+35.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 760 (gain +38.8).

## Last log lines

```
2026-10-31 19:08:50 it 802: 26403 decisions in 226 games (45s collect, 35s train), aliens won 52%, loss pol 0.005 val 0.145 ent 0.74, kl to the Hard copy 0.379
2026-10-31 19:10:07 it 803: 25426 decisions in 199 games (43s collect, 34s train), aliens won 47%, loss pol -0.004 val 0.123 ent 0.77, kl to the Hard copy 0.352
2026-10-31 19:11:22 it 804: 25377 decisions in 198 games (41s collect, 34s train), aliens won 49%, loss pol 0.001 val 0.153 ent 0.81, kl to the Hard copy 0.367
2026-10-31 19:12:43 it 805: 25399 decisions in 219 games (45s collect, 36s train), aliens won 44%, loss pol -0.002 val 0.137 ent 0.79, kl to the Hard copy 0.355
2026-10-31 19:14:06 it 806: 25086 decisions in 216 games (47s collect, 36s train), aliens won 46%, loss pol 0.000 val 0.148 ent 0.78, kl to the Hard copy 0.365
2026-10-31 19:15:30 it 807: 25395 decisions in 218 games (51s collect, 34s train), aliens won 44%, loss pol -0.006 val 0.139 ent 0.78, kl to the Hard copy 0.349
2026-10-31 19:16:50 it 808: 25586 decisions in 200 games (44s collect, 36s train), aliens won 40%, loss pol -0.008 val 0.126 ent 0.79, kl to the Hard copy 0.344
2026-10-31 19:16:50 STOP file found: finishing
```
