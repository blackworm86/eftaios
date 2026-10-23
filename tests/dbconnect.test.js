// A phone that slept or changed network mid-connection leaves Firebase's "websocket failed" mark in storage; from then on
// the database SDK starts with long polling. The app must clear that mark at start, and the page must allow long polling,
// or the database never connects (sign-in works, the profile hangs on "Loading"). Static server on :8123.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const assert = (c, m) => { if (!c) { console.error('FAIL', m); process.exitCode = 1; } else console.log('ok  ', m); };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ serviceWorkers: 'block' });
  await ctx.addInitScript(() => { if (!sessionStorage.__seeded) { localStorage.setItem('firebase:previous_websocket_failure', 'true'); sessionStorage.setItem('firebase:previous_websocket_failure', 'true'); sessionStorage.__seeded = 1; } });
  const p = await ctx.newPage(); const csp = [];
  p.on('console', m => { if (/Content Security Policy/.test(m.text()) && /firebasedatabase|firebaseio/.test(m.text())) csp.push(m.text()); });
  await p.goto('http://localhost:8123/'); await p.waitForTimeout(600);
  const mark = await p.evaluate(() => [localStorage.getItem('firebase:previous_websocket_failure'), sessionStorage.getItem('firebase:previous_websocket_failure')]);
  assert(mark[0] === null && mark[1] === null, 'a stale "websocket failed" mark is cleared at start');
  await p.evaluate(() => { const s = document.createElement('script'); s.src = 'https://eftaios-default-rtdb.europe-west1.firebasedatabase.app/.lp?start=t'; document.body.appendChild(s); });
  await p.waitForTimeout(600);
  assert(csp.length === 0, 'the page allows the database\'s long-polling fallback');
  await b.close();
})().catch(e => { console.error('FAIL', e.message); process.exitCode = 1; });
