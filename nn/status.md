# Network training status

Updated 2026-11-02 04:00.

- Iteration: **512**
- Speed: 88 seconds per iteration (41 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.8 | 72.2 |
| Aliens (team win % minus Humans escaped %) | -5.8 | -32.8 |

Gain over the Hard copy, both sides added: **+32.6 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 420 (gain +43.7).

## Last log lines

```
2026-11-02 03:48:38 it 506: 25860 decisions in 198 games (36s collect, 52s train), aliens won 42%, loss pol -0.008 val 0.187 ent 0.68, kl to the Hard copy 0.486
2026-11-02 03:50:03 it 507: 25424 decisions in 176 games (35s collect, 51s train), aliens won 45%, loss pol -0.011 val 0.194 ent 0.67, kl to the Hard copy 0.489
2026-11-02 03:51:30 it 508: 25205 decisions in 202 games (36s collect, 50s train), aliens won 38%, loss pol -0.008 val 0.201 ent 0.68, kl to the Hard copy 0.471
2026-11-02 03:53:00 it 509: 25893 decisions in 190 games (39s collect, 52s train), aliens won 37%, loss pol -0.003 val 0.186 ent 0.67, kl to the Hard copy 0.470
2026-11-02 03:54:28 it 510: 25064 decisions in 184 games (38s collect, 50s train), aliens won 39%, loss pol -0.008 val 0.174 ent 0.67, kl to the Hard copy 0.479
2026-11-02 03:57:46 EVAL it 510 against the Hard copy: as Humans the team wins 81% (the Hard copy: 73%); as Aliens -2% (the Hard copy: -32%); gain over the last 3 checks +36.0 points
2026-11-02 03:59:12 it 511: 25487 decisions in 184 games (36s collect, 50s train), aliens won 39%, loss pol -0.011 val 0.181 ent 0.69, kl to the Hard copy 0.488
2026-11-02 04:00:44 it 512: 26599 decisions in 202 games (39s collect, 53s train), aliens won 42%, loss pol -0.009 val 0.190 ent 0.67, kl to the Hard copy 0.477
```
