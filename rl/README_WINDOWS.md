# EFTAIOS self-play training (Windows)

A neural network that learns to play the game by playing against itself, on your GPU. It runs on its own for hours or days,
saves its progress after every iteration, and can be stopped and resumed at any time.

**What it learns today:** where to move, when an Alien attacks, and which sector to name when a "noise in any sector" card is drawn.
**What it does not do yet:** play Item cards and Character powers (they are drawn and held, as in the game, but not played), and it is not in the app yet
(see "Next steps"). The rules in `eftaios_rl/engine.py` are checked against the real app: movement and neighbours match it on all 18 maps (720 sampled states, `tests/test_conformance.py`).

## 1. One-time setup (about 10 minutes)

1. Install **Python 3.10 or newer** from https://www.python.org/downloads/ and tick **"Add python.exe to PATH"**.
2. Make sure the NVIDIA driver is installed (`nvidia-smi` works in a terminal). Without a GPU it still runs, just slowly.
3. Copy this whole `rl` folder to the PC (or `git pull` the repository and open the `rl` folder).
4. Double-click **`setup_windows.bat`**. It creates a Python environment in `rl\.venv`, installs PyTorch, runs the tests and a short training
   smoke test. At the end it prints `ALL GOOD`. If it prints a failure, send me the text (and `runs\smoke\train.log`).

## 2. Start the training

Double-click **`run_training.bat`** and leave the window open. It uses all CPU cores but one to play games, and the GPU to learn.
If anything crashes it restarts by itself after 30 seconds and resumes from the last saved iteration. After a reboot just start it again.

* **What you will see first:** a short *imitation* phase (about 12 iterations, `imitation 5/12 ... same action as the rule-based player 55%`): the network copies simple
  rule-based players so it starts from sensible play, then self-play begins (`it 1`, `it 2`, ...). In a test on a CPU-only machine, 100,000 imitation decisions
  plus one self-play step already put it close to the rule-based players (Humans 42% vs 54%, Aliens 33% vs 38%); starting from nothing it was far behind
  (12% and 21%) after twice as much play. On your GPU the learning step takes seconds instead of minutes.
* **See how it is doing:** double-click `status.bat`. The evaluation lines compare the network with simple rule-based players:
  `as Humans the team wins 61% (rule-based Humans: 38%)`. A rising number is learning. A first useful sign usually comes after 20-50 iterations.
* **Stop it:** double-click `stop_training.bat` (it finishes the current iteration, about a minute). Start again any time to continue.
* **Files** (all in `runs\main\`): `latest.pt` (the network and optimiser), `pool\` (older versions it also plays against), `train.log`, `eval.csv`, `config.json`.
  To start from scratch delete the `runs\main` folder. Delete `config.json` only if you want to change the settings below.

### Starting a new version of the network

When the network's inputs change (as in version 2, which added walking-distance maps) a saved network cannot continue. Rename `runs\main` to `runs\main_v1`
(it keeps the old network; `python -m eftaios_rl.export_js --run main_v1` exports it) and start `run_training.bat`: it begins a fresh run with the imitation phase.

## 3. Settings

`runs\main\config.json` is written on the first start. Stop the training, edit it, start again.

| key | meaning | default |
|---|---|---|
| `workers` | game-playing processes (0 = cores - 1) | 0 |
| `decisions_per_iter` | decisions collected before each learning step | 24000 |
| `hid`, `layers` | size of the network (a changed size needs a new run folder) | 64, 4 |
| `players` | table sizes it plays | 3-8 |
| `p_scripted`, `p_pool` | share of games against rule-based players / older versions | 0.20, 0.25 |
| `ent`, `ent_end` | exploration bonus, fading over `ent_iters` iterations | 0.01 to 0.003 |

An iteration takes roughly 1-3 minutes on a typical 8-16 core PC. Expect 20-40 iterations per hour.

## 4. Getting the result to me

* **Progress:** send me `runs\main\eval.csv` and the last 30 lines of `runs\main\train.log` (or just copy them into the chat).
* **The network:** double-click `export_network.bat`. It writes `export\eftaios-net-main.json` (a few hundred KB). Put it in the repository folder
  `rl\export\` and push it, or send it to me. A trained network can be tested against the app's bots only after the JavaScript player exists (next steps).

## 5. How it works (short)

* `engine.py` is the game, with no screen: decks, movement, announcements, attacks, conversions, pods, the 40-turn limit and the win rule of the app.
* `env.py` turns it into decisions. A player sees only what a person at that seat sees: the public announcements, its own role, position, cards. The learner's
  *critic* (used only during training) also sees the truth about the others, which makes learning much faster without letting the player cheat.
* `model.py` is a graph network over the hex board (each sector exchanges information with its 6 neighbours, plus two layers where every sector looks at the whole board); `rollout.py` plays games in parallel; `train.py` is PPO self-play with a pool of older versions and rule-based
  players as sparring partners.
* Rewards: +1 / -1 for the winning / losing side (by the role you end the game with), +0.5 for escaping, +0.2 per Human an Alien kills, -0.3 for killing an Alien by mistake.

## 6. Trying a trained network in the app

1. Double-click `export_network.bat` (writes `rl\export\eftaios-net-main.json`, about 1 MB).
2. Copy that file to `nn\net.json` in the repository (the folder next to `index.html`), commit and push it. (Or send it to me.)
3. Bot level `nn` now plays: the network chooses moves, attacks and decoy noises, while cards and Character powers still follow the Hard rules.
   In Admin > Bot tests, test 9 is a table of five network bots. In the simulator: `node tools/sim.js out.json --rolemix human:nn,alien:hard --players 6 --no-trace`.

## 7. Next steps (I do these when you send a trained network)

1. A JavaScript player in the app that runs the exported network, with a test that it gives the same decisions as Python.
2. Measure it against Easy / Normal / Hard in the existing simulator tables.
3. Let it play Items and Character powers (engine rules first, then new action heads), then retrain.
4. Use checkpoints from different stages as Easy / Normal / Hard.
