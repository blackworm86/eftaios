# Network training status

Updated 2026-11-02 00:59.

- Iteration: **410**
- Speed: 88 seconds per iteration (41 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.5 | 72.4 |
| Aliens (team win % minus Humans escaped %) | -1.9 | -33.7 |

Gain over the Hard copy, both sides added: **+36.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 340 (gain +39.5).

## Last log lines

```
2026-11-02 00:47:45 it 404: 25721 decisions in 208 games (36s collect, 51s train), aliens won 45%, loss pol -0.005 val 0.215 ent 0.71, kl to the Hard copy 0.381
2026-11-02 00:49:12 it 405: 25505 decisions in 197 games (37s collect, 51s train), aliens won 40%, loss pol -0.006 val 0.206 ent 0.71, kl to the Hard copy 0.371
2026-11-02 00:50:40 it 406: 25400 decisions in 202 games (37s collect, 51s train), aliens won 42%, loss pol -0.000 val 0.203 ent 0.73, kl to the Hard copy 0.361
2026-11-02 00:52:07 it 407: 25397 decisions in 208 games (37s collect, 51s train), aliens won 40%, loss pol -0.008 val 0.192 ent 0.74, kl to the Hard copy 0.373
2026-11-02 00:53:34 it 408: 25591 decisions in 188 games (36s collect, 51s train), aliens won 40%, loss pol -0.015 val 0.195 ent 0.73, kl to the Hard copy 0.364
2026-11-02 00:55:05 it 409: 26046 decisions in 203 games (39s collect, 52s train), aliens won 43%, loss pol -0.010 val 0.208 ent 0.73, kl to the Hard copy 0.369
2026-11-02 00:56:33 it 410: 26246 decisions in 187 games (36s collect, 52s train), aliens won 43%, loss pol -0.008 val 0.197 ent 0.74, kl to the Hard copy 0.373
2026-11-02 00:59:35 EVAL it 410 against the Hard copy: as Humans the team wins 78% (the Hard copy: 72%); as Aliens 0% (the Hard copy: -41%); gain over the last 3 checks +39.1 points
```
