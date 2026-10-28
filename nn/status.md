# Network training status

Updated 2026-10-28 17:55.

- Iteration: **1**
- Network: 64 hidden units, 4 layers; 15 game workers

Not enough evaluations yet (one is made every 10 iterations).

## Last log lines

```
2026-10-28 17:38:36 reading 1 teacher file(s)
2026-10-28 17:38:39 552453 decisions from 4534 games (3s); 226 games kept aside to check
2026-10-28 17:53:58 a new run, starting from the Hard copy (the pull towards it starts at 0.10, only the critic learns for 15 iterations)
2026-10-28 17:53:58 device cuda, 15 workers, 128793 parameters
2026-10-28 17:55:35 it 1: 26249 decisions in 235 games (43s collect, 54s train), aliens won 18%, loss pol -0.010 val 0.157 ent 0.73, kl to the Hard copy 0.000 (critic only)
```
