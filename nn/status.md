# Network training status

Updated 2026-11-02 10:01.

- Iteration: **715**
- Speed: 89 seconds per iteration (40 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.6 | 73.9 |
| Aliens (team win % minus Humans escaped %) | -4.2 | -32.0 |

Gain over the Hard copy, both sides added: **+31.5 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 630 (gain +48.7).

## Last log lines

```
2026-11-02 09:50:05 it 709: 26330 decisions in 187 games (38s collect, 52s train), aliens won 40%, loss pol -0.010 val 0.176 ent 0.65, kl to the Hard copy 0.459
2026-11-02 09:51:32 it 710: 25162 decisions in 192 games (37s collect, 50s train), aliens won 42%, loss pol -0.012 val 0.173 ent 0.64, kl to the Hard copy 0.466
2026-11-02 09:54:37 EVAL it 710 against the Hard copy: as Humans the team wins 81% (the Hard copy: 75%); as Aliens -2% (the Hard copy: -27%); gain over the last 3 checks +34.7 points
2026-11-02 09:56:05 it 711: 25853 decisions in 176 games (36s collect, 51s train), aliens won 39%, loss pol -0.016 val 0.170 ent 0.68, kl to the Hard copy 0.477
2026-11-02 09:57:32 it 712: 25128 decisions in 215 games (38s collect, 50s train), aliens won 43%, loss pol -0.009 val 0.229 ent 0.61, kl to the Hard copy 0.511
2026-11-02 09:59:00 it 713: 25189 decisions in 193 games (38s collect, 50s train), aliens won 35%, loss pol -0.011 val 0.190 ent 0.64, kl to the Hard copy 0.505
2026-11-02 10:00:29 it 714: 25556 decisions in 198 games (38s collect, 51s train), aliens won 40%, loss pol 0.006 val 0.179 ent 0.65, kl to the Hard copy 0.501
2026-11-02 10:01:55 it 715: 25332 decisions in 201 games (36s collect, 50s train), aliens won 44%, loss pol -0.005 val 0.202 ent 0.65, kl to the Hard copy 0.508
```
