'use strict';
/* Bots for pass and play.
   A bot knows only what a player at the table knows: its own role, route and items, the public seat list
   and the public announcements in the log. It is handed only a public view of the table (seat names, the log,
   the turn, the rules), so it cannot read another seat's private state.
   From the log it estimates, for every other player, how likely they are to be an Alien and where they
   could be now, and plays by the same rules as everyone else (including bluffing with "noise in any sector"). */
const Bot = (() => {
  const LEVELS = ['easy', 'normal', 'hard'];
  const rnd = () => deckRnd();
  const pick = a => a[Math.floor(rnd() * a.length)];
  const isHatch = id => '1234'.includes(at(T.map, id));
  const PUBLIC_POS = ['noise', 'attack', 'reveal', 'hatch'];

  /* steps between sectors for a role (start sectors and closed hatches are walls), unlimited range */
  function distFrom(from, role) {
    const map = T.map, d = new Map([[from, 0]]), q = [from];
    while (q.length) {
      const id = q.shift(), k = d.get(id), [c, r] = parseId(id);
      for (const [a, b] of neighbors(map, c, r)) {
        const n = cid(a, b), ty = map.grid[b][a];
        if (d.has(n) || ty === 'x' || ty === 'H' || ty === 'A') continue;
        if ('1234'.includes(ty)) { if (role === 'human' && hatchOpen(+ty)) d.set(n, k + 1); continue; }
        d.set(n, k + 1); q.push(n);
      }
    }
    return d;
  }
  const openHatches = () => mapHatches().filter(n => hatchOpen(n)).map(n => find(T.map, String(n))).filter(Boolean);
  const hatchDist = (id, role = 'human') => { const d = distFrom(id, role); return Math.min(99, ...openHatches().map(h => d.has(h) ? d.get(h) : 99)); };

  /* ---------- what the bot believes about everyone else (public information only) ---------- */
  function beliefs(H, me, lvl = 'normal') {
    const others = H.seats.filter(s => s.id !== me.id), n = H.seats.length;
    const aliens = n - Math.floor(n / 2), alienLeft = aliens - (me.state.role === 'alien' ? 1 : 0);
    const prior = others.length ? Math.max(0.05, Math.min(0.95, alienLeft / others.length)) : 0.5;
    const B = {};
    others.forEach(s => { B[s.id] = { id: s.id, name: s.name, pA: prior, track: [], fed: false, out: false }; });
    const bump = (b, w) => { b.pA = 1 - (1 - b.pA) * (1 - w); };          // evidence for Alien
    const ease = (b, w) => { b.pA = b.pA * (1 - w); };                     // evidence for Human
    const log = H.log.slice().reverse();                                    // oldest first
    log.forEach((e, i) => {
      const b = B[e.by]; if (!b) return;
      if (PUBLIC_POS.includes(e.kind) && e.sector) { b.track.push({ turn: e.turn, sector: e.sector, kind: e.kind }); b.quiet = null; }
      if (e.kind === 'silence' && e.text === 'secure') b.quiet = e.turn;      // "Silent Sector": they stand on a Secure sector
      if (e.kind === 'item') ease(b, 0.97);                                 // only Humans can play items
      if (e.kind === 'hatch') ease(b, 0.99);
      if (e.kind === 'attack') {
        const armed = log.slice(Math.max(0, i - 3), i).some(x => x.by === e.by && x.kind === 'item' && x.text === 'attack' && x.turn === e.turn);
        if (!armed) { b.pA = 0.99; if (log.slice(i + 1, i + 6).some(x => x.kind === 'out' && x.turn === e.turn && String(x.text).startsWith('killed|human'))) b.fed = true; }
      }
      if (e.kind === 'out') {
        const [why, role] = String(e.text).split('|');
        if (H.mode === 'infection' && why === 'killed' && role === 'human') b.pA = 1;   // became an Alien and plays on
        else { b.out = true; b.pA = role === 'alien' ? 1 : 0; }
      }
    });
    // movement: a jump longer than a Human can make (1 per turn, 2 once with Adrenaline) points to an Alien.
    // Announcements can be bluffs, so a single long jump is only evidence, not proof.
    // Humans also head for a hatch: a trail that keeps closing in on one is a Human's, one that wanders or retreats is not.
    if (lvl !== 'easy') Object.values(B).forEach(b => {
      for (let k = 1; k < b.track.length; k++) {
        const a = b.track[k - 1], c = b.track[k], el = c.turn - a.turn; if (el <= 0) continue;
        const steps = distFrom(a.sector, 'alien').get(c.sector); if (steps === undefined) continue;
        if (steps > el + 1) bump(b, 0.6); else if (steps > el) bump(b, 0.3);
        else if (steps > 0 && openHatches().length) {
          const gain = hatchDist(a.sector) - hatchDist(c.sector);
          if (gain >= steps) ease(b, lvl === 'hard' ? 0.18 : 0.1); else if (gain < 0) bump(b, lvl === 'hard' ? 0.12 : 0.06);
        }
      }
    });
    return B;
  }
  /* sectors a player could be in now, from their last known position */
  function zoneOf(b, turn, wide) {
    const last = b.track[b.track.length - 1]; if (!last || b.out) return null;
    const alien = wide ? b.pA > 0.2 : b.pA >= 0.5, speed = alien ? (b.fed ? 3 : 2) : 1;
    const steps = Math.min(Math.max(0, turn - last.turn) * speed, 30);
    const z = steps ? reachable(T.map, last.sector, steps, alien ? 'alien' : 'human') : new Map();
    z.set(last.sector, 0);
    // after a "Silent Sector" declaration, only the Secure sectors they could have reached then, spread out since
    if (b.quiet != null && b.quiet >= last.turn) {
      const then = reachable(T.map, last.sector, Math.min(Math.max(0, b.quiet - last.turn) * speed, 30), alien ? 'alien' : 'human');
      const secure = [...then.keys()].filter(id => at(T.map, id) === 's');
      if (secure.length) {
        const out = new Map(), more = Math.min(Math.max(0, turn - b.quiet) * speed, 30);
        secure.forEach(s => { out.set(s, 0); if (more) reachable(T.map, s, more, alien ? 'alien' : 'human').forEach((_, id) => out.set(id, 0)); });
        return out;
      }
    }
    return z;
  }
  /* how much an announcement is worth: players bluff with "noise in any sector" */
  const REL = { easy: 0.92, normal: 0.78, hard: 0.62 };
  const walkable = () => { const out = []; T.map.grid.forEach((row, r) => row.forEach((ty, c) => { if (!'xHA'.includes(ty)) out.push(cid(c, r)); })); return out; };
  /* chance per sector that a Human (or an Alien) is standing there: each player's reachable zone from their last
     announcement, softened by the chance that the announcement was a bluff, combined across players */
  function massMap(B, turn, wantAlien, wide, lvl = 'normal') {
    const rel = REL[lvl] || REL.normal, all = walkable(), spread = all.length ? (1 - rel) / all.length : 0, miss = new Map();
    Object.values(B).forEach(b => {
      const z = zoneOf(b, turn, wide); if (!z) return;
      const p = wantAlien ? b.pA : 1 - b.pA, seen = rel / z.size;
      all.forEach(id => { const w = p * ((z.has(id) ? seen : 0) + spread); if (w > 0) miss.set(id, (miss.get(id) || 1) * (1 - Math.min(0.98, w))); });
    });
    const m = new Map(); miss.forEach((v, id) => m.set(id, 1 - v));
    return m;
  }
  const near = (m, id) => { const [c, r] = parseId(id); return Math.min(1.5, (m.get(id) || 0) + neighbors(T.map, c, r).reduce((s, [a, b]) => s + (m.get(cid(a, b)) || 0), 0)); };

  /* the sectors a Human must stand on right before stepping into a hatch */
  function approaches(h) {
    const [c, r] = parseId(h);
    return neighbors(T.map, c, r).map(([a, b]) => cid(a, b)).filter(id => !'xHA1234'.includes(at(T.map, id)));
  }
  /* how well a post covers the hatch approaches: an Alien reaches 2 sectors (3 once fed), so standing on or next to
     an approach cell lets it strike whoever comes through. Each bot favours "its" hatch so Aliens spread out. */
  function campValue(d, hatches, mine, reach) {
    let tot = 0, wsum = 0;
    hatches.forEach(h => {
      const w = h === mine ? 2.2 : 1; wsum += w;
      const ring = approaches(h); if (!ring.length) return;
      let cover = 0;
      ring.forEach(c => { const k = d.get(c); cover += k === undefined ? 0 : k === 0 ? 1 : k === 1 ? 0.85 : k <= reach ? 0.5 : 0; });
      tot += w * cover / ring.length;
    });
    return wsum ? tot / wsum : 0;
  }
  const hashId = id => { let x = 7; for (const ch of String(id)) x = (x * 31 + ch.charCodeAt(0)) >>> 0; return x; };

  /* ---------- choices ---------- */
  function chooseMove(ctx, st, lvl, B) {
    const opts = [...reachable(T.map, st.pos, st.role === 'alien' ? (st.fed ? 3 : 2) : (st.adr ? 2 : 1), st.role).keys()];
    if (!opts.length) return null;
    const turn = ctx.H.turn, score = new Map(), tie = () => rnd() * 0.5;
    if (st.role === 'human') {
      const danger = massMap(B, turn + 1, true, lvl === 'hard', lvl), W = lvl === 'hard' ? 26 : lvl === 'normal' ? 16 : 8;
      const hatches = openHatches(), hd = new Map(hatches.map(h => [h, distFrom(h, 'human')]));
      opts.forEach(id => {
        if (isHatch(id)) return score.set(id, 1000);
        // the route that matters: shortest way to a hatch, discounted for hatches that Aliens are likely to be guarding
        let route = 99;
        hatches.forEach(h => { const d = hd.get(h).get(id); if (d !== undefined) route = Math.min(route, d + (lvl === 'easy' ? 0 : near(danger, h) * 7)); });
        let s = -route * 10 - near(danger, id) * W;
        if (at(T.map, id) === 's') s += lvl === 'hard' ? 6 : lvl === 'normal' ? 3 : 1;   // Secure sectors make no noise
        score.set(id, s + tie());
      });
    } else {
      const prey = massMap(B, turn, false, lvl === 'hard', lvl);
      const hot = [...prey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).filter(x => x[1] > 0.04).map(x => x[0]);
      const late = turn >= 14 ? 1.6 : 1, reach = st.fed ? 3 : 2, hs = openHatches(), mine = hs.length ? hs[hashId(ctx.me.id) % hs.length] : null;
      // little or no news about the Humans: camp the approaches to the hatches instead of wandering
      const trail = hot.length ? (prey.get(hot[0]) || 0) : 0, camp = (lvl === 'easy' ? 14 : lvl === 'normal' ? 26 : 38) * (trail > 0.2 ? 0.5 : 1) * (turn >= 8 ? 1.4 : 1) * late;
      opts.forEach(id => {
        let s = (prey.get(id) || 0) * 120 + near(prey, id) * (lvl === 'easy' ? 15 : 25);
        if (hot.length) { const d = distFrom(id, 'alien'); s -= Math.min(...hot.map(h => d.has(h) ? d.get(h) : 40)) * 4; }
        // humans must end up on a hatch: sit between them and it, harder as the game wears on
        const dd = distFrom(id, 'alien');
        s += campValue(dd, hs, mine, reach) * camp;
        if (lvl === 'hard' && !hot.length) s -= Math.min(20, hatchDist(id, 'alien')) * 2;
        score.set(id, s + tie());
      });
    }
    return opts.sort((a, b) => score.get(b) - score.get(a))[0];
  }
  /* "noise in any sector": the bot picks a misleading sector */
  function chooseBluff(ctx, st, lvl, me) {
    const d = distFrom(st.pos, 'alien'), ring = [...d.entries()].filter(([id, k]) => k >= 2 && k <= 5 && !isHatch(id)).map(x => x[0]);
    if (!ring.length) return st.pos;
    if (lvl !== 'hard') return pick(ring);
    const mine = ctx.H.log.find(e => e.by === me.id && e.sector && PUBLIC_POS.includes(e.kind));
    const plausible = mine ? ring.filter(id => { const k = distFrom(mine.sector, 'alien').get(id); return k !== undefined && k <= Math.max(1, ctx.H.turn - mine.turn); }) : ring;
    const pool = plausible.length ? plausible : ring;
    // a Human sends attention away from the hatches; an Alien pretends to be a Human heading for one
    return pool.sort((a, b) => st.role === 'human' ? hatchDist(b) - hatchDist(a) : hatchDist(a) - hatchDist(b))[Math.floor(rnd() * Math.min(3, pool.length))];
  }
  /* an attack gives away the sector, so it is only worth it when a Human is probably standing in it */
  function wantsAttack(ctx, st, lvl, B) {
    const turn = ctx.H.turn, here = st.pos;
    const prey = massMap(B, turn, false, false, lvl).get(here) || 0, friends = massMap(B, turn, true, false, lvl).get(here) || 0;
    let need = lvl === 'easy' ? 0.45 : lvl === 'normal' ? 0.3 : 0.2;
    if (lvl !== 'easy' && turn >= 8 && openHatches().some(h => approaches(h).includes(here))) need -= lvl === 'hard' ? 0.12 : 0.06;   // Humans have to come through here
    if (ctx.H.mode === 'infection') return prey >= need;
    return prey >= need && (lvl === 'easy' || prey >= friends * 0.6);
  }
  const ITEM_VALUE = { defense: 6, adrenaline: 4, spotlight: 4, attack: 3, sedatives: 3, teleport: 1 };

  /* ---------- one full turn ---------- */
  async function turn(ctx) {
    const H = ctx.H, idx = ctx.idx, me = ctx.me, st = me.state, lvl = LEVELS.includes(me.bot) ? me.bot : 'normal';
    const adv = H.mode !== 'basic', B = beliefs(H, me, lvl), human = st.role === 'human';
    const say = e => ctx.log(Object.assign({ by: me.id, who: me.name }, e));
    const useItem = id => { const i = st.items.indexOf(id); if (i < 0) return false; st.items.splice(i, 1); ctx.discard(id); say({ kind: 'item', text: id }); return true; };
    const danger = human ? near(massMap(B, H.turn + 1, true, lvl === 'hard', lvl), st.pos) : 0;
    st.adr = false;
    if (human && !openHatches().length) { st.over = 'trapped'; st.outSent = true; ctx.out(idx, 'trapped'); return; }
    // before moving: Adrenaline when far from a hatch and threatened
    if (human && adv && lvl !== 'easy' && st.items.includes('adrenaline') && hatchDist(st.pos) > 2 && (danger > 0.15 || lvl === 'hard' && rnd() < 0.4)) { if (useItem('adrenaline')) st.adr = true; }
    // Spotlight on the most uncertain nearby player
    if (human && adv && lvl !== 'easy' && st.items.includes('spotlight')) {
      const cand = Object.values(B).map(b => ({ b, z: zoneOf(b, H.turn, false) })).filter(x => x.z && x.z.size <= 7 && x.b.pA > 0.25 && x.b.pA < 0.85);
      if (cand.length && (lvl === 'hard' || rnd() < 0.5)) { const c = cand[0], ids = [...c.z.keys()]; useItem('spotlight'); await ctx.spotlight(ids[Math.floor(ids.length / 2)]); }
    }
    const dest = chooseMove(ctx, st, lvl, B);
    if (dest) { st.pos = dest; st.path.push({ turn: H.turn, pos: dest }); }
    st.adr = false;
    const ty = at(T.map, st.pos);
    // escape hatch
    if (human && '1234'.includes(ty)) {
      const n = +ty;
      if (!adv || H.mode === 'infection' || ctx.draw('hatch') === 'green') { ctx.closeHatch(n); say({ kind: 'hatch', sector: st.pos, n, ok: 1 }); st.over = 'escaped'; st.outSent = true; ctx.out(idx, 'escaped'); return; }
      ctx.closeHatch(n); say({ kind: 'hatch', sector: st.pos, n, ok: 0 });
      return;
    }
    // Alien attack, or a Human with an Attack card on a likely Alien
    if (!human && wantsAttack(ctx, st, lvl, B)) { say({ kind: 'attack', sector: st.pos }); if ((await ctx.attack(st.pos)).some(h => h.killed && h.role === 'human') && H.mode !== 'infection') st.fed = true; return; }
    if (human && adv && lvl === 'hard' && st.items.includes('attack') && (massMap(B, H.turn, true, false, lvl).get(st.pos) || 0) > 0.45 && (massMap(B, H.turn, false, false, lvl).get(st.pos) || 0) < 0.2) { useItem('attack'); say({ kind: 'attack', sector: st.pos }); await ctx.attack(st.pos); return; }
    if (ty !== '.') { say({ kind: 'silence', text: 'secure' }); return; }  // Secure sector: declare "Silent Sector"
    if (human && adv && st.items.includes('sedatives') && lvl !== 'easy' && (danger > 0.2 || lvl === 'hard' && rnd() < 0.3)) { useItem('sedatives'); return; }
    const card = ctx.draw('sector') || 'silence', item = card.endsWith('-item') && adv;
    if (card.startsWith('noise-self')) say({ kind: 'noise', sector: st.pos });
    else if (card.startsWith('noise-any')) say({ kind: 'noise', sector: chooseBluff(ctx, st, lvl, me) });
    else say({ kind: 'silence' });
    if (item) {
      const c = ctx.draw('item');
      if (c) { st.items.push(c); if (st.items.length > 3) { st.items.sort((a, b) => ITEM_VALUE[b] - ITEM_VALUE[a]); ctx.discard(st.items.pop()); } }
    }
  }
  return { turn, beliefs, zoneOf, LEVELS };
})();
window.Bot = Bot;
