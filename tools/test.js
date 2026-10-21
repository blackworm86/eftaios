'use strict';
/* Runs the browser test suite on Windows.
   The tests still say require('/opt/node22/lib/node_modules/playwright'); the -r shim maps that to tools/pw.js.
   Usage: node tools/test.js [nameFilter] */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8123;
const TIMEOUT = +(process.env.TEST_TIMEOUT || 240000);
const only = process.argv[2] || '';

async function up() {
  try { const r = await fetch('http://127.0.0.1:' + PORT + '/'); return r.ok; } catch (e) { return false; }
}
async function waitUp(ms = 15000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (await up()) return true; await new Promise(r => setTimeout(r, 150)); }
  return false;
}
// A timed-out test can leave its headless Chrome behind; those processes then starve the next tests.
function cleanupChrome() {
  if (process.platform !== 'win32') return;
  const ps = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -like '*eftaios-chrome-*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
  try { spawnSync('powershell.exe', ['-NoProfile', '-Command', ps], { stdio: 'ignore', windowsHide: true, timeout: 20000 }); } catch (e) { /* ignore */ }
}
function run(file) {
  return new Promise(resolve => {
    const t0 = Date.now();
    const c = spawn(process.execPath, ['-r', path.join(__dirname, 'pw-shim.cjs'), file], {
      cwd: ROOT, stdio: 'inherit', windowsHide: true,
      env: Object.assign({}, process.env)
    });
    const timer = setTimeout(() => {
      if (process.platform === 'win32') { try { spawn('taskkill', ['/PID', String(c.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { /* ignore */ } }
      else { try { c.kill('SIGKILL'); } catch (e) { /* ignore */ } }
      c.__timedOut = true;
    }, TIMEOUT);
    c.on('exit', code => { clearTimeout(timer); resolve({ code: c.__timedOut ? 'TIMEOUT' : code, ms: Date.now() - t0 }); });
  });
}

(async () => {
  cleanupChrome();
  let server = null;
  if (!(await up())) {
    server = spawn(process.execPath, [path.join(__dirname, 'serve.js'), String(PORT)], { cwd: ROOT, stdio: 'ignore', windowsHide: true });
    if (!(await waitUp())) { console.error('server did not start on :' + PORT); process.exit(1); }
  }
  const files = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.test.js') && f.includes(only)).sort();
  const rows = [];
  for (const f of files) {
    console.log('\n=== ' + f + ' ===');
    const r = await run(path.join('tests', f));
    rows.push({ test: f, result: r.code === 0 ? 'pass' : String(r.code), seconds: (r.ms / 1000).toFixed(1) });
    if (r.code !== 0) cleanupChrome();
    console.log('--- ' + f + ': ' + (r.code === 0 ? 'pass' : r.code) + ' (' + (r.ms / 1000).toFixed(1) + 's)');
  }
  console.log('\n=== summary ===');
  for (const r of rows) console.log(r.result === 'pass' ? 'ok   ' : 'FAIL ', r.test.padEnd(28), r.result, r.seconds + 's');
  const bad = rows.filter(r => r.result !== 'pass');
  console.log('\n' + (rows.length - bad.length) + '/' + rows.length + ' passed' + (bad.length ? ', failing: ' + bad.map(b => b.test + ' (' + b.result + ')').join(', ') : ''));
  if (server) { try { server.kill(); } catch (e) { /* ignore */ } }
  process.exitCode = bad.length ? 1 : 0;
})().catch(e => { console.error(e); process.exit(1); });
