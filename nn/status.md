# Network training status

Updated 2026-10-31 11:19.

- Iteration: **492**
- Speed: 84 seconds per iteration (43 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 78.9 | 73.6 |
| Aliens (team win %) | 43.3 | 27.7 |

Gain over the Hard copy, both sides added: **+20.9 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 480 (gain +23.6).

## Last log lines

```
2026-10-31 11:09:57 it 485: 26060 decisions in 210 games (50s collect, 37s train), aliens won 39%, loss pol 0.000 val 0.125 ent 0.82, kl to the Hard copy 0.227
2026-10-31 11:11:19 it 486: 25379 decisions in 186 games (47s collect, 36s train), aliens won 34%, loss pol -0.011 val 0.127 ent 0.80, kl to the Hard copy 0.234
2026-10-31 11:12:42 it 487: 25497 decisions in 213 games (47s collect, 36s train), aliens won 37%, loss pol 0.003 val 0.136 ent 0.77, kl to the Hard copy 0.238
2026-10-31 11:14:05 it 488: 25257 decisions in 215 games (47s collect, 36s train), aliens won 25%, loss pol -0.002 val 0.105 ent 0.77, kl to the Hard copy 0.244
2026-10-31 11:15:27 it 489: 25420 decisions in 179 games (47s collect, 36s train), aliens won 37%, loss pol 0.001 val 0.123 ent 0.84, kl to the Hard copy 0.245
2026-10-31 11:16:49 it 490: 26159 decisions in 185 games (45s collect, 37s train), aliens won 28%, loss pol -0.008 val 0.097 ent 0.80, kl to the Hard copy 0.229
2026-10-31 11:18:08 it 491: 25133 decisions in 201 games (43s collect, 36s train), aliens won 37%, loss pol 0.003 val 0.135 ent 0.80, kl to the Hard copy 0.235
2026-10-31 11:19:32 it 492: 25985 decisions in 206 games (47s collect, 37s train), aliens won 44%, loss pol -0.006 val 0.136 ent 0.80, kl to the Hard copy 0.243
```
