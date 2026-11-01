# Network training status

Updated 2026-11-01 04:29.

- Iteration: **363**
- Speed: 79 seconds per iteration (46 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 79.7 | 74.8 |
| Aliens (team win % minus Humans escaped %) | -19.6 | -33.5 |

Gain over the Hard copy, both sides added: **+18.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 120 (gain +20.5).

## Last log lines

```
2026-11-01 04:17:13 it 357: 25538 decisions in 195 games (43s collect, 35s train), aliens won 26%, loss pol -0.006 val 0.154 ent 0.79, kl to the Hard copy 0.108
2026-11-01 04:18:32 it 358: 25323 decisions in 222 games (45s collect, 35s train), aliens won 32%, loss pol -0.000 val 0.177 ent 0.78, kl to the Hard copy 0.118
2026-11-01 04:19:48 it 359: 25260 decisions in 200 games (41s collect, 35s train), aliens won 29%, loss pol 0.003 val 0.159 ent 0.79, kl to the Hard copy 0.120
2026-11-01 04:21:10 it 360: 26819 decisions in 193 games (45s collect, 37s train), aliens won 30%, loss pol 0.002 val 0.146 ent 0.80, kl to the Hard copy 0.106
2026-11-01 04:25:03 EVAL it 360 against the Hard copy: as Humans the team wins 81% (the Hard copy: 74%); as Aliens -22% (the Hard copy: -38%); gain over the last 3 checks +20.0 points
2026-11-01 04:26:24 it 361: 25682 decisions in 204 games (46s collect, 35s train), aliens won 28%, loss pol -0.003 val 0.161 ent 0.80, kl to the Hard copy 0.123
2026-11-01 04:27:46 it 362: 25763 decisions in 214 games (46s collect, 35s train), aliens won 22%, loss pol -0.008 val 0.137 ent 0.78, kl to the Hard copy 0.118
2026-11-01 04:29:09 it 363: 26073 decisions in 221 games (48s collect, 36s train), aliens won 28%, loss pol -0.001 val 0.167 ent 0.78, kl to the Hard copy 0.118
```
