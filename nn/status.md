# Network training status

Updated 2026-11-03 18:46.

- Iteration: **290**
- Speed: 105 seconds per iteration (34 per hour)
- Network: 128 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.6 | 73.7 |
| Aliens (team win % minus Humans escaped %) | -18.2 | -31.6 |

Gain over the Hard copy, both sides added: **+17.3 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 200 (gain +20.3).

## Last log lines

```
2026-11-03 18:35:35 it 284: 25396 decisions in 216 games (60s collect, 47s train), aliens won 32%, loss pol -0.005 val 0.167 ent 0.74, kl to the Hard copy 0.140
2026-11-03 18:37:20 it 285: 25584 decisions in 179 games (57s collect, 48s train), aliens won 32%, loss pol 0.003 val 0.158 ent 0.72, kl to the Hard copy 0.138
2026-11-03 18:39:04 it 286: 25529 decisions in 207 games (57s collect, 48s train), aliens won 31%, loss pol -0.004 val 0.173 ent 0.74, kl to the Hard copy 0.146
2026-11-03 18:40:52 it 287: 25523 decisions in 196 games (60s collect, 48s train), aliens won 28%, loss pol -0.003 val 0.156 ent 0.75, kl to the Hard copy 0.141
2026-11-03 18:42:39 it 288: 25428 decisions in 225 games (60s collect, 48s train), aliens won 36%, loss pol -0.008 val 0.189 ent 0.72, kl to the Hard copy 0.150
2026-11-03 18:44:34 it 289: 25311 decisions in 224 games (67s collect, 47s train), aliens won 25%, loss pol 0.000 val 0.153 ent 0.69, kl to the Hard copy 0.149
2026-11-03 18:46:20 it 290: 25625 decisions in 191 games (58s collect, 48s train), aliens won 34%, loss pol 0.002 val 0.163 ent 0.76, kl to the Hard copy 0.150
2026-11-03 18:46:20 STOP file found: finishing
```
