// Undo of a confirmed move, until something irreversible happens. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:900},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 const start=await p.evaluate(()=>S.pos);
 const id=await p.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));await p.evaluate(i=>selectCell(i),id);await p.click('[data-act=confirm]');
 assert(await p.evaluate(()=>S.pos)===id&&await p.locator('[data-act=undo]').count()===1,'undo offered after confirming a move');
 await p.click('[data-act=undo]');
 assert(await p.evaluate(()=>S.pos)===start&&await p.evaluate(()=>S.phase)==='move'&&await p.evaluate(()=>S.path.length)===1,'undo restores position, phase and route');
 await p.evaluate(i=>selectCell(i),id);await p.click('[data-act=confirm]');await p.click('[data-act=noiseHere]');
 assert(await p.locator('[data-act=undo]').count()===0,'no undo after announcing');
 // adrenaline state is restored by undo
 await p.evaluate(()=>{S.stage='game'});
 await p.click('[data-act=next]');
 await p.evaluate(()=>{S.adr=true;refreshReach();render()});
 const id2=await p.evaluate(()=>[...T.reach.entries()].find(([k,d])=>d===2&&at(T.map,k)==='.')[0]);await p.evaluate(i=>selectCell(i),id2);await p.click('[data-act=confirm]');
 await p.click('[data-act=undo]');assert(await p.evaluate(()=>S.adr)===true,'undo gives Adrenaline back for the same turn');
 console.log('errors',errs);await b.close()})()
