# Network training status

Updated 2026-11-01 01:28.

- Iteration: **242**
- Speed: 80 seconds per iteration (45 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 76.8 | 74.8 |
| Aliens (team win % minus Humans escaped %) | -22.5 | -34.3 |

Gain over the Hard copy, both sides added: **+13.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 120 (gain +20.5).

## Last log lines

```
2026-11-01 01:16:53 it 236: 25131 decisions in 202 games (42s collect, 35s train), aliens won 32%, loss pol -0.000 val 0.175 ent 0.77, kl to the Hard copy 0.092
2026-11-01 01:18:12 it 237: 25500 decisions in 219 games (44s collect, 35s train), aliens won 26%, loss pol -0.017 val 0.164 ent 0.77, kl to the Hard copy 0.094
2026-11-01 01:19:30 it 238: 25586 decisions in 217 games (43s collect, 35s train), aliens won 27%, loss pol -0.000 val 0.182 ent 0.77, kl to the Hard copy 0.102
2026-11-01 01:20:51 it 239: 25694 decisions in 220 games (45s collect, 35s train), aliens won 30%, loss pol 0.000 val 0.170 ent 0.78, kl to the Hard copy 0.097
2026-11-01 01:22:09 it 240: 25182 decisions in 217 games (44s collect, 35s train), aliens won 27%, loss pol -0.006 val 0.176 ent 0.76, kl to the Hard copy 0.093
2026-11-01 01:25:41 EVAL it 240 against the Hard copy: as Humans the team wins 78% (the Hard copy: 77%); as Aliens -19% (the Hard copy: -34%); gain over the last 3 checks +13.4 points
2026-11-01 01:27:00 it 241: 26029 decisions in 204 games (44s collect, 36s train), aliens won 25%, loss pol -0.005 val 0.164 ent 0.78, kl to the Hard copy 0.099
2026-11-01 01:28:20 it 242: 25818 decisions in 211 games (44s collect, 35s train), aliens won 26%, loss pol -0.002 val 0.167 ent 0.78, kl to the Hard copy 0.094
```
