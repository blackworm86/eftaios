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
 const m=await p.evaluate(()=>[...document.querySelectorAll('#marks .pm')].map(g=>{const c=g.querySelector('[stroke]');return {cls:g.getAttribute('class'),t:g.textContent,fill:c.getAttribute('fill'),fo:c.getAttribute('fill-opacity'),dash:c.getAttribute('stroke-dasharray')}}));
 const bl=m.filter(x=>/bluff/.test(x.cls)),route=m.filter(x=>/mine/.test(x.cls)&&!/bluff/.test(x.cls));
 assert(bl.length===1&&bl[0].t==='2','one bluff marker, numbered with the turn of the bluff (2)');
 assert(bl[0].dash&&bl[0].fo==='1','bluff marker: dashed border, full colour');
 assert(bl[0].fill===route[0].fill,'bluff marker uses my colour');
 assert(await p.evaluate(()=>document.querySelectorAll('#marks .bluffline').length)===1,'a dashed line joins my real position to the bluff');
 const r1=route.find(x=>x.t==='1'),r2=route.find(x=>x.t==='2');
 assert(r1&&r1.fo==='1'&&!r1.dash,'an honest noise in my sector: solid border, full colour');
 assert(r2&&+r2.fo<1,'the step where I bluffed elsewhere is faded (nobody heard it)');
 assert(!m.some(x=>/bluff/.test(x.cls)&&x.t==='1'),'an honest announcement does not create a bluff marker');
 // follow mode and the tracking sheet
 await p.evaluate(()=>{S.log.unshift({id:'z1',who:'Zoe',turn:1,kind:'noise',sector:'L10',text:'noise',mine:false,at:Date.now()});paintOverlay()});
 await p.click('#mkbar [data-act=pfocus][data-k="n:zoe"]');
 assert(await p.evaluate(()=>!document.querySelector('#followbar').hidden&&document.querySelectorAll('#zone .fzone').length>1),'following a player shows a banner and where they could be now');
 await p.click('[data-act=unfollow]');assert(await p.evaluate(()=>document.querySelector('#followbar').hidden&&!T.focus),'Stop ends follow mode');
 await p.click('.tabs [data-tab=table]');
 assert(await p.locator('.sheet tbody tr').count()===2&&await p.locator('.sheet .c.bluff').count()===1,'the sheet has a row per player and shows the bluff');
 await p.click('.sheet [data-act=follow][data-k="n:zoe"]');assert(await p.evaluate(()=>T.focus==='n:zoe'&&S.tab==='play'),'tapping a name in the sheet follows that player');
 await p.evaluate(()=>setMarkShape('shape'));assert(await p.evaluate(()=>!!document.querySelector('#marks .pm:not(.mine) path')&&!document.querySelector('#marks .pm.mine path')),'shapes mode: other players get shapes, mine stay circles');
 await p.click('#mkbar [data-act=pfocus][data-k=me]').catch(()=>{});
 console.log('errors',errs);await b.close()})()
