# Network training status

Updated 2026-10-31 14:19.

- Iteration: **609**
- Speed: 79 seconds per iteration (46 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 78.1 | 72.4 |
| Aliens (team win %) | 50.6 | 27.3 |

Gain over the Hard copy, both sides added: **+28.9 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 580 (gain +30.0).

## Last log lines

```
2026-10-31 14:10:37 it 602: 25972 decisions in 200 games (42s collect, 35s train), aliens won 34%, loss pol -0.013 val 0.114 ent 0.77, kl to the Hard copy 0.327
2026-10-31 14:11:53 it 603: 25689 decisions in 191 games (42s collect, 34s train), aliens won 41%, loss pol -0.005 val 0.123 ent 0.80, kl to the Hard copy 0.321
2026-10-31 14:13:11 it 604: 25336 decisions in 214 games (44s collect, 34s train), aliens won 38%, loss pol 0.000 val 0.146 ent 0.76, kl to the Hard copy 0.344
2026-10-31 14:14:28 it 605: 25285 decisions in 207 games (43s collect, 34s train), aliens won 48%, loss pol 0.001 val 0.141 ent 0.77, kl to the Hard copy 0.335
2026-10-31 14:15:50 it 606: 25834 decisions in 218 games (47s collect, 34s train), aliens won 38%, loss pol -0.003 val 0.129 ent 0.75, kl to the Hard copy 0.320
2026-10-31 14:17:11 it 607: 25775 decisions in 188 games (47s collect, 35s train), aliens won 43%, loss pol -0.004 val 0.133 ent 0.80, kl to the Hard copy 0.319
2026-10-31 14:18:31 it 608: 26442 decisions in 191 games (44s collect, 35s train), aliens won 43%, loss pol -0.008 val 0.119 ent 0.81, kl to the Hard copy 0.305
2026-10-31 14:19:50 it 609: 25166 decisions in 232 games (46s collect, 34s train), aliens won 36%, loss pol -0.001 val 0.140 ent 0.76, kl to the Hard copy 0.373
```
