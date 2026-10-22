'use strict';
/* Screens and overflow metrics for the account/admin/games/map screens at four sizes. */
const B = require('./browser');
const fs = require('fs');
const path = require('path');
const OUT = path.join(process.env.TEMP || '.', 'eftaios-ui');
const URL = 'http://localhost:8123/';
const SIZES = [[360, 640], [390, 844], [820, 1180], [1440, 900]];

const shot = async (p, name) => {
  await p.waitForTimeout(250);
  await p.screenshot({ path: path.join(OUT, name + '.png') });
  return p.evaluate(() => {
    const card = document.querySelector('.setup-card');
    const doc = document.documentElement;
    const q = s => document.querySelector(s);
    return {
      docScroll: doc.scrollHeight - innerHeight,
      cardOverflow: card ? card.scrollHeight - card.clientHeight : 0,
      bottom: card ? Math.round(card.getBoundingClientRect().bottom) : null,
      vh: innerHeight,
      gallery: q('#mapman .gbody') ? q('#mapman .gbody').scrollHeight - q('#mapman .gbody').clientHeight : 0,
      lobby: q('.lobbyact') ? Math.round(q('.lobbyact').getBoundingClientRect().bottom) : 0,
      pager: q('.pager') ? Math.round(q('.pager').getBoundingClientRect().bottom) : 0
    };
  });
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await B.launch();
  const rows = [];
  for (const [w, h] of SIZES) {
    const ctx = await b.browser.newContext({ viewport: { width: w, height: h }, serviceWorkers: 'block', locale: 'en-US', deviceScaleFactor: 1 });
    await ctx.addInitScript({ path: 'tests/fake-firebase.js' });
    const p = await ctx.newPage();
    await p.goto(URL);
    const tag = w + 'x' + h;
    // guest welcome
    await p.evaluate(() => { Sync.registered = false; Sync.profile = null; Sync.user = null; S.stage = 'welcome'; renderFlow(); });
    rows.push(['welcome-guest', tag, await shot(p, tag + '-welcome-guest')]);
    // signed-in welcome
    await p.evaluate(() => { Sync.registered = true; Sync.profile = { handle: 'riccardo_fuffo', name: 'Fuffolomeo' }; S.name = 'Fuffolomeo'; renderFlow(); });
    rows.push(['welcome-user', tag, await shot(p, tag + '-welcome-user')]);
    // auth
    await p.evaluate(() => { Sync.registered = false; Sync.profile = null; S.stage = 'auth'; T.authReason = ''; save(); renderFlow(); });
    rows.push(['auth', tag, await shot(p, tag + '-auth')]);
    // account
    await p.evaluate(() => { Sync.registered = true; Sync.profile = { handle: 'riccardo_fuffo', name: 'Fuffolomeo' }; Sync.user = { email: 'riccardo.rodolfi.architetto@gmail.com' }; Sync.isAdmin = true; S.stage = 'account'; T.authMsg = ''; save(); renderFlow(); });
    rows.push(['account', tag, await shot(p, tag + '-account')]);
    // games list
    await p.evaluate(() => {
      S.stage = 'games';
      T.myGames = [['7H3U', { status: 'In progress' }], ['K95M', { status: 'Finished' }], ['QW2Z', { status: 'Lobby' }], ['B7R7', { status: 'Finished' }], ['M2XQ', { status: 'Finished' }], ['L9PA', { status: 'Finished' }], ['C4VT', { status: 'Finished' }]];
      save(); renderFlow();
    });
    rows.push(['games', tag, await shot(p, tag + '-games')]);
    // admin
    await p.evaluate(() => {
      S.stage = 'admin'; T.adminTab = 'users';
      T.admin = {
        users: { a: { profile: { name: 'Riccardo Rodolfi', handle: 'riccardo_fuffo' }, rooms: { '7H3U': { at: 1 } } }, b: { profile: { name: 'Peppinello', handle: 'peppe' }, rooms: {} } },
        rooms: { '7H3U': { host: 'a', map: 'galilei', players: 4, status: 'playing', at: Date.now() } },
        maps: {}, reports: {}, log: {}, bans: {}
      };
      save(); renderFlow();
    });
    rows.push(['admin', tag, await shot(p, tag + '-admin')]);
    // map manager
    await p.evaluate(() => { S.stage = 'welcome'; boot(); actions.maps_(); });
    rows.push(['maps', tag, await shot(p, tag + '-maps')]);
    await p.evaluate(() => { const g = document.querySelector('#mapman'); if (g) g.remove(); });
    // lobby (create a table, add a bot)
    await p.goto(URL);
    await p.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
    await p.goto(URL);
    await p.waitForSelector('#flow-name');
    await p.fill('#flow-name', 'Host');
    await p.evaluate(() => { Sync.registered = true; Sync.profile = { handle: 'riccardo_fuffo', name: 'Fuffolomeo' }; });
    await p.click('[data-act=hostsetup]');
    await p.click('[data-act=hostcreate]');
    await p.waitForSelector('.roomcard b');
    await p.click('[data-act=addlobbybot]');
    await p.waitForTimeout(300);
    rows.push(['lobby', tag, await shot(p, tag + '-lobby')]);
    await ctx.close();
  }
  console.log('out', OUT);
  for (const [name, tag, m] of rows) console.log(name.padEnd(14), tag.padEnd(9), JSON.stringify(m));
  await b.close();
})().catch(e => { console.error('ERR', e.message); process.exit(1); });
