'use strict';
/* One Chrome per process, driven over CDP.
   Playwright's default transport uses a named pipe, which the Windows sandbox denies.
   Chrome is started with --remote-debugging-port and Playwright connects over HTTP/WebSocket. */
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const pw = require('playwright-core');

const CHROME = process.env.PW_CHROME || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
let seq = 0;

function freePort() { return 9400 + (process.pid % 500) + (seq++ % 20); }

async function waitJson(url, ms = 20000) {
  const end = Date.now() + ms;
  let last;
  while (Date.now() < end) {
    try { const r = await fetch(url); if (r.ok) return await r.json(); } catch (e) { last = e; }
    await new Promise(r => setTimeout(r, 150));
  }
  throw new Error('Chrome did not answer on ' + url + (last ? ' (' + last.message + ')' : ''));
}

/* launch(): same surface as playwright's chromium.launch, but returns {browser, close, port} */
async function launch(opts = {}) {
  const port = opts.port || freePort();
  const userDataDir = opts.userDataDir || fs.mkdtempSync(path.join(os.tmpdir(), 'eftaios-chrome-'));
  const args = [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-extensions', '--disable-sync',
    '--mute-audio', '--hide-scrollbars', '--no-sandbox',
    '--disable-crash-reporter', '--disable-breakpad',
    ...(process.env.PW_SINGLE_PROCESS ? ['--single-process', '--in-process-gpu'] : []),
    '--user-data-dir=' + userDataDir,
    '--remote-debugging-port=' + port,
    'about:blank'
  ];
  const child = spawn(CHROME, args, { stdio: 'ignore', windowsHide: true });
  const closed = new Promise(r => child.once('exit', r));
  try {
    await waitJson('http://127.0.0.1:' + port + '/json/version');
    const browser = await pw.chromium.connectOverCDP('http://127.0.0.1:' + port);
    return {
      browser, port, child,
      async close() {
        try { await browser.close(); } catch (e) { /* already gone */ }
        try { child.kill(); } catch (e) { /* already gone */ }
        // Chrome keeps renderer children after the parent dies; take the tree down.
        if (process.platform === 'win32') {
          try { spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true }); } catch (e) { /* ignore */ }
        }
        await Promise.race([closed, new Promise(r => setTimeout(r, 2000))]);
      }
    };
  } catch (e) {
    try { child.kill(); } catch (e2) { /* ignore */ }
    throw e;
  }
}

module.exports = { launch, chromium: pw.chromium };
