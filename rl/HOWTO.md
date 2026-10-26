# EFTAIOS neural network: how to run it on your PC

Everything runs from **one file: `NN.bat`**. You double-click it, a menu appears, you press a number. There is nothing else to start, no other
`.bat` files, no commands to type, and git is not needed.

## 1. What this is

The game bots we have today are hand-written rules. This project trains a **neural network** that learns to play by playing millions of games against
itself on your graphics card. When it plays well enough it will be put into the app as the bots (first as a test level, later as Easy, Normal and Hard).

You run the training, and the program **sends the results to the GitHub repository by itself** (the network and a progress report), so I can read them
and decide what to build next. You do not copy files or upload anything by hand.

## 2. What you need

- The Windows PC with the NVIDIA graphics card, and an internet connection.
- **Python 3.12 or newer** from https://www.python.org/downloads/ . During the installation tick **"Add python.exe to PATH"**. (Newer Pythons work too.)
- The repository folder you already have (`Desktop\eftaios`). The network project is in its `rl` folder.
- A **GitHub token**, made once (step 3 below). Without it everything works, but the results stay on your PC.

## 3. One-time setup (about 15 minutes, mostly waiting)

**3.1 Make a GitHub token** (a password that lets the program write only into this repository). On the GitHub website, signed in:
1. Click your picture (top right), **Settings**, scroll down, **Developer settings**, **Personal access tokens**, **Fine-grained tokens**, **Generate new token**.
2. Token name: `eftaios network`. Expiration: 90 days (you can make a new one later).
3. Repository access: **Only select repositories**, choose `blackworm86/eftaios`.
4. Permissions: open **Repository permissions**, find **Contents**, set it to **Read and write**. Leave everything else as it is.
5. **Generate token**, then copy the text that starts with `github_pat_` (GitHub shows it only once).

**3.2 First start.** Open the folder `Desktop\eftaios\rl` and double-click **`NN.bat`**. The first time it prepares a Python environment (a minute).
A black window with a menu appears:

```
=== EFTAIOS network trainer ===
  1  Start or resume the training
  2  Show progress
  3  Send the network and progress to GitHub now
  4  Save the GitHub token (once)
  5  Stop the training (use this in a second window)
  6  Check that everything works
  0  Quit
```

**3.3 Check everything.** Press `6` and Enter. The first time it downloads PyTorch for your graphics card (about 2 GB, 5 to 10 minutes) and then runs
five checks. The result must end with **"Everything works."** If it does not, copy the text from the window and send it to me.

**3.4 Save the token.** Press `4`, paste the token (right-click in the window pastes), press Enter. It must answer
**"Token saved, and it can write to blackworm86/eftaios. All good."** The token is stored only on this PC, in `rl\settings\github-token.txt`.

## 4. Every day

**Start the training:** double-click `NN.bat`, press `1`. A window fills with lines like
`it 641: 26020 decisions in 303 games (41s collect, 39s train) ...`. Leave it open. You can minimise it and use the PC normally,
though games will be slower while the PC is busy. It saves after every iteration, so a power cut costs at most one iteration.

**Look at the progress:** double-click `NN.bat` **again** (a second window) and press `2`. It prints a short report (section 5). Close that window afterwards.

**Stop the training:** in the second window press `5`. The training window finishes the current iteration (about a minute), sends the last report to
GitHub and stops. You can also simply close the training window: the next start continues from the last saved iteration.

**Continue later (also after a restart of Windows):** double-click `NN.bat`, press `1`. Nothing else.

**What is sent to GitHub, and when.** Automatically every 3 hours while it runs, and once more when it stops: the folder `nn` in the repository gets
`status.md` (the report), `eval.csv` (the evaluation history) and `net.json` (the network). You can send right away with menu item `3`.
You do not have to tell me: when you say there is new data, I read it from the repository.

## 5. How to read the progress report

```
- Iteration: 1052          how many learning steps so far
- Speed: 77 seconds per iteration (47 per hour)

| | network | rule-based players | change since the 15 before |
| Humans (team win %) | 61.5 | 70.6 | +0.4 |
| Aliens (team win %) | 77.6 | 29.2 | -3.1 |
Verdict: flat: it has stopped getting better with this setup
```

- Every 10 iterations the network plays about 240 games against **simple rule-based players** (not against the real app bots) as Humans and as Aliens.
  The table shows its win rate on each side, next to what the rule-based players score in the same games.
- **Change since the 15 before** compares the last 15 evaluations with the 15 before them. Small changes are noise (one evaluation can be wrong by about 3 points).
- **Verdict** says "still improving" or "flat". When it is flat for a long time, more of the same training is wasted. Tell me, and we change something.
- The report ends with the last lines of the training log. `ent` is how random the network still is (it falls slowly), `aliens won` is the share of
  games between networks won by the Aliens (healthy: roughly 40% to 70%).

## 6. When something goes wrong

| What you see | What to do |
|---|---|
| "Python was not found" | Install Python (section 2) and make sure "Add python.exe to PATH" was ticked. Double-click `NN.bat` again. |
| PyTorch download fails or "no matching distribution" | Your Python may be newer than PyTorch supports. Install Python 3.12, delete the folder `rl\.venv`, double-click `NN.bat` again and press 6. |
| "The GPU cannot run this PyTorch build" | The program continues on the processor, slowly. Update the NVIDIA driver, delete `rl\.venv`, start `NN.bat` and press 6. If it persists, send me the text. |
| "A training seems to be running already" | Another training window is open. Use that one, or close it first. (After a crash wait 5 minutes.) |
| "The training stopped by itself ... Restarting in 30 seconds" | Normal after a rare error: it resumes alone. If the same error comes back every time, copy it and send it to me. |
| Token message "wrong or expired" / "cannot write" | Make a new token (3.1) and save it again with menu item 4. |
| The PC feels slow | The training uses all processor cores but one. Stop it while you work (item 5), or ask me for a lighter setting. |

## 7. What is in the folder

```
rl\
  NN.bat           the only file you start
  HOWTO.md         this document
  nnctl.py         the program behind the menu
  settings\        your GitHub token (never leaves this PC, not uploaded)
  runs\main\       the training itself: the saved network, the log, the evaluation history
  eftaios_rl\      the game engine and the learning code (nothing to touch)
  tests\           the checks that menu item 6 runs
  data\            the maps
```

- **To start from nothing:** close the training, then rename `runs\main` to `runs\main_old`. The next start begins a fresh network.
- Never edit the files in `eftaios_rl` or `tests`. If something needs changing, I change it in the repository and you copy the new `rl` folder over (keep your `settings` and `runs` folders).
- Settings for experts are in `runs\main\config.json` (written on the first start; stop the training before editing): `workers` (game processes, 0 = all cores but one),
  `decisions_per_iter` (games per learning step), `eval_games` (games per evaluation), `publish_hours` (how often it sends to GitHub, 0 = never).

## 8. Safety of the token

The token can only change files of the repository `blackworm86/eftaios`, nothing else on GitHub. It stays on your PC. If you lose control of it, open
GitHub, Settings, Developer settings, Fine-grained tokens, and delete it. The program then just says it cannot send, and everything else keeps working.

## 9. Words used

- **Iteration:** one round of "play about 25,000 decisions, then learn from them".
- **Evaluation:** a test every 10 iterations against simple players, to see whether the learning works.
- **Network:** the trained decision maker (about 90,000 numbers); `net.json` is its saved form.
- **Rule-based players:** simple fixed-rule players used as a yardstick. They are weaker than the app's Hard bot.

## 10. What comes next

The first network is at the level of an Easy bot as Humans, and its Aliens attack far too often, because it learned in a simplified game. The plan
(in `docs/BOT_PLAN.md`): record the real Hard bot playing, teach the network to copy it, add Items and Character powers to the training, then improve
beyond the teacher. When one of these steps needs something from you, it will appear as **a new item in this same menu**, and I will tell you which button to press.
