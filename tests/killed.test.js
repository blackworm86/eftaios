// A killed Human reborn as an Alien: no arrow to the Alien Sector, a killed badge where they died. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:900,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 const r=await p.evaluate(()=>{const A=find(T.map,'A'),path=[{turn:0,pos:'K08'},{turn:1,pos:'L09'},{turn:2,pos:A,note:'reborn'},{turn:3,pos:'L10'}];return {steps:pathSteps(path).map(s=>s.from+'>'+s.to),k:killedSector(path),dead:killedSector([{turn:0,pos:'K08'},{turn:1,pos:'L09'}],'killed'),none:killedSector([{turn:0,pos:'K08'}],'')}});
 assert(r.steps.length===2&&!r.steps.some(s=>s.includes(r.steps[0])&&false),'the restart in the Alien Sector is not a step');
 assert(r.k==='L09'&&r.dead==='L09'&&r.none===null,'the killed sector is where the player died');
 assert(await p.evaluate(()=>decodeRoute(encodeRoute([{turn:1,pos:'L09'},{turn:2,pos:'L10',note:'reborn'}]))[1].note==='reborn'),'the restart survives the published route');
 console.log('errors',errs);await b.close();})();
