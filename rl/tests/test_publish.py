"""The progress report and the GitHub sending, against a small stand-in for the GitHub API."""
import base64
import http.server
import json
import os
import sys
import tempfile
import threading
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
FILES = {}
CALLS = []


class Stub(http.server.BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def _send(self, code, obj):
        data = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        if "/zipball/" in self.path:
            data = FILES["zip"]
            self.send_response(200)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            return self.wfile.write(data)
        path = self.path.split("?")[0].split("/contents/")[-1]
        CALLS.append(("GET", path))
        self._send(200, {"sha": "sha-of-" + path}) if path in FILES else self._send(404, {"message": "Not Found"})

    def do_PUT(self):
        path = self.path.split("/contents/")[-1]
        body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if self.headers["Authorization"] != "Bearer github_pat_test":
            return self._send(401, {"message": "Bad credentials"})
        CALLS.append(("PUT", path, body.get("sha")))
        FILES[path] = base64.b64decode(body["content"])
        self._send(200 if body.get("sha") else 201, {"ok": 1})


def test_update():
    import io
    import zipfile
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as z:
        z.writestr("blackworm86-eftaios-abc123/rl/nnctl.py", "new")
        z.writestr("blackworm86-eftaios-abc123/rl/eftaios_rl/samples.py", "samples")
        z.writestr("blackworm86-eftaios-abc123/rl/runs/main/latest.pt", "must not be written")
        z.writestr("blackworm86-eftaios-abc123/rl/data/teacher/new.jsonl.gz", "new recording")
        z.writestr("blackworm86-eftaios-abc123/index.html", "not in rl")
    FILES["zip"] = buf.getvalue()
    srv = http.server.HTTPServer(("127.0.0.1", 0), Stub)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from eftaios_rl import publish
    publish.API = "http://127.0.0.1:%d" % srv.server_port
    root = tempfile.mkdtemp()
    os.makedirs(os.path.join(root, "settings"))
    open(os.path.join(root, "settings", "keep.txt"), "w").write("mine")
    os.makedirs(os.path.join(root, "data", "teacher"))
    open(os.path.join(root, "data", "teacher", "old.jsonl.gz"), "w").write("a recording removed on GitHub")
    assert publish.download_update(root) == 3
    assert open(os.path.join(root, "nnctl.py")).read() == "new" and os.path.exists(os.path.join(root, "eftaios_rl", "samples.py"))
    assert not os.path.exists(os.path.join(root, "runs")) and open(os.path.join(root, "settings", "keep.txt")).read() == "mine"
    assert os.listdir(os.path.join(root, "data", "teacher")) == ["new.jsonl.gz"], "the old recording must be gone"
    srv.shutdown()


def test_everything():
    srv = http.server.HTTPServer(("127.0.0.1", 0), Stub)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    from eftaios_rl import publish, report
    publish.API = "http://127.0.0.1:%d" % srv.server_port
    d = tempfile.mkdtemp()
    publish.TOKEN_FILE = os.path.join(d, "token.txt")
    assert publish.token() == ""
    assert "No GitHub token" in publish.publish_now(d)[0]  # nothing is sent without a token
    publish.save_token("github_pat_test\n")
    assert publish.token() == "github_pat_test"
    run = os.path.join(d, "run")
    os.makedirs(run)
    with open(os.path.join(run, "eval.csv"), "w") as f:
        for i in range(1, 41):
            f.write("%d,%.1f,70.0,%.1f,30.0\n" % (i * 10, 50 + i / 4, 60 + i / 8))
    with open(os.path.join(run, "train.log"), "w") as f:
        t = time.time() - 4000
        for i in range(1, 41):
            gap = 40000 if i > 20 else 0  # a long stop in the middle of the log must not change the speed
            f.write("%s it %d: 25000 decisions\n" % (time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(t + i * 60 + gap)), i))
    json.dump({"hid": 64, "layers": 4, "workers": 7, "eval_every": 10, "publish_hours": 3, "kl": 0.1}, open(os.path.join(run, "config.json"), "w"))
    text = report.summary(run)
    assert "Iteration: **40**" in text and "60 seconds per iteration" in text and "Gain over the Hard copy" in text and "better than the Hard copy" in text, text
    out = publish.publish_now(run, with_network=False)
    assert all(l.startswith("OK") for l in out) and set(FILES) - {"zip"} == {"nn/status.md", "nn/eval.csv"}, out
    assert ("PUT", "nn/status.md", None) in CALLS  # first time: created
    publish.publish_now(run, with_network=False)
    assert ("PUT", "nn/status.md", "sha-of-nn/status.md") in CALLS  # second time: replaced, with the sha
    assert publish.maybe_publish(run, {"publish_hours": 3}) == []  # not due again yet
    assert publish.maybe_publish(run, {"publish_hours": 3}, final=True)  # but always once more at the end
    assert publish.maybe_publish(run, {"publish_hours": 0}, final=True) == []  # switched off
    publish.save_token("wrong")
    ok, why = publish.put_file("nn/x.txt", b"x", "m")
    assert not ok and "token is wrong" in why, why
    srv.shutdown()


if __name__ == "__main__":
    test_update()
    test_everything()
    print("ok publish")
