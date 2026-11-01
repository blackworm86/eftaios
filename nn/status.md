# Network training status

Updated 2026-11-01 21:57.

- Iteration: **311**
- Speed: 80 seconds per iteration (45 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 63.2 | 71.4 |
| Aliens (team win % minus Humans escaped %) | 62.7 | 29.1 |

Gain over the Hard copy, both sides added: **+25.3 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 310 (gain +0.0).

## Last log lines

```
2026-10-28 17:02:20 STOP file found: finishing
2026-10-28 17:02:26 publish: OK  sent nn/status.md (1 KB)
2026-10-28 17:02:26 publish: OK  sent nn/eval.csv (0 KB)
2026-10-28 17:02:26 publish: OK  sent nn/net.json (1311 KB)
2026-10-28 17:02:26 stopped after 310 iterations (50 minutes this session)
2026-11-01 21:56:03 resumed from iteration 310
2026-11-01 21:56:03 device cuda, 15 workers, 128793 parameters
2026-11-01 21:57:39 it 311: 26232 decisions in 141 games (42s collect, 54s train), aliens won 53%, loss pol -0.008 val 0.198 ent 0.84, kl to the Hard copy 1.501
```
