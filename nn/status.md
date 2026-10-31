# Network training status

Updated 2026-10-31 02:20.

- Iteration: **186**
- Speed: 84 seconds per iteration (43 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 76.4 | 73.3 |
| Aliens (team win %) | 34.4 | 26.6 |

Gain over the Hard copy, both sides added: **+11.0 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 160 (gain +14.3).

## Last log lines

```
2026-10-31 02:08:32 it 180: 26149 decisions in 184 games (47s collect, 39s train), aliens won 33%, loss pol -0.002 val 0.119 ent 0.80, kl to the Hard copy 0.111
2026-10-31 02:12:20 EVAL it 180 against the Hard copy: as Humans the team wins 75% (the Hard copy: 77%); as Aliens 34% (the Hard copy: 28%); gain over the last 3 checks +9.6 points
2026-10-31 02:13:43 it 181: 25612 decisions in 191 games (47s collect, 36s train), aliens won 24%, loss pol -0.005 val 0.117 ent 0.78, kl to the Hard copy 0.106
2026-10-31 02:15:06 it 182: 25741 decisions in 196 games (46s collect, 37s train), aliens won 30%, loss pol 0.001 val 0.124 ent 0.76, kl to the Hard copy 0.109
2026-10-31 02:16:25 it 183: 25382 decisions in 180 games (43s collect, 36s train), aliens won 31%, loss pol -0.002 val 0.117 ent 0.79, kl to the Hard copy 0.101
2026-10-31 02:17:46 it 184: 25113 decisions in 197 games (46s collect, 36s train), aliens won 33%, loss pol 0.001 val 0.130 ent 0.80, kl to the Hard copy 0.106
2026-10-31 02:19:11 it 185: 25696 decisions in 185 games (49s collect, 36s train), aliens won 33%, loss pol -0.008 val 0.119 ent 0.79, kl to the Hard copy 0.109
2026-10-31 02:20:36 it 186: 25170 decisions in 200 games (49s collect, 36s train), aliens won 28%, loss pol 0.006 val 0.123 ent 0.82, kl to the Hard copy 0.112
```
