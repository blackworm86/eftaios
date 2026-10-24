'use strict';
/* Anonymous records of finished games, so the bots can be tuned from real play.
   On by default; the player can turn it off (More tab and the start screen). A record holds roles, characters, routes, cards and the
   public announcements by seat number: no names, no account ids. An online table is recorded once, by the device that runs the bots,
   and leaves out every human who turned sharing off. Read only by the admin (database rules). */
const Records = (() => {
  const KEY = 'eftaios.share';
  const on = () => { try { return localStorage.getItem(KEY) !== 'off'; } catch (_) { return true; } };
  const set = v => { try { localStorage.setItem(KEY, v ? 'on' : 'off'); } catch (_) { /* noop */ } if (Sync.code && !S.hot) Sync.setMe({ share: !!v }); };
  /* the finished game as every seat's real data plus the public log (newest first), from pass and play or from an online table */
  function snapshot() {
    if (S.hot) return Hot.dump();
    const hd = (typeof Online !== 'undefined' && Online.dump && Online.dump()) || { bots: [] }, ps = Sync.players || {};
    const me = { id: Sync.uid, name: S.name, bot: null, role0: S.reborn ? 'human' : S.role, role: S.role, char: S.char || '', reborn: !!S.reborn, over: S.over || null, items: S.items, ab: S.ab, path: S.path, share: on() };
    const people = Object.entries(ps).filter(([u, p]) => u !== Sync.uid && !p.bot).map(([u, p]) => ({ id: u, name: p.name, bot: null, role0: p.conv ? 'human' : p.role, role: p.conv ? 'alien' : p.role, char: p.char || '', reborn: !!p.conv, over: p.out === 'killed' ? 'dead' : p.out || null, items: [], ab: null, path: decodeRoute(p.route), share: p.share !== false }));
    const bots = hd.bots.map(b => ({ id: b.id, name: b.name, bot: b.level, role0: b.reborn ? 'human' : b.role, role: b.role, char: b.char, reborn: b.reborn, over: b.over, items: b.items, ab: b.ab, path: b.path }));
    return { mode: S.mode, map: T.map && T.map.id, turn: S.turn, result: Sync.settings && Sync.settings.result, hatches: S.hatches, log: S.log, seats: [me, ...people, ...bots] };
  }
  /* the record: seats by number, announcements by seat number; a human who opted out is a bare seat and their announcements are left out */
  function build(g) {
    const idx = Object.fromEntries(g.seats.map((s, i) => [s.id, i])), out = new Set(g.seats.map((s, i) => (s.share === false ? i : -1)).filter(i => i >= 0));
    const seats = g.seats.map(s => s.share === false ? { kind: 'human', optout: 1 } : { kind: s.bot || 'human', role0: s.role0, role: s.role, char: s.char || '', over: s.over || null, items: s.items || [], ab: s.ab || {},
      route: (s.path || []).map(p => p.turn + ':' + p.pos + (p.note ? ':' + p.note[0] : '')).join(',') });
    const log = (g.log || []).slice().reverse().filter(e => e.kind !== 'info' && !out.has(idx[e.by])).map(e => ({ t: e.turn, s: idx[e.by] === undefined ? -1 : idx[e.by], k: e.kind, x: String(e.text || ''), c: e.sector || '', n: e.n || 0, ok: e.ok ? 1 : 0 }));
    const r = g.result, result = r && { aliensWin: !!r.aliensWin, reason: r.reason, escaped: (r.escaped || []).map(n => g.seats.findIndex(s => s.name === n || s.id === n)).filter(i => i >= 0) };   // who escaped, by seat number
    return { mode: g.mode, map: g.map, turns: g.turn, result: result || null, seats, log };
  }
  /* called whenever the game-over panel is drawn; sends at most once per game */
  function maybeSend() {
    if (!on() || !S.log || !S.log.length) return;
    const first = S.log[S.log.length - 1], key = (S.hot ? 'hot' : Sync.code) + ':' + (first && first.id);
    if (T.recKey === key) return; T.recKey = key;
    const go = () => { try { const g = snapshot(), rec = build(g); Sync.record({ v: 1, at: Date.now(), n: g.seats.length, mode: String(g.mode || ''), build: String(typeof loadedBuild === 'string' ? loadedBuild : '').slice(0, 40), game: JSON.stringify(rec) }).catch(() => { T.recKey = null; }); } catch (e) { console.warn(e); } };
    if (S.hot) return go();
    if (Sync.isHolder()) setTimeout(go, 6000);   // let every player's role and route arrive first
  }
  const note = () => `<p class="dim">${on() ? t('The anonymous result of this game is shared to improve the bots. You can turn this off in More.') : t('Sharing results is off: this game is not recorded.')}</p>`;
  return { on, set, snapshot, build, maybeSend, note };
})();
