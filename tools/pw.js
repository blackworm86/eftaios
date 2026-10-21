'use strict';
/* Playwright entry point for this machine: Chrome is started over CDP by tools/browser.js. */
const B = require('./browser');

async function launch() {
  const raw = await B.launch();
  const browser = raw.browser;
  return new Proxy(browser, {
    get(target, prop) {
      if (prop === 'close') return () => raw.close();
      if (prop === '__raw') return raw;
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    }
  });
}

module.exports = { chromium: { launch } };
