# Network training status

Updated 2026-10-28 20:57.

- Iteration: **100**
- Speed: 91 seconds per iteration (40 per hour)
- Network: 64 hidden units, 4 layers; 15 game workers

## Evaluation against the Hard copy (average of the last 5 checks, 240 games per side each)

| | network | the Hard copy |
|---|---|---|
| Humans (team win %) | 75.4 | 72.6 |
| Aliens (team win %) | 32.7 | 30.2 |

Gain over the Hard copy, both sides added: **+5.4 points**. Verdict: better than the Hard copy
The network sent to the repository is the best one so far: iteration 100 (gain +6.3).

## Last log lines

```
2026-10-28 20:46:09 it 95: 25120 decisions in 222 games (37s collect, 52s train), aliens won 29%, loss pol -0.008 val 0.108 ent 0.81, kl to the Hard copy 0.172
2026-10-28 20:47:38 it 96: 25094 decisions in 218 games (38s collect, 52s train), aliens won 30%, loss pol -0.008 val 0.103 ent 0.78, kl to the Hard copy 0.168
2026-10-28 20:49:08 it 97: 25520 decisions in 224 games (37s collect, 53s train), aliens won 29%, loss pol -0.013 val 0.115 ent 0.83, kl to the Hard copy 0.184
2026-10-28 20:50:37 it 98: 25061 decisions in 245 games (38s collect, 52s train), aliens won 35%, loss pol -0.010 val 0.130 ent 0.81, kl to the Hard copy 0.179
2026-10-28 20:52:08 it 99: 25619 decisions in 199 games (38s collect, 53s train), aliens won 34%, loss pol -0.008 val 0.102 ent 0.89, kl to the Hard copy 0.175
2026-10-28 20:53:42 it 100: 26276 decisions in 211 games (40s collect, 54s train), aliens won 29%, loss pol -0.009 val 0.099 ent 0.84, kl to the Hard copy 0.172
2026-10-28 20:57:00 EVAL it 100 against the Hard copy: as Humans the team wins 78% (the Hard copy: 68%); as Aliens 38% (the Hard copy: 33%); gain over the last 3 checks +6.3 points
2026-10-28 20:57:00 new best network: iteration 100 (gain +6.3 points over the Hard copy)
```
