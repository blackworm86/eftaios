# Network training status

Updated 2026-10-30 23:19.

- Iteration: **71**
- Speed: 82 seconds per iteration (44 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 3 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.5 | 73.8 |
| Aliens (team win %) | 28.8 | 21.9 |

Gain over the Hard copy, both sides added: **+10.6 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 60 (gain +10.6).

## Last log lines

```
2026-10-30 23:10:05 it 64: 26076 decisions in 200 games (48s collect, 37s train), aliens won 23%, loss pol -0.002 val 0.118 ent 0.73, kl to the Hard copy 0.069
2026-10-30 23:11:27 it 65: 25373 decisions in 192 games (46s collect, 36s train), aliens won 28%, loss pol 0.000 val 0.118 ent 0.75, kl to the Hard copy 0.065
2026-10-30 23:12:52 it 66: 26121 decisions in 184 games (49s collect, 37s train), aliens won 23%, loss pol 0.009 val 0.114 ent 0.78, kl to the Hard copy 0.063
2026-10-30 23:14:17 it 67: 25103 decisions in 203 games (50s collect, 35s train), aliens won 25%, loss pol -0.001 val 0.123 ent 0.76, kl to the Hard copy 0.076
2026-10-30 23:15:43 it 68: 25826 decisions in 188 games (50s collect, 36s train), aliens won 31%, loss pol 0.003 val 0.117 ent 0.77, kl to the Hard copy 0.074
2026-10-30 23:17:06 it 69: 25640 decisions in 202 games (48s collect, 35s train), aliens won 25%, loss pol -0.005 val 0.119 ent 0.75, kl to the Hard copy 0.077
2026-10-30 23:18:24 it 70: 25598 decisions in 202 games (43s collect, 35s train), aliens won 29%, loss pol 0.008 val 0.125 ent 0.75, kl to the Hard copy 0.075
2026-10-30 23:19:46 it 71: 25606 decisions in 189 games (47s collect, 35s train), aliens won 30%, loss pol 0.001 val 0.125 ent 0.76, kl to the Hard copy 0.071
```
