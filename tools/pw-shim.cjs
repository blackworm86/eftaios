'use strict';
/* Lets the existing tests keep `require('/opt/node22/lib/node_modules/playwright')`:
   node -r ./tools/pw-shim.cjs tests/foo.test.js */
const Module = require('module');
const path = require('path');
const target = path.join(__dirname, 'pw.js');
const orig = Module._resolveFilename;
Module._resolveFilename = function (request, ...rest) {
  if (request === '/opt/node22/lib/node_modules/playwright' || request === 'playwright') return target;
  return orig.call(this, request, ...rest);
};
