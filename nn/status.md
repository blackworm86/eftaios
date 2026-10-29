# Network training status

Updated 2026-10-29 01:36.

- Iteration: **252**
- Speed: 92 seconds per iteration (39 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.0 | 72.0 |
| Aliens (team win %) | 38.4 | 26.6 |

Gain over the Hard copy, both sides added: **+16.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 250 (gain +17.9).

## Last log lines

```
2026-10-29 01:26:29 it 248: 25453 decisions in 220 games (39s collect, 52s train), aliens won 39%, loss pol -0.010 val 0.099 ent 0.78, kl to the Hard copy 0.232
2026-10-29 01:28:02 it 249: 26387 decisions in 233 games (39s collect, 54s train), aliens won 33%, loss pol -0.001 val 0.112 ent 0.75, kl to the Hard copy 0.231
2026-10-29 01:29:33 it 250: 25960 decisions in 209 games (37s collect, 53s train), aliens won 35%, loss pol -0.009 val 0.093 ent 0.74, kl to the Hard copy 0.221
2026-10-29 01:32:53 EVAL it 250 against the Hard copy: as Humans the team wins 80% (the Hard copy: 74%); as Aliens 42% (the Hard copy: 24%); gain over the last 3 checks +17.9 points
2026-10-29 01:32:53 new best network: iteration 250 (gain +17.9 points over the Hard copy)
2026-10-29 01:34:25 it 251: 25582 decisions in 210 games (39s collect, 53s train), aliens won 39%, loss pol -0.010 val 0.107 ent 0.76, kl to the Hard copy 0.238
2026-10-29 01:36:01 it 252: 26841 decisions in 204 games (40s collect, 55s train), aliens won 32%, loss pol -0.012 val 0.100 ent 0.76, kl to the Hard copy 0.231
2026-10-29 01:36:01 STOP file found: finishing
```
