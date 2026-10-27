"""The one program that runs the whole network project on your PC. Start it with NN.bat (double-click) and choose from the menu.
You can also use it from a terminal:  python nnctl.py train | status | publish | token | stop | check
"""
import os
import subprocess
import sys
import time

ROOT = os.path.dirname(os.path.abspath(__file__))
RUN = os.path.join(ROOT, "runs", "main")
STOP = os.path.join(RUN, "STOP")
sys.path.insert(0, ROOT)

PROBE = "import torch, sys; x = torch.ones(64, 64, device='cuda'); y = (x @ x).sum(); torch.cuda.synchronize(); sys.exit(0 if float(y) == 64 * 64 * 64 else 3)"


def say(*a):
    print(*a, flush=True)


def torch_ok():
    return subprocess.run([sys.executable, "-c", "import torch"], capture_output=True).returncode == 0


def ensure_torch():
    """PyTorch with a working GPU if there is one (installs the right build on the first run), the CPU build otherwise."""
    if torch_ok() and (subprocess.run([sys.executable, "-c", PROBE], capture_output=True).returncode == 0 or not __import__("shutil").which("nvidia-smi")):
        return True
    say("Installing PyTorch (about 2 GB, a few minutes, only the first time)...")
    from eftaios_rl import torchsetup
    return torchsetup.main() == 0


LOCK = os.path.join(RUN, "training.lock")


def pid_alive(pid):
    if os.name == "nt":  # os.kill would end the process on Windows, so ask the task list
        out = subprocess.run(["tasklist", "/FI", "PID eq %d" % pid, "/NH"], capture_output=True, text=True).stdout
        return str(pid) in out
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def running():
    """A training is running when its lock file names a live process (or, for an old start, its log changed in the last 5 minutes)."""
    try:
        if pid_alive(int(open(LOCK).read().strip())):
            return True
    except (OSError, ValueError):
        pass
    log = os.path.join(RUN, "train.log")
    return os.path.exists(log) and time.time() - os.path.getmtime(log) < 300


def cmd_train():
    from eftaios_rl import publish
    if not ensure_torch():
        return 1
    if not publish.token():
        say("NOTE: no GitHub token saved, so progress will NOT be sent to the repository. Choose 'Save the GitHub token' in the menu when you can.\n")
    if running():
        say("A training is running already (another window of this program). Use that one, or close it first. Starting a second one would make both slow and mix up their files.")
        return 1
    os.makedirs(RUN, exist_ok=True)
    if os.path.exists(STOP):
        os.remove(STOP)
    open(LOCK, "w").write(str(os.getpid()))  # written before anything else starts, so a second start sees it
    say("Training started. It keeps going until you choose 'Stop' in a second window (or close this window). Progress is saved after every iteration.\n")
    while True:
        rc = subprocess.call([sys.executable, "-m", "eftaios_rl.train", "--run", "main"], cwd=ROOT)
        if rc == 0 or os.path.exists(STOP):
            break
        say("\nThe training stopped by itself (error %s). Restarting in 30 seconds; close this window to quit." % rc)
        time.sleep(30)
    try:
        os.remove(LOCK)
    except OSError:
        pass
    say("\nTraining stopped.")
    return 0


def cmd_status():
    from eftaios_rl import report
    say(report.summary(RUN))
    say("The training is %s." % ("RUNNING" if running() else "not running"))
    return 0


def cmd_publish():
    from eftaios_rl import publish
    if not os.path.exists(os.path.join(RUN, "latest.pt")):
        say("There is no trained network yet: start the training first.")
        return 1
    if not ensure_torch():
        return 1
    for line in publish.publish_now(RUN):
        say(line)
    return 0


def cmd_token():
    from eftaios_rl import publish
    say("Paste the GitHub token (it starts with github_pat_) and press Enter. It is saved only on this PC, in the settings folder.")
    v = input("Token: ").strip()
    if not v.startswith(("github_pat_", "ghp_")):
        say("That does not look like a GitHub token. Nothing was saved.")
        return 1
    publish.save_token(v)
    st, res = publish._call("GET", "/repos/%s" % publish.REPO)
    if st == 200 and res.get("permissions", {}).get("push"):
        say("Token saved, and it can write to %s. All good." % publish.REPO)
        return 0
    say("Token saved, but GitHub says it cannot write to %s (answer %d). Check that the token is limited to this repository with Contents: Read and write." % (publish.REPO, st))
    return 1


def cmd_samples():
    """Plays 12 games with the current network and sends them to the repository, for the game viewer in the app."""
    from eftaios_rl import publish
    if not os.path.exists(os.path.join(RUN, "latest.pt")):
        say("There is no trained network yet: start the training first.")
        return 1
    if not ensure_torch():
        return 1
    from eftaios_rl import samples
    say("Playing 12 games with the network (a few minutes)...")
    path, data = samples.make(RUN, 12)
    say("Saved %s (%d games)." % (path, len(data["games"])))
    if not publish.token():
        say("No GitHub token saved: the games were not sent (menu item 'Save the GitHub token').")
        return 0
    ok, text = publish.put_file("nn/games.json", open(path, "rb").read(), "Sample games of the network for the game viewer")
    say(("OK  " if ok else "FAILED  ") + text)
    return 0 if ok else 1


def cmd_update():
    """Brings this program up to date from GitHub (no git needed). Your training and token stay as they are."""
    from eftaios_rl import publish
    if running():
        say("A training is running: stop it first (menu item 5), then update.")
        return 1
    try:
        n = publish.download_update(ROOT)
    except Exception as e:
        say("The update failed: %s\nIf the repository is private, save the GitHub token first (menu item 4)." % e)
        return 1
    say("Updated %d files. Close this window and double-click NN.bat again to use the new version." % n)
    return 0


def cmd_stop():
    os.makedirs(RUN, exist_ok=True)
    open(STOP, "w").close()
    say("Stop requested. The training window closes its work after the current iteration (about a minute) and sends the last progress.")
    return 0


def cmd_check():
    if not ensure_torch():
        return 1
    steps = [("rules of the game", ["tests/test_engine.py"]), ("same rules as the app", ["tests/test_conformance.py"]), ("what a player sees", ["tests/test_env.py"]),
             ("sending to GitHub", ["tests/test_publish.py"]), ("a short training run", ["-m", "eftaios_rl.train", "--run", "check", "--smoke"])]
    bad = 0
    for name, args in steps:
        say("Checking: %s ..." % name)
        r = subprocess.run([sys.executable] + args, cwd=ROOT, capture_output=True, text=True)
        say("   " + ("OK" if r.returncode == 0 else "FAILED"))
        if r.returncode:
            bad += 1
            say("\n".join((r.stdout + r.stderr).splitlines()[-12:]))
    say("\nEverything works." if not bad else "\n%d check(s) failed: copy the text above and send it to the developer." % bad)
    return 1 if bad else 0


MENU = [("1", "Start or resume the training", cmd_train), ("2", "Show progress", cmd_status), ("3", "Send the network and progress to GitHub now", cmd_publish),
        ("4", "Save the GitHub token (once)", cmd_token), ("5", "Stop the training (use this in a second window)", cmd_stop), ("6", "Check that everything works", cmd_check),
        ("7", "Record sample games for the game viewer and send them", cmd_samples),
        ("8", "Update this program from GitHub", cmd_update)]


def main():
    if len(sys.argv) > 1:
        fn = {"train": cmd_train, "status": cmd_status, "publish": cmd_publish, "token": cmd_token, "stop": cmd_stop, "check": cmd_check, "samples": cmd_samples, "update": cmd_update}.get(sys.argv[1])
        return fn() if fn else (say(__doc__) or 1)
    while True:
        say("\n=== EFTAIOS network trainer ===")
        for k, text, _ in MENU:
            say("  %s  %s" % (k, text))
        say("  0  Quit")
        c = input("Your choice: ").strip()
        if c == "0":
            return 0
        for k, _, fn in MENU:
            if c == k:
                try:
                    fn()
                except KeyboardInterrupt:
                    say("\nInterrupted.")
                except Exception as e:  # keep the menu alive whatever happens
                    say("Something went wrong: %s" % e)


if __name__ == "__main__":
    sys.exit(main())
