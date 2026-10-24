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
ITEM_COUNTS = {"adrenaline": 3, "sedatives": 3, "attack": 2, "cat": 2, "spotlight": 2, "teleport": 1, "defense": 1, "clone": 1, "sensor": 1, "mutation": 1}


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

    @property
    def ability(self):  # none after being reborn as an Alien
        return "" if self.reborn else self.char


class Game:
    def __init__(self, map_id, n, seed=None, ultimate=True, roles=None):
        self.board = maps_mod.get(map_id)
        self.n = n
        self.rng = random.Random(seed)
        self.ultimate = ultimate
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
            ch = hc.pop() if r == "human" else ac.pop()
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
                s.over = "trapped"
                self._out(self.cur, "trapped")
                continue
            self.phase = "move"
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
            return 1
        return 3 if (s.fed or (s.ability == "Fast Alien" and len(s.path) <= 1)) else 2

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
            card = self.pod_deck.draw()
            if s.ability == "Engineer":
                b2 = self.pod_deck.draw()
                if b2 is not None and card is not None:
                    keep, back = (b2, card) if (b2 == "green" and card != "green") else (card, b2)
                    self.pod_deck.draw_pile.append(back)
                    self.rng.shuffle(self.pod_deck.draw_pile)
                    card = keep
            self.open_pods.discard(n)
            ok = card == "green"
            self._emit(i, "hatch", cell, "ok" if ok else "damaged")
            if ok:
                s.over = "escaped"
                self._out(i, "escaped")
            return self._end_turn()
        if s.role == "alien":
            self.phase = "attack"
            return
        self._resolve_sector()

    def step_attack(self, do_attack):
        assert self.phase == "attack"
        s, i = self.seats[self.cur], self.cur
        if not do_attack:
            return self._resolve_sector()
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
        if fed:
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
        card = self.sector_deck.draw() or "silence"
        item = card[5:] if card.startswith("item:") else ""
        if item:
            card = "silence"
        if card == "silence" and not item and s.ability == "Psychic Alien":
            card = "noise-any"
        if card == "noise-self":
            self.sector_deck.disc.append(card)
            self._emit(i, "noise", s.pos)
            return self._end_turn()
        if card == "noise-any":
            self.sector_deck.disc.append(card)
            self.phase = "decoy"
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
        self._end_turn()

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
            else:
                self.step_decoy(self.rng.choice(self.decoy_cells()))
        raise RuntimeError("game did not end")
