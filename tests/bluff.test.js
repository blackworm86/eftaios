// My bluffs are tracked: semi-transparent marker of my colour with the turn number. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 // turn 1: move and announce honestly; turn 2: move and bluff somewhere else
 const go=async()=>{const id=await p.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));await p.evaluate(i=>selectCell(i),id);await p.click('[data-act=confirm]');return id};
 const real1=await go();await p.click('[data-act=noiseHere]');await p.click('[data-act=next]');
 await go();await p.click('[data-act=noiseAny]');await p.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('P12')});await p.click('[data-act=next]');
 const m=await p.evaluate(()=>[...document.querySelectorAll('#marks .pm')].map(g=>({cls:g.getAttribute('class'),t:g.textContent,fill:g.querySelector('circle[stroke]').getAttribute('fill'),op:getComputedStyle(g).opacity})));
 const bl=m.filter(x=>/bluff/.test(x.cls)),route=m.filter(x=>/mine/.test(x.cls)&&!/bluff/.test(x.cls));
 assert(bl.length===1&&bl[0].t==='2','one bluff marker, numbered with the turn of the bluff (2)');
 assert(+bl[0].op<0.6,'bluff marker is semi-transparent ('+bl[0].op+')');
 assert(bl[0].fill===route[0].fill,'bluff marker uses my colour');
 assert(!m.some(x=>/bluff/.test(x.cls)&&x.t==='1'),'an honest announcement does not create a bluff marker');
 await p.click('#mkbar [data-act=pfocus][data-k=me]').catch(()=>{});
 console.log('errors',errs);await b.close()})()
