# Network training status

Updated 2026-11-01 10:38.

- Iteration: **609**
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
2026-11-01 10:30:12 publish: OK  sent nn/net.json (1311 KB)
2026-11-01 10:31:40 it 604: 25645 decisions in 208 games (48s collect, 40s train), aliens won 42%, loss pol -0.001 val 0.168 ent 0.75, kl to the Hard copy 0.241
2026-11-01 10:33:09 it 605: 26371 decisions in 233 games (51s collect, 38s train), aliens won 34%, loss pol 0.005 val 0.187 ent 0.76, kl to the Hard copy 0.268
2026-11-01 10:34:30 it 606: 25748 decisions in 225 games (45s collect, 36s train), aliens won 41%, loss pol 0.000 val 0.199 ent 0.73, kl to the Hard copy 0.265
2026-11-01 10:35:51 it 607: 25191 decisions in 213 games (45s collect, 36s train), aliens won 41%, loss pol -0.008 val 0.197 ent 0.76, kl to the Hard copy 0.252
2026-11-01 10:37:18 it 608: 26169 decisions in 215 games (49s collect, 38s train), aliens won 40%, loss pol 0.011 val 0.192 ent 0.76, kl to the Hard copy 0.257
2026-11-01 10:38:44 it 609: 25788 decisions in 236 games (50s collect, 36s train), aliens won 39%, loss pol -0.007 val 0.196 ent 0.78, kl to the Hard copy 0.260
2026-11-01 10:38:44 STOP file found: finishing
```
