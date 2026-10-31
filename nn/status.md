# Network training status

Updated 2026-10-31 05:21.

- Iteration: **306**
- Speed: 80 seconds per iteration (45 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 79.5 | 72.7 |
| Aliens (team win %) | 35.8 | 26.9 |

Gain over the Hard copy, both sides added: **+15.6 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 300 (gain +17.2).

## Last log lines

```
2026-10-31 05:13:26 EVAL it 300 against the Hard copy: as Humans the team wins 79% (the Hard copy: 73%); as Aliens 43% (the Hard copy: 29%); gain over the last 3 checks +17.2 points
2026-10-31 05:13:26 new best network: iteration 300 (gain +17.2 points over the Hard copy)
2026-10-31 05:14:45 it 301: 25299 decisions in 197 games (45s collect, 34s train), aliens won 28%, loss pol -0.006 val 0.127 ent 0.74, kl to the Hard copy 0.137
2026-10-31 05:16:07 it 302: 25994 decisions in 213 games (46s collect, 35s train), aliens won 38%, loss pol -0.002 val 0.134 ent 0.75, kl to the Hard copy 0.136
2026-10-31 05:17:30 it 303: 25586 decisions in 215 games (49s collect, 34s train), aliens won 33%, loss pol 0.001 val 0.122 ent 0.73, kl to the Hard copy 0.134
2026-10-31 05:18:51 it 304: 25966 decisions in 182 games (46s collect, 35s train), aliens won 43%, loss pol -0.014 val 0.123 ent 0.78, kl to the Hard copy 0.132
2026-10-31 05:20:08 it 305: 24998 decisions in 195 games (44s collect, 34s train), aliens won 36%, loss pol -0.000 val 0.127 ent 0.76, kl to the Hard copy 0.145
2026-10-31 05:21:27 it 306: 25432 decisions in 191 games (45s collect, 34s train), aliens won 36%, loss pol 0.002 val 0.129 ent 0.75, kl to the Hard copy 0.136
```
