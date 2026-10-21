'use strict';
/* Minimal static file server for the app and the simulator. Replaces `python3 -m http.server 8123`.
   Usage: node tools/serve.js [port]   (default 8123) */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.map': 'application/json'
};

function start(port = 8123) {
  const server = http.createServer((req, res) => {
    let url;
    try { url = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch (e) { res.writeHead(400); return res.end('bad request'); }
    if (url.endsWith('/')) url += 'index.html';
    const file = path.resolve(ROOT, '.' + url);
    if (!file.startsWith(ROOT + path.sep) && file !== ROOT) { res.writeHead(403); return res.end('forbidden'); }
    fs.stat(file, (err, st) => {
      if (err || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
        'Content-Length': st.size
      });
      fs.createReadStream(file).pipe(res);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { start, ROOT };

if (require.main === module) {
  const port = +process.argv[2] || 8123;
  start(port).then(() => console.log('serving ' + ROOT + ' on http://127.0.0.1:' + port))
    .catch(e => { console.error(e); process.exit(1); });
}
