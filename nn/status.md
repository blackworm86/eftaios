# Network training status

Updated 2026-11-02 20:48.

- Iteration: **1074**
- Speed: 90 seconds per iteration (40 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 76.8 | 72.8 |
| Aliens (team win % minus Humans escaped %) | 15.5 | -37.7 |

Gain over the Hard copy, both sides added: **+57.1 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 1050 (gain +58.7).

## Last log lines

```
2026-11-02 20:38:06 it 1069: 26267 decisions in 192 games (40s collect, 52s train), aliens won 49%, loss pol -0.007 val 0.194 ent 0.67, kl to the Hard copy 0.587
2026-11-02 20:39:34 it 1070: 25659 decisions in 190 games (37s collect, 51s train), aliens won 50%, loss pol -0.009 val 0.223 ent 0.68, kl to the Hard copy 0.649
2026-11-02 20:42:51 EVAL it 1070 against the Hard copy: as Humans the team wins 75% (the Hard copy: 74%); as Aliens 23% (the Hard copy: -37%); gain over the last 3 checks +58.2 points
2026-11-02 20:44:16 it 1071: 24931 decisions in 189 games (36s collect, 49s train), aliens won 54%, loss pol -0.008 val 0.222 ent 0.69, kl to the Hard copy 0.624
2026-11-02 20:45:42 it 1072: 25151 decisions in 202 games (36s collect, 50s train), aliens won 50%, loss pol -0.012 val 0.226 ent 0.67, kl to the Hard copy 0.617
2026-11-02 20:47:14 it 1073: 25793 decisions in 204 games (41s collect, 51s train), aliens won 49%, loss pol -0.005 val 0.209 ent 0.68, kl to the Hard copy 0.615
2026-11-02 20:48:48 it 1074: 25505 decisions in 198 games (42s collect, 52s train), aliens won 48%, loss pol -0.012 val 0.205 ent 0.71, kl to the Hard copy 0.625
2026-11-02 20:48:48 STOP file found: finishing
```
