# Network training status

Updated 2026-11-03 15:15.

- Iteration: **183**
- Speed: 105 seconds per iteration (34 per hour)
- Network: 128 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 76.5 | 74.0 |
| Aliens (team win % minus Humans escaped %) | -23.2 | -33.7 |

Gain over the Hard copy, both sides added: **+12.9 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 180 (gain +16.2).

## Last log lines

```
2026-11-03 15:02:34 it 178: 25547 decisions in 212 games (57s collect, 48s train), aliens won 33%, loss pol -0.003 val 0.167 ent 0.73, kl to the Hard copy 0.106
2026-11-03 15:04:15 it 179: 25438 decisions in 203 games (54s collect, 47s train), aliens won 30%, loss pol -0.012 val 0.170 ent 0.72, kl to the Hard copy 0.108
2026-11-03 15:06:05 it 180: 25622 decisions in 226 games (62s collect, 48s train), aliens won 32%, loss pol -0.003 val 0.182 ent 0.72, kl to the Hard copy 0.112
2026-11-03 15:10:25 EVAL it 180 against the Hard copy: as Humans the team wins 78% (the Hard copy: 72%); as Aliens -16% (the Hard copy: -41%); gain over the last 3 checks +16.2 points
2026-11-03 15:10:25 new best network: iteration 180 (gain +16.2 points over the Hard copy)
2026-11-03 15:12:12 it 181: 25939 decisions in 219 games (59s collect, 48s train), aliens won 31%, loss pol -0.002 val 0.171 ent 0.71, kl to the Hard copy 0.109
2026-11-03 15:13:56 it 182: 25646 decisions in 206 games (56s collect, 48s train), aliens won 28%, loss pol 0.002 val 0.174 ent 0.73, kl to the Hard copy 0.102
2026-11-03 15:15:39 it 183: 25719 decisions in 193 games (55s collect, 48s train), aliens won 29%, loss pol -0.004 val 0.166 ent 0.74, kl to the Hard copy 0.106
```
