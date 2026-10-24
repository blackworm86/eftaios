"""Maps from maps/maps.json: hex grid, neighbours and walking rules exactly as app.js (neighbors, reachable)."""
import json
import os

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
MAPS_JSON = os.environ.get("EFTAIOS_MAPS", os.path.join(HERE, "..", "data", "maps.json"))
if not os.path.exists(MAPS_JSON):
    MAPS_JSON = os.path.join(HERE, "..", "..", "maps", "maps.json")


class Board:
    """One map. Cells are numbered row * cols + col; id strings are like the app's ('K09' = column K, row 9)."""

    def __init__(self, raw):
        rows = raw["rows_data"]
        self.id = raw["id"]
        self.rows, self.cols = len(rows), len(rows[0])
        self.n = self.rows * self.cols
        self.odd = raw.get("oddColumnsLower") is not False
        self.grid = [list(r) for r in rows]
        self.kind = np.array([ch for r in rows for ch in r])  # one character per cell
        self.neighbors = [self._neighbors(i) for i in range(self.n)]
        self.start_h = self.find("H")
        self.start_a = self.find("A")
        self.pod_cell = {int(n): self.find(str(n)) for n in (1, 2, 3, 4) if self.find(str(n)) is not None}

    def find(self, ch):
        idx = np.flatnonzero(self.kind == ch)
        return int(idx[0]) if len(idx) else None

    def cell_id(self, i):
        return chr(65 + i % self.cols) + str(i // self.cols + 1).zfill(2)

    def parse_id(self, s):
        return (int(s[1:]) - 1) * self.cols + (ord(s[0].upper()) - 65)

    def _lower(self, c):
        return c % 2 == 1 if self.odd else c % 2 == 0

    def _neighbors(self, i):
        r, c = divmod(i, self.cols)
        d = ([(0, -1), (0, 1), (-1, 0), (-1, 1), (1, 0), (1, 1)] if self._lower(c)
             else [(0, -1), (0, 1), (-1, -1), (-1, 0), (1, -1), (1, 0)])
        return [(r + b) * self.cols + (c + a) for a, b in d if 0 <= c + a < self.cols and 0 <= r + b < self.rows]

    def reachable(self, frm, steps, role, open_pods):
        """app.js reachable(): up to `steps` steps; start sectors and walls are never entered; a pod ends the walk and only
        a Human may enter an open one. Returns {cell: steps}."""
        dist, q, out = {frm: 0}, [frm], {}
        for cur in q:
            d = dist[cur]
            if d == steps:
                continue
            for n in self.neighbors[cur]:
                t = self.kind[n]
                if n in dist or t in "xHA":
                    continue
                if t in "1234":
                    if role == "human" and int(t) in open_pods:
                        dist[n] = d + 1
                        out[n] = d + 1
                    continue
                dist[n] = d + 1
                out[n] = d + 1
                q.append(n)
        return out

    def adjacency(self):
        """Dense normalised adjacency (walkable cells, with self loops) for the graph network."""
        a = np.zeros((self.n, self.n), np.float32)
        walk = self.kind != "x"
        for i in range(self.n):
            if not walk[i]:
                continue
            a[i, i] = 1
            for j in self.neighbors[i]:
                if walk[j]:
                    a[i, j] = 1
        d = a.sum(1)
        d[d == 0] = 1
        return (a / np.sqrt(d)[:, None] / np.sqrt(d)[None, :]).astype(np.float32)


_BOARDS = {}


def load_all():
    if not _BOARDS:
        with open(MAPS_JSON, encoding="utf-8") as f:
            for raw in json.load(f)["maps"]:
                try:
                    _BOARDS[raw["id"]] = Board(raw)
                except Exception:  # a custom map the app would skip too
                    pass
    return _BOARDS


def get(map_id):
    return load_all()[map_id]


def official_ids():
    return sorted(k for k, b in load_all().items() if b.cols == 23 and b.rows == 14)
