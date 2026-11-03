# Network training status

Updated 2026-11-03 09:14.

- Iteration: **1**
- Network: 128 hidden units, 4 layers; 15 game workers

Not enough evaluations yet (one is made every 20 iterations).

## Last log lines

```
2026-11-01 14:08:26 epoch 17/20: cross-entropy 0.688 (check games 0.779); same action as the Hard bot on unseen games: moves 63% (Humans 84%, Aliens 52%), attacks 93%, decoys 27%, Items and powers 93%, their targets 24% (391s)
2026-11-01 14:15:18 epoch 18/20: cross-entropy 0.681 (check games 0.785); same action as the Hard bot on unseen games: moves 63% (Humans 84%, Aliens 52%), attacks 93%, decoys 27%, Items and powers 93%, their targets 24% (412s)
2026-11-01 14:22:10 epoch 19/20: cross-entropy 0.676 (check games 0.784); same action as the Hard bot on unseen games: moves 63% (Humans 84%, Aliens 52%), attacks 93%, decoys 28%, Items and powers 93%, their targets 24% (412s)
2026-11-01 14:28:49 epoch 20/20: cross-entropy 0.672 (check games 0.785); same action as the Hard bot on unseen games: moves 63% (Humans 84%, Aliens 52%), attacks 93%, decoys 27%, Items and powers 93%, their targets 24% (398s)
2026-11-01 14:28:49 distillation finished
2026-11-03 09:12:21 resumed from iteration 0
2026-11-03 09:12:21 device cuda, 15 workers, 462361 parameters
2026-11-03 09:14:09 it 1: 24931 decisions in 217 games (62s collect, 45s train), aliens won 29%, loss pol -0.004 val 0.290 ent 0.70, kl to the Hard copy 0.000 (critic only)
```
