// Test-only: in-memory Firebase stand-in shared between tabs of one browser context (localStorage + storage events).
window.__FAKE_FB = async () => {
  const KEY = 'fakefb', uid = sessionStorage.fakeuid || (sessionStorage.fakeuid = 'u' + Math.random().toString(36).slice(2, 8));
  const load = () => JSON.parse(localStorage.getItem(KEY) || '{}'), saveT = t => localStorage.setItem(KEY, JSON.stringify(t));
  const seg = p => p.split('/').filter(Boolean);
  const getAt = (t, p) => seg(p).reduce((o, k) => (o == null ? undefined : o[k]), t);
  const setAt = (t, p, v) => { const s = seg(p); let o = t; s.slice(0, -1).forEach(k => o = (o[k] = o[k] && typeof o[k] === 'object' ? o[k] : {})); if (v === null || v === undefined) delete o[s.at(-1)]; else o[s.at(-1)] = v; };
  const snap = (v, key) => ({ key, val: () => (v === undefined ? null : JSON.parse(JSON.stringify(v))), exists: () => v !== undefined && v !== null });
  const ls = [];
  const fire = () => { const t = load(); ls.forEach(l => l.check(t)); };
  window.addEventListener('storage', e => { if (e.key === KEY) fire(); });
  /* shortcut: localStorage reaches other tabs a few ms late, so a tab taking the lock right after another's write could read the
     old tree and undo it; holding the lock 40 ms after each write lets it arrive. Raise it if lost writes come back under heavy load. */
  const locked = fn => navigator.locks.request('fakefb', async () => { fn(); setTimeout(fire, 0); await new Promise(r => setTimeout(r, 40)); });
  const write = (p, v) => locked(() => { const t = load(); setAt(t, p, v); saveT(t); });
  const fb = {
    ref: (db, path) => ({ path }), query: r => r, limitToLast: () => null, orderByChild: () => null, serverTimestamp: () => Date.now(),
    get: async r => snap(getAt(load(), r.path)),
    set: async (r, v) => write(r.path, v),
    update: async (r, o) => locked(() => { const t = load(); for (const k in o) setAt(t, r.path + '/' + k, o[k]); saveT(t); }),
    remove: async r => write(r.path, null),
    runTransaction: async (r, fn) => { const cur = getAt(load(), r.path); await write(r.path, fn(cur === undefined ? null : cur)); },   // like the modular SDK: the plain value in, the new value out
    onValue(r, cb) {
      if (r.path === '.info/connected') { setTimeout(() => cb(snap(true)), 0); return () => {}; }
      let last = JSON.stringify(getAt(load(), r.path)); const l = { check: t => { const j = JSON.stringify(getAt(t, r.path)); if (j !== last) { last = j; cb(snap(getAt(t, r.path))); } } };
      ls.push(l); setTimeout(() => cb(snap(getAt(load(), r.path))), 0); return () => ls.splice(ls.indexOf(l), 1);
    },
    onChildAdded(r, cb) {
      const seen = new Set(); const l = { check: t => { const o = getAt(t, r.path) || {}; for (const k in o) if (!seen.has(k)) { seen.add(k); cb(snap(o[k], k)); } } };
      ls.push(l); setTimeout(() => l.check(load()), 0); return () => ls.splice(ls.indexOf(l), 1);
    }
  };
  return { fb, db: {}, uid };
};
