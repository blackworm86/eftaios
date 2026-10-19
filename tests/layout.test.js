// Phone layout: player strip fits, bottom panel does not scroll, current position = own marker with glow. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const SS='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const [w,h] of [[390,800],[360,640]]){
 const p=await (await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');for(let i=0;i<4;i++)await p.click('[data-act=hotadd]');
 await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
 // give the other 7 players a public noise each so they appear in the strip
 await p.evaluate(()=>{const H=JSON.parse(localStorage.getItem('eftaios.hot'));H.seats.slice(1).forEach((s,i)=>S.log.unshift({id:'x'+i,by:s.id,who:s.name,turn:1,kind:'noise',sector:['K10','M10','N10','O10','I10','J10','P10'][i],text:'noise',at:Date.now()}));S.items=['adrenaline','spotlight'];render();paintOverlay()});
 const bar=await p.evaluate(()=>{const b=document.querySelector('#mkbar');return {n:b.querySelectorAll('[data-act=pfocus]').length,over:b.scrollHeight>b.clientHeight+1,left:b.getBoundingClientRect().left,w:b.getBoundingClientRect().width}});
 assert(bar.n===8&&!bar.over,w+'px: all 8 players fit in the vertical strip without scrolling');
 assert(bar.left<10&&bar.w<70,w+'px: the strip is on the left side');
 const pan=await p.evaluate(()=>{const e=document.querySelector('#panel-body');return e.scrollHeight<=e.clientHeight+1});
 assert(pan,w+'px: the bottom panel does not scroll (move phase)');
 assert(await p.locator('#go-input').count()===0&&await p.locator('.slot').count()>=1,w+'px: no sector field; an item row');
 assert(await p.evaluate(()=>!document.querySelector('.me-dot'))&&await p.evaluate(()=>document.querySelectorAll('#me .me-ring.pulse').length===1&&document.querySelectorAll('#me .me-ring').length===1),w+'px: current position = own marker with glow');
 // change suspicion from the map strip
 const k=await p.evaluate(()=>document.querySelectorAll('#mkbar [data-act=pfocus]')[2].dataset.k);
 await p.click(`#mkbar [data-act=pfocus][data-k="${k}"]`);await p.click(`#mkbar .msus [data-v=alien]`);
 assert(await p.evaluate(k=>S.sus[k]==='alien',k),w+'px: suspicion can be set from the map strip');
 assert(await p.evaluate(()=>{const b=document.querySelector('#mkbar');return b.scrollHeight<=b.clientHeight+1}),w+'px: strip still fits with the suspicion buttons open');
 await p.screenshot({path:SS+'/lay-'+w+'.png'});
 // after confirming a move, the panel still fits
 const id=await p.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));await p.evaluate(i=>selectCell(i),id);
 assert(await p.evaluate(()=>{const e=document.querySelector('#panel-body');return e.scrollHeight<=e.clientHeight+1}),w+'px: panel fits with a destination selected');
 await p.click('[data-act=confirm]');
 assert(await p.evaluate(()=>{const e=document.querySelector('#panel-body');return e.scrollHeight<=e.clientHeight+1}),w+'px: panel fits after moving (draw card step)');
 await p.screenshot({path:SS+'/lay2-'+w+'.png'});
 await p.close();}
 console.log('errors',errs);await b.close()})()
