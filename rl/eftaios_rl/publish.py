"""Sends the network and the progress report to the GitHub repository (folder nn/), with no git needed: the GitHub web API and a token.

The token is read from settings/github-token.txt (a fine-grained token with Contents: read and write on this repository only).
"""
import base64
import json
import os
import time
import urllib.error
import urllib.request

from . import report

REPO = os.environ.get("EFTAIOS_REPO", "blackworm86/eftaios")
API = os.environ.get("EFTAIOS_API", "https://api.github.com")
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
TOKEN_FILE = os.path.join(ROOT, "settings", "github-token.txt")


def token():
    try:
        return open(TOKEN_FILE, encoding="utf-8").read().strip()
    except OSError:
        return ""


def save_token(value):
    os.makedirs(os.path.dirname(TOKEN_FILE), exist_ok=True)
    open(TOKEN_FILE, "w", encoding="utf-8").write(value.strip())


def _call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"Authorization": "Bearer " + token(), "Accept": "application/vnd.github+json", "User-Agent": "eftaios-nn"})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read() or b"{}")
        except ValueError:
            return e.code, {}


def put_file(repo_path, data, message):
    """Create or replace one file on the main branch. Returns (ok, text)."""
    st, cur = _call("GET", "/repos/%s/contents/%s?ref=main" % (REPO, repo_path))
    body = {"message": message, "branch": "main", "content": base64.b64encode(data).decode()}
    if st == 200 and isinstance(cur, dict) and cur.get("sha"):
        body["sha"] = cur["sha"]
    elif st not in (200, 404):
        return False, "GitHub answered %d: %s" % (st, cur.get("message", ""))
    st, res = _call("PUT", "/repos/%s/contents/%s" % (REPO, repo_path), body)
    if st in (200, 201):
        return True, "sent %s (%d KB)" % (repo_path, len(data) // 1024)
    why = {401: "the token is wrong or expired", 403: "the token cannot write to this repository", 404: "the token cannot see this repository"}.get(st, "")
    return False, "GitHub answered %d %s %s" % (st, why, res.get("message", ""))


def download_update(root):
    """Replaces the program's own files (this rl folder) with the ones on GitHub's main branch. Your runs, settings and Python environment are never touched.
    Returns the number of files written."""
    import io
    import zipfile
    req = urllib.request.Request(API + "/repos/%s/zipball/main" % REPO, headers={"Authorization": "Bearer " + token(), "User-Agent": "eftaios-nn"} if token() else {"User-Agent": "eftaios-nn"})
    with urllib.request.urlopen(req, timeout=120) as r:
        z = zipfile.ZipFile(io.BytesIO(r.read()))
    n, kept = 0, set()
    for name in z.namelist():
        parts = name.split("/", 2)  # <repo-and-commit>/rl/<file>
        if len(parts) < 3 or parts[1] != "rl" or name.endswith("/") or parts[2].split("/")[0] in ("runs", "settings", ".venv", "__pycache__"):
            continue
        dest = os.path.join(root, *parts[2].split("/"))
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        open(dest, "wb").write(z.read(name))
        kept.add(os.path.abspath(dest))
        n += 1
    for folder, _, names in os.walk(os.path.join(root, "data")):   # a recording or data file removed on GitHub must not stay behind (the trainer reads every file in data/teacher)
        for f in names:
            if os.path.abspath(os.path.join(folder, f)) not in kept:
                os.remove(os.path.join(folder, f))
    return n


def _net_bytes(run_dir):
    import torch  # only needed here
    best = os.path.join(run_dir, "best.pt")   # the best network so far, once there is one (new runs); else the latest
    s = torch.load(best if os.path.exists(best) else os.path.join(run_dir, "latest.pt"), map_location="cpu")
    state = s["net"]
    blob = {"format": 1, "hid": s["cfg"]["hid"], "layers": s["cfg"]["layers"], "iteration": s.get("it", 0),
            "weights": {k: {"shape": list(v.shape), "data": [round(float(x), 6) for x in v.flatten().tolist()]} for k, v in state.items()}}
    return json.dumps(blob).encode(), s.get("it", 0)


def publish_now(run_dir, with_network=True):
    """Send status.md and eval.csv (and the network). Returns a list of text lines for the screen."""
    if not token():
        return ["No GitHub token saved yet: nothing was sent. Use the menu item 'Save the GitHub token' (see HOWTO.md, step 3)."]
    lines = []
    files = [("nn/status.md", report.summary(run_dir).encode()), ("nn/eval.csv", open(os.path.join(run_dir, "eval.csv"), "rb").read() if os.path.exists(os.path.join(run_dir, "eval.csv")) else b"")]
    it = report.iteration(run_dir)
    if with_network and os.path.exists(os.path.join(run_dir, "latest.pt")):
        try:
            data, nit = _net_bytes(run_dir)
            files.append(("nn/net.json", data))
        except Exception as e:  # a half-written checkpoint or a missing PyTorch must not stop the rest
            lines.append("The network could not be exported (%s); sending the report only." % e)
    for path, data in files:
        if not data:
            continue
        ok, text = put_file(path, data, "Network training: iteration %d (%s)" % (it, path.split("/")[-1]))
        lines.append(("OK  " if ok else "FAILED  ") + text)
    state = _state_path(run_dir)
    json.dump({"time": time.time(), "it": it}, open(state, "w"))
    return lines


def _state_path(run_dir):
    return os.path.join(run_dir, "publish.json")


def maybe_publish(run_dir, cfg, final=False):
    """Called by the training after every iteration: sends everything every `publish_hours` hours, and once more when it stops."""
    if not token() or not cfg.get("publish_hours"):
        return []
    try:
        last = json.load(open(_state_path(run_dir)))["time"]
    except (OSError, ValueError, KeyError):
        last = 0
    if not final and time.time() - last < cfg["publish_hours"] * 3600:
        return []
    return publish_now(run_dir)
