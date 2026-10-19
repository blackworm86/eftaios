// Run: node tests/lobby.test.js  (needs playwright + a static server on :8123)
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const S='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
const ctx=await b.newContext({viewport:{width:390,height:900},serviceWorkers:'block',locale:'en-US'});
await ctx.addInitScript({path:'tests/fake-firebase.js'});
await ctx.addInitScript(()=>{const g=Storage.prototype.getItem,st=Storage.prototype.setItem;Storage.prototype.getItem=function(k){return String(k).startsWith('eftaios')?g.call(sessionStorage,k):g.call(this,k)};Storage.prototype.setItem=function(k,v){return String(k).startsWith('eftaios')?st.call(sessionStorage,k,v):st.call(this,k,v)}});
const A=await ctx.newPage(),B=await ctx.newPage();
for(const [n,p] of [['A',A],['B',B]]){p.on('pageerror',e=>errs.push(n+': '+e.message));p.on('console',m=>m.type()==='error'&&errs.push(n+': '+m.text()))}
await A.goto('http://localhost:8123/');
await A.fill('#flow-name','Anna');await A.click('[data-act=hostsetup]');
assert(await A.locator('[data-f=cards],[data-f=track]').count()===0,'host setup: no cards or tracking options (tables are digital)');
assert((await A.locator('[role=radio][data-f=mode]').evaluateAll(els=>els.map(e=>e.dataset.v))).join()==='basic,advanced,infection','rules are listed Basic, Advanced, Infection');
await A.click('.mapcard');await A.click(`.gcard[data-id=\"${'fermi'}\"]`);await A.click('[data-f=mode][data-v=basic]');
await A.click('[data-act=hostcreate]');await A.waitForSelector('.roomcard b');
const code=await A.textContent('.roomcard b');assert(/^[A-Z2-9]{4}$/.test(code),'host got code '+code);
assert(await A.locator('.startbtn').isDisabled(),'start disabled with 1 player');
await A.screenshot({path:S+'/lobby-host.png'});
await B.goto('http://localhost:8123/?room='+code);
assert((await B.textContent('.banner')).includes(code),'guest sees invite banner');
await B.fill('#flow-name','Bruno');await B.click('[data-act=joinroom]');await B.waitForSelector('.plist li:nth-child(2)');
assert(await B.locator('.startbtn').count()===0,'guest has no start button');
assert((await B.textContent('.kv')).includes('Fermi')&&(await B.textContent('.kv')).includes('Basic'),'guest sees host settings');
await A.click('[data-act=ready]');
assert(await A.locator('.startbtn').isDisabled(),'start disabled until all ready');
await B.click('[data-act=ready]');await A.waitForFunction(()=>!document.querySelector('.startbtn').disabled);
assert(true,'start enabled when all ready');
await B.screenshot({path:S+'/lobby-guest.png'});
// host changes map while guest watching
await A.click('.mapcard');await A.click(`.gcard[data-id=\"${'galilei'}\"]`);await B.waitForFunction(()=>document.querySelector('.kv dd').textContent.includes('Galilei'));assert(true,'settings sync to guest');
await A.click('.startbtn');
await A.waitForSelector('#app:not([hidden])');await B.waitForSelector('#app:not([hidden])');
assert(['human','alien'].includes(await A.evaluate(()=>S.role))&&['human','alien'].includes(await B.evaluate(()=>S.role)),'roles are dealt to both players');
assert(await A.evaluate(()=>T.map.id)==='galilei'&&await B.evaluate(()=>S.mode)==='basic','map+mode from table');
assert(await A.locator('dialog[open]').count()===1,'first player dialog shown');
// roles are never in the shared player list
assert(await A.evaluate(()=>Object.values(Sync.players).every(p=>!p.role)),'roles are not in the shared player list');
assert(await A.locator('[data-act=faction]').count()===0,'no manual faction pick');
// announcement sync
await A.click('#d-no').catch(()=>{});
const id=await A.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));
await A.evaluate(i=>selectCell(i),id);await A.click('[data-act=confirm]');await A.evaluate(()=>say('','noise',S.pos));
await B.waitForFunction(()=>S.log.length>0);assert((await B.evaluate(()=>S.log[0].kind))==='noise','announcement reached guest');
// guest reload keeps game and rejoins
const roleB=await B.evaluate(()=>S.role);await B.reload();await B.waitForSelector('#app:not([hidden])');assert(await B.evaluate(()=>S.role)===roleB,'guest resumes after reload with the same role');
// late joiner blocked
const C=await ctx.newPage();await C.goto('http://localhost:8123/?room='+code);await C.click('[data-act=joinroom]');await C.waitForTimeout(400);
assert((await C.textContent('#flow-card')).includes('already started'),'late joiner refused');
console.log('errors',errs);await b.close()})()
