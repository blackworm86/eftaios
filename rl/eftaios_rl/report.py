"""A plain-language progress report of a training run, from the files the training writes (eval.csv, train.log, config.json, latest.pt)."""
import json
import os
import re
import time


def _read(path, default=""):
    try:
        return open(path, encoding="utf-8").read()
    except OSError:
        return default


def evals(run_dir):
    rows = []
    for line in _read(os.path.join(run_dir, "eval.csv")).splitlines():
        p = line.split(",")
        if len(p) == 5:
            try:
                rows.append([float(x) for x in p])
            except ValueError:
                pass
    return rows  # [iteration, human net, human rule-based, alien net, alien rule-based]


def _avg(rows, col):
    return sum(r[col] for r in rows) / len(rows) if rows else 0.0


def speed(run_dir):
    """Typical seconds per iteration: the median of the gaps between consecutive iteration lines (a stop in between does not count)."""
    ts = []
    for m in re.finditer(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d) it (\d+):", _read(os.path.join(run_dir, "train.log")), re.M):
        ts.append((time.mktime(time.strptime(m.group(1), "%Y-%m-%d %H:%M:%S")), int(m.group(2))))
    gaps = sorted(b[0] - a[0] for a, b in zip(ts[-31:], ts[-30:]) if b[1] == a[1] + 1)
    return gaps[len(gaps) // 2] if gaps else None


def iteration(run_dir):
    its = [int(x) for x in re.findall(r"^\S+ \S+ it (\d+):", _read(os.path.join(run_dir, "train.log")), re.M)]
    return its[-1] if its else 0


def summary(run_dir):
    """Markdown text: where the training stands and whether it is still improving."""
    ev, cfg = evals(run_dir), {}
    try:
        cfg = json.load(open(os.path.join(run_dir, "config.json")))
    except (OSError, ValueError):
        pass
    it, sp = iteration(run_dir), speed(run_dir)
    out = ["# Network training status", "", "Updated %s." % time.strftime("%Y-%m-%d %H:%M"), ""]
    out.append("- Iteration: **%d**" % it)
    if sp:
        out.append("- Speed: %.0f seconds per iteration (%.0f per hour)" % (sp, 3600 / sp))
    if cfg:
        out.append("- Network: %s hidden units, %s layers; %s game workers" % (cfg.get("hid"), cfg.get("layers"), cfg.get("workers")))
    if len(ev) >= 4:
        last, prev = ev[-15:], ev[-30:-15]
        out += ["", "## Evaluation against simple rule-based players (average of the last %d evaluations)" % len(last), "",
                "| | network | rule-based players | change since the 15 before |", "|---|---|---|---|"]
        for name, c in (("Humans (team win %)", 1), ("Aliens (team win %)", 3)):
            d = "%+.1f" % (_avg(last, c) - _avg(prev, c)) if prev else "n/a"
            out.append("| %s | %.1f | %.1f | %s |" % (name, _avg(last, c), _avg(last, c + 1), d))
        if prev:
            moved = abs(_avg(last, 1) - _avg(prev, 1)) + abs(_avg(last, 3) - _avg(prev, 3))
            out += ["", "Verdict: " + ("still improving" if moved > 4 else "flat: it has stopped getting better with this setup")]
    else:
        out += ["", "Not enough evaluations yet (one is made every %s iterations)." % cfg.get("eval_every", 10)]
    tail = _read(os.path.join(run_dir, "train.log")).splitlines()[-8:]
    out += ["", "## Last log lines", "", "```"] + tail + ["```"]
    return "\n".join(out) + "\n"
