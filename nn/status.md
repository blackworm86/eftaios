# Network training status

Updated 2026-11-02 19:04.

- Iteration: **1017**
- Speed: 89 seconds per iteration (40 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 76.3 | 74.8 |
| Aliens (team win % minus Humans escaped %) | 9.8 | -30.1 |

Gain over the Hard copy, both sides added: **+41.4 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 770 (gain +50.4).

## Last log lines

```
2026-11-02 18:54:04 EVAL it 1010 against the Hard copy: as Humans the team wins 79% (the Hard copy: 76%); as Aliens 2% (the Hard copy: -32%); gain over the last 3 checks +39.0 points
2026-11-02 18:55:32 it 1011: 25217 decisions in 195 games (37s collect, 50s train), aliens won 51%, loss pol -0.006 val 0.207 ent 0.64, kl to the Hard copy 0.568
2026-11-02 18:57:00 it 1012: 25782 decisions in 204 games (37s collect, 51s train), aliens won 48%, loss pol -0.005 val 0.210 ent 0.64, kl to the Hard copy 0.586
2026-11-02 18:58:28 it 1013: 25903 decisions in 189 games (37s collect, 51s train), aliens won 49%, loss pol 0.001 val 0.161 ent 0.68, kl to the Hard copy 0.546
2026-11-02 18:59:56 it 1014: 25558 decisions in 198 games (37s collect, 51s train), aliens won 49%, loss pol -0.017 val 0.208 ent 0.63, kl to the Hard copy 0.568
2026-11-02 19:01:25 it 1015: 25460 decisions in 186 games (39s collect, 51s train), aliens won 58%, loss pol -0.001 val 0.190 ent 0.63, kl to the Hard copy 0.560
2026-11-02 19:02:54 it 1016: 25840 decisions in 184 games (37s collect, 51s train), aliens won 43%, loss pol -0.003 val 0.191 ent 0.62, kl to the Hard copy 0.575
2026-11-02 19:04:23 it 1017: 26088 decisions in 197 games (37s collect, 52s train), aliens won 53%, loss pol -0.014 val 0.196 ent 0.62, kl to the Hard copy 0.552
```
