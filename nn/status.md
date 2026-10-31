# Network training status

Updated 2026-10-31 22:28.

- Iteration: **122**
- Speed: 80 seconds per iteration (45 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 78.0 | 73.5 |
| Aliens (team win % minus Humans escaped %) | -24.1 | -34.9 |

Gain over the Hard copy, both sides added: **+15.3 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 120 (gain +20.5).

## Last log lines

```
2026-10-31 22:20:47 it 119: 25819 decisions in 194 games (43s collect, 36s train), aliens won 26%, loss pol -0.001 val 0.145 ent 0.78, kl to the Hard copy 0.061
2026-10-31 22:22:06 it 120: 25635 decisions in 209 games (44s collect, 35s train), aliens won 27%, loss pol -0.002 val 0.164 ent 0.75, kl to the Hard copy 0.068
2026-10-31 22:25:10 EVAL it 120 against the Hard copy: as Humans the team wins 82% (the Hard copy: 72%); as Aliens -26% (the Hard copy: -36%); gain over the last 3 checks +20.5 points
2026-10-31 22:25:10 new best network: iteration 120 (gain +20.5 points over the Hard copy)
2026-10-31 22:25:21 publish failed: <urlopen error [Errno 11001] getaddrinfo failed>
2026-10-31 22:26:42 it 121: 25957 decisions in 224 games (45s collect, 36s train), aliens won 30%, loss pol -0.002 val 0.191 ent 0.79, kl to the Hard copy 0.066
2026-10-31 22:26:53 publish failed: <urlopen error [Errno 11001] getaddrinfo failed>
2026-10-31 22:28:12 it 122: 25266 decisions in 196 games (45s collect, 35s train), aliens won 28%, loss pol -0.000 val 0.172 ent 0.78, kl to the Hard copy 0.064
```
