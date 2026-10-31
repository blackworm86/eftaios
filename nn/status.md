# Network training status

Updated 2026-10-31 18:12.

- Iteration: **765**
- Speed: 83 seconds per iteration (43 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 79.1 | 73.6 |
| Aliens (team win %) | 55.4 | 25.0 |

Gain over the Hard copy, both sides added: **+35.9 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 760 (gain +38.8).

## Last log lines

```
2026-10-31 18:01:13 it 760: 25905 decisions in 199 games (52s collect, 36s train), aliens won 48%, loss pol -0.006 val 0.136 ent 0.75, kl to the Hard copy 0.330
2026-10-31 18:05:13 EVAL it 760 against the Hard copy: as Humans the team wins 79% (the Hard copy: 70%); as Aliens 61% (the Hard copy: 23%); gain over the last 3 checks +38.8 points
2026-10-31 18:05:13 new best network: iteration 760 (gain +38.8 points over the Hard copy)
2026-10-31 18:06:42 it 761: 25279 decisions in 225 games (52s collect, 37s train), aliens won 47%, loss pol -0.004 val 0.159 ent 0.71, kl to the Hard copy 0.378
2026-10-31 18:08:08 it 762: 25484 decisions in 223 games (50s collect, 37s train), aliens won 40%, loss pol -0.002 val 0.133 ent 0.71, kl to the Hard copy 0.362
2026-10-31 18:09:32 it 763: 25481 decisions in 201 games (48s collect, 36s train), aliens won 43%, loss pol -0.003 val 0.132 ent 0.73, kl to the Hard copy 0.347
2026-10-31 18:10:58 it 764: 25078 decisions in 222 games (50s collect, 36s train), aliens won 42%, loss pol -0.009 val 0.142 ent 0.70, kl to the Hard copy 0.356
2026-10-31 18:12:23 it 765: 25740 decisions in 224 games (49s collect, 36s train), aliens won 41%, loss pol -0.000 val 0.141 ent 0.73, kl to the Hard copy 0.346
```
