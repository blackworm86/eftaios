# Network training status

Updated 2026-11-03 22:11.

- Iteration: **37**
- Speed: 303 seconds per iteration (12 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 1 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 47.9 | 47.9 |
| Aliens (team win % minus Humans escaped %) | 15.2 | 12.1 |

Gain over the Hard copy, both sides added: **+3.1 points**. Verdict: level with the Hard copy
The network sent to the repository is the best one so far: iteration 0 (gain +0.0).

## Last log lines

```
2026-11-03 21:36:16 it 30: 25697 decisions in 236 games (46s collect, 259s train), aliens won 49%, loss pol -0.000 val 0.235 ent 0.57, kl to the Hard copy 0.015
2026-11-03 21:41:17 it 31: 25426 decisions in 235 games (44s collect, 257s train), aliens won 50%, loss pol -0.006 val 0.234 ent 0.55, kl to the Hard copy 0.015
2026-11-03 21:46:24 it 32: 25942 decisions in 236 games (44s collect, 262s train), aliens won 55%, loss pol -0.001 val 0.243 ent 0.54, kl to the Hard copy 0.014
2026-11-03 21:51:29 it 33: 25780 decisions in 252 games (45s collect, 260s train), aliens won 52%, loss pol -0.001 val 0.240 ent 0.55, kl to the Hard copy 0.016
2026-11-03 21:56:37 it 34: 26136 decisions in 253 games (44s collect, 263s train), aliens won 55%, loss pol 0.000 val 0.231 ent 0.54, kl to the Hard copy 0.016
2026-11-03 22:01:39 it 35: 25310 decisions in 233 games (46s collect, 256s train), aliens won 48%, loss pol 0.008 val 0.240 ent 0.57, kl to the Hard copy 0.018
2026-11-03 22:06:47 it 36: 25956 decisions in 239 games (47s collect, 262s train), aliens won 51%, loss pol -0.009 val 0.230 ent 0.57, kl to the Hard copy 0.019
2026-11-03 22:11:50 it 37: 25519 decisions in 235 games (45s collect, 258s train), aliens won 53%, loss pol -0.000 val 0.230 ent 0.59, kl to the Hard copy 0.019
```
