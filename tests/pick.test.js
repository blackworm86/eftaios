// A sector you must announce (Noise in any sector) survives a visit to another tab. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:420,height:860},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 await p.evaluate(()=>{window.__got=null;pickSector('Noise in any sector: tap the sector you announce',id=>{window.__got=id},true)});
 await p.click('[data-act=tab][data-k=table], .tabs button:nth-child(2)').catch(()=>{});
 await p.evaluate(()=>setTab('table'));await p.evaluate(()=>setTab('more'));await p.evaluate(()=>setTab('play'));
 assert(await p.evaluate(()=>!!T.pick&&T.pick.locked),'the locked pick is still waiting on the Play tab');
 assert(await p.locator('.banner').filter({hasText:'Noise in any sector'}).count()===1,'the prompt is shown again');
 await p.evaluate(()=>{const id=find(T.map,'K08')||Object.keys(T.map)[0];onCell(id)});
 assert(await p.evaluate(()=>!!window.__got),'tapping a sector completes the announcement');
 await p.evaluate(()=>{pickSector('free pick',()=>{},false)});await p.evaluate(()=>setTab('table'));
 assert(await p.evaluate(()=>T.pick===null),'an unlocked pick is still dropped when you change tab');
 console.log('errors',errs);await b.close();})();
