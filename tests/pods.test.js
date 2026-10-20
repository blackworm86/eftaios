// After a pod card the sector is solid red/green with only the printed symbol; the timeline and log mark it. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 const cls=n=>p.evaluate(n=>document.querySelector('[data-id="'+find(T.map,String(n))+'"] polygon').getAttribute('class'),n);
 const txt=n=>p.evaluate(n=>document.querySelector('[data-id="'+find(T.map,String(n))+'"] .sicon').textContent,n);
 assert(await cls(1)==='hex P'&&await txt(1)==='1','an unused pod keeps its number and pictogram');
 await p.evaluate(()=>{S.turn=3;S.pos=find(T.map,'1');S.path=[{turn:0,pos:find(T.map,'H')},{turn:3,pos:S.pos}];S.phase='resolve';S.res={stage:'pod'};actions.podRed()});
 assert((await cls(1)).includes('closed red')&&await txt(1)==='','a damaged pod is solid red without number');
 await p.evaluate(()=>{S.turn=5;S.hatches[2]=1;say('', 'hatch', find(T.map,'2'), { n: 2, ok: 1 });paintCells()});
 assert((await cls(2)).includes('closed green'),'an escaped pod is solid green');
 await p.evaluate(()=>{setTab('table')});
 assert(await p.locator('.sheet td.c.pod.red .gi').count()===1&&await p.locator('.sheet td.c.pod.green .gi').count()===1,'the timeline marks pod steps with the red and green icons');
 await p.click('[data-act=tsec][data-k=log]');
 assert(await p.locator('ul.log li .gi').count()>=2,'the log lines carry the pod icons');
 console.log('errors',errs);await b.close();})();
