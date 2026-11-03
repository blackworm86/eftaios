# Network training status

Updated 2026-11-03 12:14.

- Iteration: **93**
- Speed: 106 seconds per iteration (34 per hour)
- Network: 128 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 4 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.0 | 72.9 |
| Aliens (team win % minus Humans escaped %) | -26.7 | -28.1 |

Gain over the Hard copy, both sides added: **+5.4 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 60 (gain +4.9).

## Last log lines

```
2026-11-03 12:02:05 it 86: 25812 decisions in 201 games (55s collect, 48s train), aliens won 26%, loss pol 0.003 val 0.154 ent 0.74, kl to the Hard copy 0.079
2026-11-03 12:03:52 it 87: 25695 decisions in 212 games (59s collect, 48s train), aliens won 32%, loss pol -0.002 val 0.171 ent 0.72, kl to the Hard copy 0.086
2026-11-03 12:05:39 it 88: 26080 decisions in 203 games (59s collect, 48s train), aliens won 31%, loss pol 0.001 val 0.144 ent 0.73, kl to the Hard copy 0.076
2026-11-03 12:07:23 it 89: 25034 decisions in 203 games (57s collect, 47s train), aliens won 26%, loss pol -0.009 val 0.155 ent 0.74, kl to the Hard copy 0.081
2026-11-03 12:09:05 it 90: 24776 decisions in 195 games (55s collect, 46s train), aliens won 27%, loss pol -0.008 val 0.154 ent 0.73, kl to the Hard copy 0.079
2026-11-03 12:10:53 it 91: 25668 decisions in 199 games (61s collect, 48s train), aliens won 29%, loss pol -0.006 val 0.153 ent 0.73, kl to the Hard copy 0.078
2026-11-03 12:12:35 it 92: 25229 decisions in 176 games (55s collect, 47s train), aliens won 31%, loss pol -0.006 val 0.155 ent 0.74, kl to the Hard copy 0.073
2026-11-03 12:14:19 it 93: 25312 decisions in 209 games (57s collect, 47s train), aliens won 21%, loss pol -0.003 val 0.152 ent 0.70, kl to the Hard copy 0.077
```
