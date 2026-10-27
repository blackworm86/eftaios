"""Plays a recorded app game (tools/sim.js --teach) back in the Python rules, decision by decision.

A record is one JSON object per game: map, n, setup [{role, char}], tr (the bots' decisions in the order taken, plus the cards drawn),
result and log (the public announcements the app produced). Replaying checks the Python rules against the app (the announcements must come out the
same), and gives every decision to a callback, which is how the teacher's training rows are made.

tr entries: s seat, k kind: move c | atk v | tele | adr | spot c | sens j | med j | mut | stay | lurk | hatk | sed | cat | dec c | ds v (sector card) | dh v (pod card).
"""
import gzip
import json

from . import engine, maps as maps_mod

PRE = {"tele": engine.TELEPORT, "adr": engine.ADRENALINE, "spot": engine.SPOTLIGHT, "sens": engine.SENSOR, "med": engine.MEDIC, "mut": engine.MUTATION,
       "stay": engine.STAY, "lurk": engine.LURK}
POST = {"hatk": engine.ATTACK_H, "sed": engine.SEDATIVES, "cat": engine.CAT}
TEXT_KINDS = ("out", "item", "reveal", "silence")


def read(path):
    with gzip.open(path, "rt") as f:
        recs = [json.loads(line) for line in f if line.strip()]
    return [r for r in recs if "tr" in r]   # a file from the first recorder (rows, not games) is skipped


def start(rec):
    script = {"sector": [e["v"] for e in rec["tr"] if e["k"] == "ds"], "pod": [e["v"] for e in rec["tr"] if e["k"] == "dh"]}
    roles = [x["role"] for x in rec["setup"]]
    chars = [x["char"] for x in rec["setup"]]
    return engine.Game(rec["map"], rec["n"], roles=roles, chars=chars, full=True, script=script)


def play(rec, on_decision=None):
    """Returns the finished Game. on_decision(game, phase, action) is called before each decision is applied; action is what the app's bot did
    (a cell, 0/1, an act code, or a seat), and the phase is the engine's. Raises AssertionError when the recording does not fit the rules."""
    g = start(rec)
    b = g.board
    todo = [e for e in rec["tr"] if e["k"] not in ("ds", "dh")]
    k = 0

    def peek():
        return todo[k] if k < len(todo) else None

    def say(phase, action):
        if on_decision:
            on_decision(g, phase, action)

    while g.phase != "over":
        e, i, ph = peek(), g.cur, g.phase
        if ph in ("pre", "post"):
            table = PRE if ph == "pre" else POST
            if e is not None and e["s"] == i and e["k"] in table:
                a = table[e["k"]]
                say(ph, a)
                g.step_act(a)
                k += 1
                if a == engine.SPOTLIGHT:
                    c = b.parse_id(e["c"])
                    say("target_cell", c)
                    g.step_target_cell(c)
                elif a in (engine.SENSOR, engine.MEDIC):
                    say("target_seat", e["j"])
                    g.step_target_seat(e["j"])
            else:
                say(ph, engine.NONE)
                g.step_act(engine.NONE)
            continue
        assert e is not None and e["s"] == i, "recording ended or is out of turn at seat %d (%s): %s" % (i, ph, e)
        if ph == "move":
            assert e["k"] == "move", "expected a move, got %s" % e
            c = b.parse_id(e["c"])
            say(ph, c)
            g.step_move(c)
        elif ph == "attack":
            assert e["k"] == "atk", "expected an attack decision, got %s" % e
            say(ph, e["v"])
            g.step_attack(bool(e["v"]))
        elif ph == "decoy":
            assert e["k"] == "dec", "expected a decoy, got %s" % e
            c = b.parse_id(e["c"])
            say(ph, c)
            g.step_decoy(c)
        else:
            raise AssertionError("unexpected phase %s" % ph)
        k += 1
    assert k == len(todo), "%d recorded decisions left over: %s" % (len(todo) - k, todo[k])
    return g


def _norm_app(rec):
    return [(t, s, kind, cell, text if kind in TEXT_KINDS else "") for t, s, kind, cell, text in rec["log"] if kind in ("noise", "silence", "attack", "reveal", "item", "out", "hatch")]


def _norm_py(g):
    return [(e["turn"], e["seat"], e["kind"], e["cell"], e["text"] if e["kind"] in TEXT_KINDS else "") for e in g.log]


def compare(rec, g):
    """Differences between the app's announcements and the Python ones (empty list = identical)."""
    a, p = _norm_app(rec), _norm_py(g)
    out = []
    for n, (x, y) in enumerate(zip(a, p)):
        if x != y:
            out.append("announcement %d: app %s, python %s" % (n, x, y))
            break
    if len(a) != len(p) and not out:
        out.append("app made %d announcements, python %d" % (len(a), len(p)))
    r = rec["result"]
    if g.result is None or g.result["aliens_win"] != bool(r["aliensWin"]):
        out.append("result: app %s, python %s" % (r, g.result))
    return out
