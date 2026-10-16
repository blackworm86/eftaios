// Markers in a crowded sector never overlap; focusing one player greys out the rest. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const SS='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:900},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 await p.evaluate(()=>{
   S.turn=6;S.path=[{turn:0,pos:'L08'},{turn:1,pos:'K10'},{turn:2,pos:'K11'},{turn:3,pos:'K10'},{turn:4,pos:'J10'}];S.pos='J10';
   const add=(who,turn,sector,kind='noise')=>S.log.unshift({id:Math.random()+'',who,turn,sector,kind,text:kind,mine:false,at:Date.now()});
   ['Anna','Bruno','Carla','Dario','Elena'].forEach((n,i)=>add(n,2+i%3,'K10'));add('Anna',5,'K10');add('Anna',3,'M10');add('Anna',4,'N10','attack');add('Bruno',5,'J10');
   paintOverlay();focusOn('K10');
 });
 const boxes=await p.evaluate(()=>{const svgEl=document.querySelector('#map');const res={};document.querySelectorAll('#marks .pm').forEach(g=>{const m=/translate\(([-\d.]+) ([-\d.]+)\)/.exec(g.getAttribute('transform'));const r=g.firstChild.getBBox();(res[g.dataset.s||'']=res[g.dataset.s||'']||[]).push({x:+m[1]+r.x,y:+m[2]+r.y,w:r.width,h:r.height,t:g.textContent})});return res['']});
 const ov=(a,c)=>a.x<c.x+c.w-0.3&&c.x<a.x+a.w-0.3&&a.y<c.y+c.h-0.3&&c.y<a.y+a.h-0.3;
 let clash=0;for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(ov(boxes[i],boxes[j]))clash++;
 assert(clash===0,'no two markers overlap ('+boxes.length+' markers)');
 const labels=boxes.map(b=>b.t);
 assert(labels.includes('3,1'),'my two visits to the same sector share one marker "3,1" ('+labels.join(' ')+')');
 assert(labels.includes('5,2'),'a player who announced the same sector twice shows both turns');
 await p.screenshot({path:SS+'/ov-map.png'});
 // focus on Anna
 await p.click('#mkbar button[title=Anna]');
 const st=await p.evaluate(()=>{const all=[...document.querySelectorAll('#marks .pm')];return {dim:all.filter(g=>g.classList.contains('dim')).length,lit:all.filter(g=>!g.classList.contains('dim')).length,tl:!!document.querySelector('#marks .tl'),trail:document.querySelector('#trail').classList.contains('dim')}});
 assert(st.lit===3&&st.dim>0&&st.tl&&st.trail,'focus shows only that player (3 markers + timeline), the rest greyed');
 await p.evaluate(()=>fit());await p.screenshot({path:SS+'/ov-focus.png'});
 await p.click('#mkbar button[title=Anna]');assert(await p.evaluate(()=>document.querySelectorAll('#marks .dim').length)===0,'tapping again shows everyone');
 console.log('errors',errs);await b.close()})()
