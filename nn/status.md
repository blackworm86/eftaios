# Network training status

Updated 2026-11-02 13:02.

- Iteration: **816**
- Speed: 88 seconds per iteration (41 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 74.8 | 73.6 |
| Aliens (team win % minus Humans escaped %) | 9.2 | -31.7 |

Gain over the Hard copy, both sides added: **+42.2 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 770 (gain +50.4).

## Last log lines

```
2026-11-02 12:50:44 it 810: 26215 decisions in 205 games (37s collect, 52s train), aliens won 48%, loss pol -0.004 val 0.180 ent 0.67, kl to the Hard copy 0.523
2026-11-02 12:54:01 EVAL it 810 against the Hard copy: as Humans the team wins 76% (the Hard copy: 76%); as Aliens 12% (the Hard copy: -33%); gain over the last 3 checks +42.0 points
2026-11-02 12:55:27 it 811: 24976 decisions in 195 games (37s collect, 49s train), aliens won 41%, loss pol -0.006 val 0.183 ent 0.66, kl to the Hard copy 0.545
2026-11-02 12:56:55 it 812: 25501 decisions in 203 games (37s collect, 51s train), aliens won 42%, loss pol -0.012 val 0.171 ent 0.63, kl to the Hard copy 0.519
2026-11-02 12:58:24 it 813: 25636 decisions in 209 games (39s collect, 51s train), aliens won 48%, loss pol -0.006 val 0.196 ent 0.65, kl to the Hard copy 0.533
2026-11-02 12:59:53 it 814: 25468 decisions in 184 games (38s collect, 50s train), aliens won 41%, loss pol -0.003 val 0.166 ent 0.64, kl to the Hard copy 0.525
2026-11-02 13:01:23 it 815: 25545 decisions in 182 games (39s collect, 51s train), aliens won 44%, loss pol -0.014 val 0.177 ent 0.65, kl to the Hard copy 0.532
2026-11-02 13:02:51 it 816: 25688 decisions in 184 games (38s collect, 51s train), aliens won 47%, loss pol -0.011 val 0.168 ent 0.71, kl to the Hard copy 0.520
```
