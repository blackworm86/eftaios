'use strict';
/* Play one seat by hand against the bots, from the command line (for play-testing without a phone).
     node tools/play.js            # starts a server on :9911 holding one browser; needs node tools/serve.js on :8123
     curl 'localhost:9911/?c=new%20galilei%20hard,hard,hard,hard,hard'   # you are seat 1
   Commands: new <map> <bot levels>, state, near <sector> [k], move <sector>, end, use <item> [sector|player], say <sector>, power <name> [arg], log [n], result.
   `state` shows only what a player at that seat sees. */
const http = require('http');
const B = require('./browser');
(async () => {
  const { browser } = await B.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  await ctx.addInitScript(() => { window.__botPace = 0; });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8123/');
  const run = (c, a) => p.evaluate(async ([c, a]) => {
    const info = () => {
      const o = { turn: S.turn, role: S.role, char: S.char, pos: S.pos, type: at(T.map, S.pos), items: S.items, ab: S.ab || {}, phase: S.phase, res: S.res && S.res.stage, over: S.over, fed: S.fed, hatchesUsed: S.hatches, pick: !!T.pick };
      if (Hot.isOver()) o.result = Hot.result();
      return o;
    };
    const clearDlg = () => { try { closeDlg(); } catch (_) { /* noop */ } };
    if (c === 'new') {
      const [map, levels] = a; const bots = ['', ...levels.split(',')];
      await Hot.start(bots.map((_, i) => (i ? 'Bot ' + i : 'Me')), map, 'ultimate', 'auto', bots); clearDlg();
      return info();
    }
    if (c === 'state') {
      const o = info(); o.reach = [...T.reach.keys()].map(id => id + ':' + at(T.map, id)); o.openPods = mapHatches().filter(n => !S.hatches[n]).map(n => n + '@' + find(T.map, String(n)));
      o.others = Hot.publicPlayers(); return o;
    }
    if (c === 'near') {
      const [id, k] = a, seen = new Map([[id, 0]]), q = [id]; for (let i = 0; i < q.length; i++) { if (seen.get(q[i]) >= +(k || 2)) continue; const [cc, rr] = parseId(q[i]); neighbors(T.map, cc, rr).forEach(([x, y]) => { const n = cid(x, y); if (!seen.has(n) && at(T.map, n) !== 'x') { seen.set(n, seen.get(q[i]) + 1); q.push(n); } }); }
      return [...seen].map(([n, d]) => n + ':' + at(T.map, n) + ':' + d).join(' ');
    }
    if (c === 'dist') {   // Human walking distance from every sector in `a` (or from me) to the nearest open pod, for the sectors I can reach
      const pods = mapHatches().filter(n => !S.hatches[n]).map(n => find(T.map, String(n))), d = new Map(pods.map(x => [x, 0])), q = [...pods];
      for (let i = 0; i < q.length; i++) { const [cc, rr] = parseId(q[i]); neighbors(T.map, cc, rr).forEach(([x, y]) => { const n = cid(x, y), ty = at(T.map, n); if (ty === 'x' || ty === 'H' || ty === 'A' || '1234'.includes(ty) || d.has(n)) return; d.set(n, d.get(q[i]) + 1); q.push(n); }); }
      return [...T.reach.keys()].map(id => id + ':' + at(T.map, id) + ':' + (d.has(id) ? d.get(id) : ('1234'.includes(at(T.map, id)) ? 0 : '?'))).join(' ');
    }
    if (c === 'log') { const n = +(a[0] || 12); return S.log.slice(0, n).map(e => `T${e.turn} ${e.who} ${e.kind} ${e.text || ''} ${e.sector || ''}`).reverse(); }
    if (c === 'result') return Hot.result();
    if (c === 'move') { selectCell(a[0]); confirmMove(); const o = info(); if (S.res && S.res.stage === 'pod') { await digitalHatch(); } else if (at(T.map, S.pos) === 's') actions.quiet(); else if (at(T.map, S.pos) === '.') { if (a[1] === 'hold') return Object.assign(info(), { note: 'moved; announce with: draw' }); await drawSector(); } clearDlg(); return Object.assign(info(), { say: S.res && S.res.say, extra: S.res && S.res.extra }); }
    if (c === 'draw') { await drawSector(); clearDlg(); return Object.assign(info(), { say: S.res && S.res.say, extra: S.res && S.res.extra }); }
    if (c === 'say') { if (T.pick) { const cb = T.pick.cb; T.pick = null; await cb(a[0]); } clearDlg(); return Object.assign(info(), { say: S.res && S.res.say }); }
    if (c === 'use') { const [id, arg] = a; useItem(id); if (T.pick && arg) { const cb = T.pick.cb; T.pick = null; await cb(arg); } else if (arg && id === 'sensor') { await actions.__sensor; } clearDlg(); return info(); }
    if (c === 'power') { const f = { stay: 'stay', copilot: 'copilot', pilot: 'pilot', soldier: 'soldier', lurk: 'lurk' }[a[0]]; if (f) actions[f](); clearDlg(); return info(); }
    if (c === 'end') { clearDlg(); if (S.over && !S.outSent) { /* out of the game */ } await endTurn(); return info(); }
    return 'unknown command';
  }, [c, a]);
  http.createServer(async (rq, rs) => {
    const u = new URL(rq.url, 'http://x'), parts = (u.searchParams.get('c') || '').trim().split(/\s+/);
    try { rs.end(JSON.stringify(await run(parts[0], parts.slice(1)), null, 0) + (errs.length ? '\nERRORS ' + errs.join('|') : '') + '\n'); } catch (e) { rs.end('ERROR ' + e.message + '\n'); }
  }).listen(9911, () => console.log('ready on :9911'));
})();
