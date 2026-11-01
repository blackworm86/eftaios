# Network training status

Updated 2026-11-01 07:29.

- Iteration: **484**
- Speed: 79 seconds per iteration (46 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 76.7 | 72.6 |
| Aliens (team win % minus Humans escaped %) | -10.3 | -34.7 |

Gain over the Hard copy, both sides added: **+28.5 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 460 (gain +31.7).

## Last log lines

```
2026-11-01 07:18:06 it 478: 26277 decisions in 199 games (42s collect, 36s train), aliens won 30%, loss pol -0.001 val 0.149 ent 0.77, kl to the Hard copy 0.162
2026-11-01 07:19:23 it 479: 25847 decisions in 202 games (42s collect, 35s train), aliens won 35%, loss pol -0.004 val 0.170 ent 0.76, kl to the Hard copy 0.167
2026-11-01 07:20:40 it 480: 25168 decisions in 211 games (43s collect, 34s train), aliens won 32%, loss pol 0.000 val 0.160 ent 0.77, kl to the Hard copy 0.174
2026-11-01 07:24:07 EVAL it 480 against the Hard copy: as Humans the team wins 75% (the Hard copy: 70%); as Aliens -12% (the Hard copy: -30%); gain over the last 3 checks +30.1 points
2026-11-01 07:25:27 it 481: 25973 decisions in 181 games (44s collect, 35s train), aliens won 34%, loss pol -0.003 val 0.164 ent 0.78, kl to the Hard copy 0.157
2026-11-01 07:26:41 it 482: 25086 decisions in 208 games (39s collect, 34s train), aliens won 38%, loss pol -0.000 val 0.171 ent 0.78, kl to the Hard copy 0.177
2026-11-01 07:28:00 it 483: 25226 decisions in 190 games (44s collect, 35s train), aliens won 30%, loss pol -0.009 val 0.169 ent 0.77, kl to the Hard copy 0.160
2026-11-01 07:29:20 it 484: 25867 decisions in 242 games (45s collect, 35s train), aliens won 33%, loss pol 0.003 val 0.173 ent 0.72, kl to the Hard copy 0.177
```
