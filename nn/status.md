# Network training status

Updated 2026-10-29 00:01.

- Iteration: **200**
- Speed: 90 seconds per iteration (40 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 75.8 | 74.7 |
| Aliens (team win %) | 33.5 | 26.3 |

Gain over the Hard copy, both sides added: **+8.4 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 120 (gain +11.3).

## Last log lines

```
2026-10-28 23:48:44 it 194: 25616 decisions in 195 games (36s collect, 53s train), aliens won 45%, loss pol -0.004 val 0.104 ent 0.79, kl to the Hard copy 0.202
2026-10-28 23:50:14 it 195: 25694 decisions in 218 games (37s collect, 53s train), aliens won 32%, loss pol -0.012 val 0.092 ent 0.77, kl to the Hard copy 0.210
2026-10-28 23:51:46 it 196: 25790 decisions in 221 games (39s collect, 53s train), aliens won 36%, loss pol -0.002 val 0.095 ent 0.77, kl to the Hard copy 0.216
2026-10-28 23:53:16 it 197: 25520 decisions in 209 games (37s collect, 52s train), aliens won 35%, loss pol -0.012 val 0.097 ent 0.79, kl to the Hard copy 0.200
2026-10-28 23:54:48 it 198: 25530 decisions in 211 games (39s collect, 53s train), aliens won 35%, loss pol -0.020 val 0.112 ent 0.79, kl to the Hard copy 0.206
2026-10-28 23:56:15 it 199: 24879 decisions in 202 games (36s collect, 51s train), aliens won 34%, loss pol -0.012 val 0.112 ent 0.78, kl to the Hard copy 0.206
2026-10-28 23:57:44 it 200: 25266 decisions in 227 games (37s collect, 52s train), aliens won 37%, loss pol -0.009 val 0.110 ent 0.78, kl to the Hard copy 0.214
2026-10-29 00:01:08 EVAL it 200 against the Hard copy: as Humans the team wins 74% (the Hard copy: 73%); as Aliens 32% (the Hard copy: 25%); gain over the last 3 checks +10.0 points
```
