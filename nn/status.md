# Network training status

Updated 2026-11-03 18:17.

- Iteration: **276**
- Speed: 105 seconds per iteration (34 per hour)
- Network: 128 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.0 | 72.8 |
| Aliens (team win % minus Humans escaped %) | -17.5 | -32.4 |

Gain over the Hard copy, both sides added: **+19.0 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 200 (gain +20.3).

## Last log lines

```
2026-11-03 18:04:42 it 269: 24955 decisions in 200 games (57s collect, 46s train), aliens won 36%, loss pol -0.004 val 0.159 ent 0.73, kl to the Hard copy 0.142
2026-11-03 18:06:25 it 270: 25719 decisions in 191 games (56s collect, 48s train), aliens won 30%, loss pol -0.005 val 0.152 ent 0.73, kl to the Hard copy 0.132
2026-11-03 18:08:15 it 271: 25750 decisions in 207 games (62s collect, 48s train), aliens won 29%, loss pol -0.005 val 0.138 ent 0.71, kl to the Hard copy 0.129
2026-11-03 18:10:03 it 272: 25517 decisions in 215 games (60s collect, 47s train), aliens won 33%, loss pol 0.002 val 0.149 ent 0.69, kl to the Hard copy 0.138
2026-11-03 18:11:47 it 273: 25172 decisions in 214 games (58s collect, 47s train), aliens won 30%, loss pol 0.002 val 0.159 ent 0.70, kl to the Hard copy 0.142
2026-11-03 18:13:32 it 274: 25746 decisions in 193 games (57s collect, 48s train), aliens won 27%, loss pol 0.011 val 0.152 ent 0.71, kl to the Hard copy 0.135
2026-11-03 18:15:15 it 275: 24871 decisions in 186 games (57s collect, 46s train), aliens won 32%, loss pol -0.000 val 0.165 ent 0.73, kl to the Hard copy 0.132
2026-11-03 18:17:06 it 276: 25750 decisions in 206 games (63s collect, 48s train), aliens won 27%, loss pol -0.001 val 0.155 ent 0.74, kl to the Hard copy 0.141
```
