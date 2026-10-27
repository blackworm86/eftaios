"""Actor-critic graph network over the hex board.

Every walkable sector is a node; messages pass along the board's adjacency. The actor sees the public observation only;
the critic (value head) additionally gets `priv`, the truth about the others, which exists during training only.
"""
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F

from . import env as env_mod
from . import maps as maps_mod

NEG = -1e9


class Net(nn.Module):
    def __init__(self, hid=64, layers=4):
        super().__init__()
        self.hid, self.nlayers = hid, layers
        self.inp = nn.Linear(env_mod.D_STAT + env_mod.D_DYN, hid)
        self.gproj = nn.Linear(env_mod.G_DIM, hid)
        self.phase_emb = nn.Embedding(7, hid)
        self.lins = nn.ModuleList([nn.Linear(hid, hid) for _ in range(layers)])
        self.norms = nn.ModuleList([nn.LayerNorm(hid) for _ in range(layers)])
        # whole-board attention: every sector looks at every other sector (the graph layers only pass information along the 6 neighbours, one step per layer)
        self.attn = nn.ModuleList([nn.MultiheadAttention(hid, 4, batch_first=True) for _ in range(2)])
        self.attn_norm = nn.ModuleList([nn.LayerNorm(hid) for _ in range(2)])
        self.pool = nn.Linear(2 * hid, hid)
        self.move_head = nn.Linear(2 * hid, 1)
        self.decoy_head = nn.Linear(2 * hid, 1)
        self.attack_head = nn.Sequential(nn.Linear(3 * hid, hid), nn.ReLU(), nn.Linear(hid, 2))
        self.act_head = nn.Sequential(nn.Linear(3 * hid, hid), nn.ReLU(), nn.Linear(hid, 12))     # Items and powers: engine.N_ACTS
        self.seat_head = nn.Sequential(nn.Linear(3 * hid, hid), nn.ReLU(), nn.Linear(hid, 7))     # Sensor / Medic: which of the other seats
        self.target_head = nn.Linear(2 * hid, 1)                                                  # Spotlight: which sector
        self.value_head = nn.Sequential(nn.Linear(2 * hid + env_mod.P_DIM, hid), nn.ReLU(), nn.Linear(hid, 1))

    def forward(self, dyn, stat, adj, glob, priv, phase, me, mask):
        """dyn (B, D_DYN, N) in [0,1]; stat (D_STAT, N); adj (N, N); glob (B, G); priv (B, P); phase (B,) long; me (B,) long;
        mask (B, N) bool (attack decisions use the first two entries). Returns logits (B, N) and value (B,)."""
        B, _, N = dyn.shape
        x = torch.cat([dyn, stat.unsqueeze(0).expand(B, -1, -1)], 1).transpose(1, 2)  # (B, N, F)
        g = self.gproj(glob) + self.phase_emb(phase)  # (B, hid)
        h = F.relu(self.inp(x) + g.unsqueeze(1))
        walk = (1.0 - stat[0]).view(1, N, 1)  # row 0 of stat is 'wall'
        wall = (stat[0] > 0).unsqueeze(0).expand(B, -1)  # (B, N) True where there is no sector
        for k, (lin, norm) in enumerate(zip(self.lins, self.norms)):
            h = h + F.relu(norm(torch.matmul(adj, lin(h)))) * walk
            if k == self.nlayers // 2 - 1 or k == self.nlayers - 1:  # one look at the whole board halfway and one at the end
                i = 0 if k < self.nlayers - 1 else 1
                a, _ = self.attn[i](h, h, h, key_padding_mask=wall, need_weights=False)
                h = h + self.attn_norm[i](a) * walk
        pooled = (h * walk).sum(1) / walk.sum()
        hmax = (h * walk + (walk - 1) * 1e4).max(1).values
        gemb = F.relu(self.pool(torch.cat([pooled, hmax], 1)))  # (B, hid)
        ge = gemb.unsqueeze(1).expand(-1, N, -1)
        nodes = torch.cat([h, ge], 2)
        move = self.move_head(nodes).squeeze(-1)
        decoy = self.decoy_head(nodes).squeeze(-1)
        h_me = h[torch.arange(B, device=h.device), me]
        att = self.attack_head(torch.cat([gemb, h_me, g], 1))  # (B, 2)
        small = torch.cat([gemb, h_me, g], 1)
        att_full = torch.full_like(move, NEG)
        att_full[:, :2] = att
        act_full = torch.full_like(move, NEG)
        act_full[:, :12] = self.act_head(small)
        seat_full = torch.full_like(move, NEG)
        seat_full[:, :7] = self.seat_head(small)
        ph = phase.unsqueeze(1)
        logits = torch.where(ph == 2, decoy, move)
        logits = torch.where(ph == 5, self.target_head(nodes).squeeze(-1), logits)
        logits = torch.where(ph == 1, att_full, logits)
        logits = torch.where((ph == 3) | (ph == 4), act_full, logits)
        logits = torch.where(ph == 6, seat_full, logits)
        logits = logits.masked_fill(~mask, NEG)
        value = self.value_head(torch.cat([gemb, h_me, priv], 1)).squeeze(-1)
        return logits, value


class BoardCache:
    """Static channels and adjacency per map, as tensors on a device."""

    def __init__(self, device):
        self.device, self.cache = device, {}

    def get(self, map_id):
        if map_id not in self.cache:
            b = maps_mod.get(map_id)
            self.cache[map_id] = (torch.from_numpy(env_mod.static_channels(b)).to(self.device), torch.from_numpy(b.adjacency()).to(self.device))
        return self.cache[map_id]


def pack(obs_list, device, N=322):
    """Stack observations from the same map into tensors."""
    dyn = torch.from_numpy(np.stack([o["dyn"] for o in obs_list])).to(device).float() / 255.0
    glob = torch.from_numpy(np.stack([o["glob"] for o in obs_list])).to(device)
    priv = torch.from_numpy(np.stack([o["priv"] for o in obs_list])).to(device)
    phase = torch.tensor([o["phase"] for o in obs_list], dtype=torch.long, device=device)
    me = torch.tensor([o["me"] for o in obs_list], dtype=torch.long, device=device)
    mask = torch.zeros(len(obs_list), N, dtype=torch.bool, device=device)
    for i, o in enumerate(obs_list):
        m = o["mask"]
        mask[i, :len(m)] = torch.from_numpy(np.asarray(m))
    return dyn, glob, priv, phase, me, mask
