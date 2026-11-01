# Network training status

Updated 2026-11-01 10:30.

- Iteration: **603**
- Speed: 82 seconds per iteration (44 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 78.1 | 74.4 |
| Aliens (team win % minus Humans escaped %) | -7.0 | -34.7 |

Gain over the Hard copy, both sides added: **+31.4 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 540 (gain +35.0).

## Last log lines

```
2026-11-01 10:17:49 it 597: 25357 decisions in 195 games (46s collect, 36s train), aliens won 39%, loss pol 0.003 val 0.192 ent 0.76, kl to the Hard copy 0.241
2026-11-01 10:19:10 it 598: 25533 decisions in 201 games (44s collect, 36s train), aliens won 41%, loss pol 0.004 val 0.182 ent 0.75, kl to the Hard copy 0.254
2026-11-01 10:20:38 it 599: 26074 decisions in 201 games (51s collect, 37s train), aliens won 42%, loss pol 0.006 val 0.191 ent 0.76, kl to the Hard copy 0.259
2026-11-01 10:22:03 it 600: 26017 decisions in 202 games (48s collect, 37s train), aliens won 34%, loss pol 0.001 val 0.167 ent 0.77, kl to the Hard copy 0.243
2026-11-01 10:25:46 EVAL it 600 against the Hard copy: as Humans the team wins 78% (the Hard copy: 75%); as Aliens 1% (the Hard copy: -32%); gain over the last 3 checks +30.6 points
2026-11-01 10:27:14 it 601: 25368 decisions in 233 games (49s collect, 38s train), aliens won 39%, loss pol -0.001 val 0.212 ent 0.75, kl to the Hard copy 0.246
2026-11-01 10:28:40 it 602: 26004 decisions in 252 games (48s collect, 37s train), aliens won 33%, loss pol -0.006 val 0.189 ent 0.75, kl to the Hard copy 0.249
2026-11-01 10:30:06 it 603: 26213 decisions in 209 games (49s collect, 38s train), aliens won 37%, loss pol -0.003 val 0.183 ent 0.78, kl to the Hard copy 0.241
```
