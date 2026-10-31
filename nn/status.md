# Network training status

Updated 2026-10-31 08:18.

- Iteration: **423**
- Speed: 80 seconds per iteration (45 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 80.2 | 74.1 |
| Aliens (team win %) | 39.9 | 28.9 |

Gain over the Hard copy, both sides added: **+17.1 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 420 (gain +18.8).

## Last log lines

```
2026-10-31 08:08:51 it 419: 25554 decisions in 181 games (41s collect, 34s train), aliens won 38%, loss pol -0.005 val 0.127 ent 0.82, kl to the Hard copy 0.192
2026-10-31 08:10:11 it 420: 25460 decisions in 197 games (46s collect, 34s train), aliens won 32%, loss pol 0.003 val 0.092 ent 0.79, kl to the Hard copy 0.195
2026-10-31 08:14:05 EVAL it 420 against the Hard copy: as Humans the team wins 82% (the Hard copy: 74%); as Aliens 42% (the Hard copy: 32%); gain over the last 3 checks +18.8 points
2026-10-31 08:14:05 new best network: iteration 420 (gain +18.8 points over the Hard copy)
2026-10-31 08:15:28 it 421: 25657 decisions in 200 games (47s collect, 36s train), aliens won 38%, loss pol -0.005 val 0.112 ent 0.79, kl to the Hard copy 0.191
2026-10-31 08:16:51 it 422: 25348 decisions in 213 games (48s collect, 35s train), aliens won 32%, loss pol -0.001 val 0.116 ent 0.77, kl to the Hard copy 0.197
2026-10-31 08:18:14 it 423: 26030 decisions in 208 games (47s collect, 36s train), aliens won 39%, loss pol 0.003 val 0.110 ent 0.82, kl to the Hard copy 0.195
2026-10-31 08:18:14 STOP file found: finishing
```
