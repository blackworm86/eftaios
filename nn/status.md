# Network training status

Updated 2026-11-02 16:02.

- Iteration: **916**
- Speed: 89 seconds per iteration (40 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 77.1 | 72.0 |
| Aliens (team win % minus Humans escaped %) | 5.6 | -30.1 |

Gain over the Hard copy, both sides added: **+40.8 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 770 (gain +50.4).

## Last log lines

```
2026-11-02 15:50:53 it 910: 26056 decisions in 204 games (39s collect, 52s train), aliens won 54%, loss pol -0.008 val 0.205 ent 0.68, kl to the Hard copy 0.555
2026-11-02 15:54:10 EVAL it 910 against the Hard copy: as Humans the team wins 77% (the Hard copy: 72%); as Aliens 7% (the Hard copy: -34%); gain over the last 3 checks +40.8 points
2026-11-02 15:55:40 it 911: 25796 decisions in 217 games (38s collect, 51s train), aliens won 47%, loss pol -0.006 val 0.219 ent 0.63, kl to the Hard copy 0.555
2026-11-02 15:57:09 it 912: 25421 decisions in 219 games (38s collect, 50s train), aliens won 49%, loss pol -0.008 val 0.210 ent 0.64, kl to the Hard copy 0.597
2026-11-02 15:58:34 it 913: 25321 decisions in 202 games (35s collect, 50s train), aliens won 43%, loss pol -0.003 val 0.199 ent 0.65, kl to the Hard copy 0.599
2026-11-02 16:00:01 it 914: 25364 decisions in 205 games (37s collect, 50s train), aliens won 47%, loss pol -0.008 val 0.201 ent 0.64, kl to the Hard copy 0.598
2026-11-02 16:01:32 it 915: 26163 decisions in 207 games (39s collect, 52s train), aliens won 48%, loss pol -0.009 val 0.200 ent 0.64, kl to the Hard copy 0.542
2026-11-02 16:02:59 it 916: 25376 decisions in 200 games (36s collect, 50s train), aliens won 48%, loss pol -0.008 val 0.205 ent 0.65, kl to the Hard copy 0.554
```
