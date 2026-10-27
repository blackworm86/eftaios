"""Headless rules of the game (the Ultimate rules without Item and Power *use*; see README). Mirrors cards.js / hot.js / game.js.

A turn is up to three decisions by the seat on the move:
  move   -> choose a destination cell (legal_moves())
  attack -> (Aliens, after moving to a non-pod sector) attack here instead of drawing a card?  step_attack(bool)
  decoy  -> a "noise in any sector" card was drawn: name the sector to announce.             step_decoy(cell)
Everything the other players hear is in `log` (kind, seat, cell, text): the only public information.
"""
import random

from . import maps as maps_mod

MAX_TURN = 40
HUMAN_CHARS = ["Captain", "Pilot", "Psychologist", "Soldier", "Executive Officer", "Co-pilot", "Engineer", "Medic"]
ALIEN_CHARS = ["Blink Alien", "Silent Alien", "Surge Alien", "Brute Alien", "Invisible Alien", "Lurking Alien", "Fast Alien", "Psychic Alien"]
# optional actions of the full rules (phases "pre", before the move, and "post", after it)
NONE, TELEPORT, ADRENALINE, SPOTLIGHT, SENSOR, MEDIC, MUTATION, STAY, LURK, ATTACK_H, SEDATIVES, CAT = range(12)
N_ACTS = 12
ONCE = {"Pilot", "Soldier", "Executive Officer", "Co-pilot", "Medic"}   # Character powers that can be used once a game
ALIEN_ITEM = {"Blink Alien": "teleport", "Silent Alien": "sedatives", "Surge Alien": "adrenaline"}
ITEM_COUNTS = {"adrenaline": 3, "sedatives": 3, "attack": 2, "cat": 2, "spotlight": 2, "teleport": 1, "defense": 1, "clone": 1, "sensor": 1, "mutation": 1}


def ab_ready(s, name):
    return s.role == "human" and s.ability == name and name not in s.used


class Deck:
    def __init__(self, cards, rng):
        self.rng, self.draw_pile, self.disc = rng, list(cards), []
        self.rng.shuffle(self.draw_pile)

    def draw(self):
        if not self.draw_pile and self.disc:  # only noise cards are discarded and come back
            self.draw_pile, self.disc = self.disc, []
            self.rng.shuffle(self.draw_pile)
        return self.draw_pile.pop() if self.draw_pile else None


class Seat:
    def __init__(self, role, char, pos):
        self.role0 = self.role = role
        self.char = char
        self.pos = pos
        self.fed = False
        self.over = None  # None, 'escaped', 'dead', 'trapped'
        self.reborn = False  # a Human that became an Alien
        self.items = []
        self.path = [(0, pos, "")]
        self.captain_used = False
        self.used = set()     # once-only powers already used
        self.adr = False      # Adrenaline played this turn
        self.cat = False      # two noises this turn

    @property
    def ability(self):  # none after being reborn as an Alien
        return "" if self.reborn else self.char


class Game:
    def __init__(self, map_id, n, seed=None, ultimate=True, roles=None, full=False, chars=None, script=None):
        """full: the Items and Character powers can be used (phases pre / post and the target phases); otherwise they are only drawn and held."""
        self.board = maps_mod.get(map_id)
        self.n = n
        self.rng = random.Random(seed)
        self.ultimate = ultimate
        self.full = bool(full and ultimate)
        self.script = script    # replay of a recorded game: {"sector": [cards drawn, in order], "pod": [cards kept, in order]} instead of shuffled decks
        self.decoys_left = 0
        self.turn = 1
        self.cur = 0
        self.log = []  # public events: dict(turn, seat, kind, cell, text)
        self.last = ""  # 'escaped' or 'lost': how the last Human left the game
        self.result = None
        self.open_pods = set(self.board.pod_cell)
        cards = ["noise-self"] * 27 + ["noise-any"] * 27 + ["silence"] * 6
        if ultimate:
            for k, v in ITEM_COUNTS.items():
                cards += ["item:" + k] * v
        else:
            cards += ["silence"] * 17
        self.sector_deck = Deck(cards, self.rng)
        self.pod_deck = Deck(["green"] * 4 + ["red"], self.rng)
        humans = n // 2
        order = roles or self.rng.sample(["human"] * humans + ["alien"] * (n - humans), n)
        hc, ac = self.rng.sample(HUMAN_CHARS, 8), self.rng.sample(ALIEN_CHARS, 8)
        self.seats = []
        for r in order:
            ch = chars[len(self.seats)] if chars else (hc.pop() if r == "human" else ac.pop())
            if not ultimate:
                ch = ""
            home = self.board.start_a if (r == "alien" or ch == "Psychologist") else self.board.start_h
            self.seats.append(Seat(r, ch, home))
        self.phase = "move"
        self._begin_turn()

    # ---------------------------------------------------------------- state helpers
    def _emit(self, seat, kind, cell=None, text=""):
        self.log.append({"turn": self.turn, "seat": seat, "kind": kind, "cell": cell, "text": text})

    def _out(self, i, why):
        s = self.seats[i]
        self._emit(i, "out", None, "%s|%s|%s" % ("killed" if why == "dead" else why, s.role, "" if s.reborn else s.char))
        self.last = "escaped" if why == "escaped" else "lost"

    def _evaluate(self):
        if self.result is not None:
            return
        humans = [s for s in self.seats if s.role0 == "human"]
        aboard = [s for s in humans if s.over is None and s.role == "human"]
        escaped = [i for i, s in enumerate(self.seats) if s.role0 == "human" and s.over == "escaped"]
        if not aboard:
            self.result = {"aliens_win": self.last != "escaped", "reason": "escape" if self.last == "escaped" else "eliminated", "escaped": escaped}
        elif self.turn > MAX_TURN:
            self.result = {"aliens_win": True, "reason": "time", "escaped": escaped}
        if self.result is not None:
            self.phase = "over"

    def _advance(self):
        for k in range(1, self.n + 1):
            j = (self.cur + k) % self.n
            if self.seats[j].over is None:
                if j <= self.cur:
                    self.turn += 1
                self.cur = j
                return True
        return False

    def _begin_turn(self):
        """Start the turn of the seat on the move (skipping seats that are out; a Human with no open pod is trapped)."""
        while self.result is None:
            self._evaluate()
            if self.result is not None:
                return
            s = self.seats[self.cur]
            if s.over is not None:
                if not self._advance():
                    self._evaluate()
                    return
                continue
            if s.role == "human" and not self.open_pods:
                if self.full and "mutation" in s.items:   # no pod left: turn Alien rather than be trapped
                    self._mutate(self.cur)
                else:
                    s.over = "trapped"
                    self._out(self.cur, "trapped")
                    continue
            s.adr = s.cat = False
            self.phase = "pre" if self.full and len(self.acts("pre")) > 1 else "move"
            return

    def _end_turn(self):
        self._evaluate()
        if self.result is not None:
            return
        if not self._advance():
            self._evaluate()
            return
        self._begin_turn()

    # ---------------------------------------------------------------- decisions
    def allowance(self, i=None):
        s = self.seats[self.cur if i is None else i]
        if s.role != "alien":
            return 1 + s.adr
        return (3 if (s.fed or (s.ability == "Fast Alien" and len(s.path) <= 1)) else 2) + s.adr

    def legal_moves(self):
        s = self.seats[self.cur]
        return sorted(self.board.reachable(s.pos, self.allowance(), s.role, self.open_pods))

    def step_move(self, cell):
        assert self.phase == "move" and cell in self.board.reachable(self.seats[self.cur].pos, self.allowance(), self.seats[self.cur].role, self.open_pods), "illegal move"
        s, i, b = self.seats[self.cur], self.cur, self.board
        s.pos = cell
        s.path.append((self.turn, cell, ""))
        ty = b.kind[cell]
        if ty in "1234":  # a Human enters an open pod: draw an Escape Pod card
            n = int(ty)
            card = self._draw_pod(s.ability == "Engineer")
            self.open_pods.discard(n)
            ok = card == "green"
            self._emit(i, "hatch", cell, "ok" if ok else "damaged")
            if ok:
                s.over = "escaped"
                self._out(i, "escaped")
            return self._end_turn()
        s.adr = False
        if s.role == "alien":
            self.phase = "attack"
            return
        self._after_move()

    def _after_move(self):
        """The mover stands in a sector: a Human or Silent Alien may still play a card (post), then the sector card is drawn."""
        if self.full and len(self.acts("post")) > 1:
            self.phase = "post"
            return
        self._resolve_sector()

    def _draw_pod(self, two):
        if self.script:
            return self.script["pod"].pop(0)
        card = self.pod_deck.draw()
        if two:
            b2 = self.pod_deck.draw()
            if b2 is not None and card is not None:
                keep, back = (b2, card) if (b2 == "green" and card != "green") else (card, b2)
                self.pod_deck.draw_pile.append(back)
                self.rng.shuffle(self.pod_deck.draw_pile)
                card = keep
        return card

    def step_attack(self, do_attack):
        assert self.phase == "attack"
        if not do_attack:
            return self._after_move()
        self._attack(self.cur)

    def _attack(self, i):
        s = self.seats[i]
        self._emit(i, "attack", s.pos)
        fed = False
        for j, o in enumerate(self.seats):
            if j == i or o.over is not None or o.pos != s.pos or self.board.kind[o.pos] in "1234":
                continue
            if o.role == "alien" and o.ability == "Brute Alien":
                self._emit(j, "reveal", None, "Brute Alien")
                continue
            if o.role == "human":
                if "defense" in o.items:
                    o.items.remove("defense")
                    self._emit(j, "item", None, "defense")
                elif "clone" in o.items:
                    o.items = []
                    o.pos = self.board.start_h
                    o.path.append((self.turn, o.pos, "clone"))
                    self._emit(j, "item", None, "clone")
                else:
                    self._emit(j, "out", None, "killed|human|%s" % ("" if o.reborn else o.char))
                    o.role, o.fed, o.reborn, o.items, o.pos = "alien", False, True, [], self.board.start_a
                    o.path.append((self.turn, o.pos, "reborn"))
                    self.last = "lost"
                    fed = True
            else:
                o.over = "dead"
                self._out(j, "dead")
        if fed and s.role == "alien":
            s.fed = True
        self._end_turn()

    def _resolve_sector(self):
        s, i = self.seats[self.cur], self.cur
        ty = self.board.kind[s.pos]
        if ty == "s":
            self._emit(i, "silence", None, "secure")
            return self._end_turn()
        if s.ability == "Captain" and not s.captain_used:  # the Captain skips the card the first time, and says so
            s.captain_used = True
            self._emit(i, "reveal", None, "Id|human|Captain")
            return self._end_turn()
        card = (self.script["sector"].pop(0) if self.script else self.sector_deck.draw()) or "silence"
        item = card[5:] if card.startswith("item:") else ""
        if item:
            card = "silence"
        if s.cat:
            item = ""   # a Cat card or the Pilot's power: the item card is lost with the draw
        if card == "silence" and s.ability == "Psychic Alien":   # also the Silence an Item card counts as
            card = "noise-any"
        if card == "noise-self":
            self.sector_deck.disc.append(card)
            self._emit(i, "noise", s.pos)
            if s.cat:
                self.decoys_left, self.phase = 1, "decoy"
                return
            return self._end_turn()
        if card == "noise-any":
            self.sector_deck.disc.append(card)
            self.decoys_left, self.phase = 2 if s.cat else 1, "decoy"
            return
        self._emit(i, "silence", None, "silence")
        if item:
            if self.ultimate and not (s.role == "alien" and s.reborn):
                s.items.append(item)
        self._end_turn()

    def decoy_cells(self):
        return [c for c in range(self.board.n) if self.board.kind[c] != "x"]

    def step_decoy(self, cell):
        assert self.phase == "decoy" and self.board.kind[cell] != "x"
        self._emit(self.cur, "noise", cell, "any")
        self.decoys_left -= 1
        if self.decoys_left > 0:
            return
        self._end_turn()

    # ---------------------------------------------------------------- Items and Character powers (full rules)
    def _use_item(self, i, name):
        s = self.seats[i]
        s.items.remove(name)
        self.sector_deck.disc.append("item:" + name)   # a played card goes to the discard pile, which is reshuffled with the noise cards
        self._emit(i, "item", None, name)

    def _can(self, s, item):
        """May this seat play the item: a Human any card, an Alien only the one its Character allows."""
        if item not in s.items:
            return False
        return s.role == "human" if s.role == "human" else (not s.reborn and ALIEN_ITEM.get(s.ability) == item)

    def _others(self, i):
        return [j for j, o in enumerate(self.seats) if j != i and o.over is None]

    def acts(self, kind=None):
        """Actions the seat on the move may take now ('pre' or 'post'); NONE is always the first."""
        kind = kind or self.phase
        s, i = self.seats[self.cur], self.cur
        out = [NONE]
        if not self.full:
            return out
        human = s.role == "human"
        ab = s.ability
        if kind == "pre":
            at_home = s.pos == self.board.start_h
            if not at_home and (self._can(s, "teleport") or (human and ab == "Co-pilot" and "Co-pilot" not in s.used)):
                out.append(TELEPORT)
            if not s.adr and self._can(s, "adrenaline"):
                out.append(ADRENALINE)
            if human and "spotlight" in s.items:
                out.append(SPOTLIGHT)
            if human and "sensor" in s.items and self._others(i):
                out.append(SENSOR)
            if human and ab == "Medic" and "Medic" not in s.used and self._others(i):
                out.append(MEDIC)
            if human and "mutation" in s.items:
                out.append(MUTATION)
            if human and ab == "Executive Officer" and "Executive Officer" not in s.used and self.board.kind[s.pos] in ".s":
                out.append(STAY)
            if not human and ab == "Lurking Alien":
                out.append(LURK)
        elif kind == "post":
            if human and ("attack" in s.items or (ab == "Soldier" and "Soldier" not in s.used)):
                out.append(ATTACK_H)
            if self.board.kind[s.pos] == "." and not (ab == "Captain" and not s.captain_used):   # Sedatives and the Cat only matter where a card is drawn
                if self._can(s, "sedatives"):
                    out.append(SEDATIVES)
                if human and ("cat" in s.items or (ab == "Pilot" and "Pilot" not in s.used)):
                    out.append(CAT)
        return out

    def _mutate(self, i):
        s = self.seats[i]
        self._use_item(i, "mutation")
        s.role, s.fed, s.reborn = "alien", False, True
        s.path.append((self.turn, s.pos, "mutated"))
        self.last = "lost"

    def step_act(self, a):
        """Take an optional action. NONE ends the 'pre' stage (the move follows) or the 'post' stage (the sector card is drawn)."""
        assert self.phase in ("pre", "post") and a in self.acts(), "illegal action"
        s, i = self.seats[self.cur], self.cur
        if a == NONE:
            if self.phase == "pre":
                self.phase = "move"
                return
            return self._resolve_sector()
        if a == TELEPORT:
            if self._can(s, "teleport"):
                self._use_item(i, "teleport")
            else:
                s.used.add("Co-pilot")
                self._emit(i, "reveal", None, "Id|%s|%s" % (s.role, s.char))
            s.pos = self.board.start_h
            s.path.append((self.turn, s.pos, "teleport"))
        elif a == ADRENALINE:
            self._use_item(i, "adrenaline")
            s.adr = True
        elif a == MUTATION:
            self._mutate(i)
        elif a in (SPOTLIGHT, SENSOR, MEDIC):
            if a == SPOTLIGHT:
                self._use_item(i, "spotlight")
            elif a == SENSOR:
                self._use_item(i, "sensor")
            else:
                s.used.add("Medic")
                self._emit(i, "reveal", None, "Id|%s|%s" % (s.role, s.char))
            self.target = a
            self.phase = "target_cell" if a == SPOTLIGHT else "target_seat"
            return
        elif a == STAY:
            s.used.add("Executive Officer")
            s.path.append((self.turn, s.pos, "stay"))
            return self._after_move()
        elif a == LURK:
            s.path.append((self.turn, s.pos, "lurk"))
            return self._attack(i)
        elif a == ATTACK_H:
            if ab_ready(s, "Soldier"):   # a power is spent before a card
                s.used.add("Soldier")
                self._emit(i, "reveal", None, "Id|human|Soldier")   # the Soldier's attack is shown like an Attack card
            else:
                self._use_item(i, "attack")
            return self._attack(i)
        elif a == SEDATIVES:
            self._use_item(i, "sedatives")
            return self._end_turn()
        elif a == CAT:
            if ab_ready(s, "Pilot"):
                s.used.add("Pilot")
            else:
                self._use_item(i, "cat")
            s.cat = True
            return self._resolve_sector()
        if self.phase == "pre" and len(self.acts("pre")) <= 1:
            self.phase = "move"

    def target_cells(self):
        return [c for c in range(self.board.n) if self.board.kind[c] != "x"]

    def target_seats(self):
        return self._others(self.cur)

    def _after_target(self):
        self.phase = "pre"
        if len(self.acts("pre")) <= 1:
            self.phase = "move"

    def step_target_cell(self, cell):
        """Spotlight: every seat in that sector or next to it announces its position (an Invisible Alien shows its identity)."""
        assert self.phase == "target_cell" and self.board.kind[cell] != "x"
        zone = set(self.board.neighbors[cell]) | {cell}
        for j, o in enumerate(self.seats):
            if o.over is None and o.pos in zone:
                if o.ability == "Invisible Alien" and j != self.cur:
                    self._emit(j, "reveal", None, "Invisible Alien")
                else:
                    self._emit(j, "reveal", o.pos, "Spotlight")
        self._after_target()

    def step_target_seat(self, j):
        """Sensor: that player announces the exact position. Medic: that player shows who they are."""
        assert self.phase == "target_seat" and j in self.target_seats()
        o = self.seats[j]
        if self.target == SENSOR:
            if o.ability == "Invisible Alien":
                self._emit(j, "reveal", None, "Invisible Alien")
            else:
                self._emit(j, "reveal", o.pos, "Sensor")
        else:
            self._emit(j, "reveal", None, "Id|%s|%s" % (o.role, o.char))
        self._after_target()

    # ---------------------------------------------------------------- convenience
    def play_random(self, max_steps=100000):
        """Play to the end with random legal decisions (used by the tests)."""
        for _ in range(max_steps):
            if self.phase == "over":
                return self.result
            if self.phase == "move":
                self.step_move(self.rng.choice(self.legal_moves()))
            elif self.phase == "attack":
                self.step_attack(self.rng.random() < 0.3)
            elif self.phase in ("pre", "post"):
                a = self.acts()
                self.step_act(a[0] if self.rng.random() < 0.5 else self.rng.choice(a))
            elif self.phase == "target_cell":
                self.step_target_cell(self.rng.choice(self.target_cells()))
            elif self.phase == "target_seat":
                self.step_target_seat(self.rng.choice(self.target_seats()))
            else:
                self.step_decoy(self.rng.choice(self.decoy_cells()))
        raise RuntimeError("game did not end")
