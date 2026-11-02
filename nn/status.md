# Network training status

Updated 2026-11-02 07:01.

- Iteration: **614**
- Speed: 88 seconds per iteration (41 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.4 | 74.3 |
| Aliens (team win % minus Humans escaped %) | 4.2 | -32.5 |

Gain over the Hard copy, both sides added: **+39.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 420 (gain +43.7).

## Last log lines

```
2026-11-02 06:49:41 it 608: 25798 decisions in 199 games (38s collect, 51s train), aliens won 43%, loss pol -0.004 val 0.218 ent 0.69, kl to the Hard copy 0.503
2026-11-02 06:51:10 it 609: 25659 decisions in 222 games (38s collect, 51s train), aliens won 43%, loss pol -0.010 val 0.217 ent 0.65, kl to the Hard copy 0.549
2026-11-02 06:52:39 it 610: 25730 decisions in 203 games (38s collect, 51s train), aliens won 49%, loss pol -0.011 val 0.223 ent 0.66, kl to the Hard copy 0.530
2026-11-02 06:55:26 EVAL it 610 against the Hard copy: as Humans the team wins 76% (the Hard copy: 72%); as Aliens 7% (the Hard copy: -30%); gain over the last 3 checks +43.5 points
2026-11-02 06:56:53 it 611: 25312 decisions in 212 games (36s collect, 50s train), aliens won 42%, loss pol -0.011 val 0.210 ent 0.66, kl to the Hard copy 0.527
2026-11-02 06:58:22 it 612: 25883 decisions in 226 games (38s collect, 52s train), aliens won 43%, loss pol -0.002 val 0.231 ent 0.65, kl to the Hard copy 0.560
2026-11-02 06:59:49 it 613: 24762 decisions in 214 games (37s collect, 49s train), aliens won 43%, loss pol -0.010 val 0.265 ent 0.64, kl to the Hard copy 0.564
2026-11-02 07:01:18 it 614: 25472 decisions in 203 games (38s collect, 51s train), aliens won 48%, loss pol -0.015 val 0.226 ent 0.67, kl to the Hard copy 0.539
```
