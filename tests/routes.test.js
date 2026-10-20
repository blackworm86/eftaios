// Routing overlay: a map switch draws colored arrows between each player's known steps. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 await p.evaluate(()=>{const L=(who,turn,kind,sector)=>S.log.unshift({id:Math.random()+'',who,turn,kind,sector,text:kind,at:Date.now()+turn,mine:false});
  ['I06','I07','I06','I07'].forEach((s,i)=>L('Bob',i+1,'noise',s));L('Fay',2,'noise','N05');L('Fay',3,'attack','N08');L('Fay',6,'noise','Q05');
  ['K06','K07'].forEach((s,i)=>L('Cal',i+2,'noise',s));['K06','K07'].forEach((s,i)=>L('Dee',i+2,'noise',s));S.turn=6;S.mkN=0;paintOverlay()});
 assert(await p.locator('#marks .routes').count()===0,'routes are off by default');
 await p.click('[data-act=routes]');
 const r=await p.evaluate(()=>({n:document.querySelectorAll('#marks .routes .rt').length,tags:[...document.querySelectorAll('#marks .rtag')].map(x=>x.textContent),dash:[...document.querySelectorAll('#marks .routes path[stroke-dasharray]')].length,pressed:document.querySelector('[data-act=routes]').getAttribute('aria-pressed')}));
 assert(r.n>=5&&r.pressed==='true','the switch shows the arrows');
 assert(!r.tags.some(x=>/^\d$/.test(x)),'no length tags next to the arrows');
 const geo=await p.evaluate(()=>[straightMove(T.map,'K08','J09'),straightMove(T.map,'I10','J11'),straightMove(T.map,'L08','L10'),straightMove(T.map,'K08','L08')]);
 assert(geo[0]===false&&geo[1]===false&&geo[2]===true&&geo[3]===true,'moves in a straight row are straight; the others bend so they never run along a sector edge');
 assert(r.tags.some(x=>/T3.6/.test(x))&&r.dash>=1,'turns nobody heard are a dashed curve with the turns');
 // back and forth: two arrows on the same two sectors, pushed apart
 const bf=await p.evaluate(()=>{const ps=[...document.querySelectorAll('#marks .routes .rt path')].map(x=>x.getAttribute('d')).filter(Boolean);return ps.length});
 assert(bf>=5,'back-and-forth and shared-route arrows are all drawn');
 // a bent arrow never crosses empty space or a start sector (every 2-step move with a walkable sector between, on Galilei)
 const crossed=await p.evaluate(()=>{const m=T.maps.find(x=>x.id==='galilei');T.map=m;const cells=[];for(let r=0;r<m.rows;r++)for(let c=0;c<m.cols;c++)if('.s'.includes(m.grid[r][c]))cells.push(cid(c,r));let n=0,bad=0;
  for(const a of cells)for(const b of cells){if(!(a<b)||hexDist(m,a,b)!==2||straightMove(m,a,b))continue;if(![...reachable(m,a,1,'alien').keys()].some(k=>hexDist(m,k,b)===1))continue;n++;
   const pa=parseId(a),pb=parseId(b),ha=hexPos(m,pa[0],pa[1]),hb=hexPos(m,pb[0],pb[1]),s=curveSide(m,[ha.x,ha.y],[hb.x,hb.y]),dx=hb.x-ha.x,dy=hb.y-ha.y,L=Math.hypot(dx,dy),cx=(ha.x+hb.x)/2-dy/L*.3*s*L,cy=(ha.y+hb.y)/2+dx/L*.3*s*L;
   for(let i=3;i<=17;i++){const q=i/20,px=(1-q)*(1-q)*ha.x+2*(1-q)*q*cx+q*q*hb.x,py=(1-q)*(1-q)*ha.y+2*(1-q)*q*cy+q*q*hb.y,ty=typeAtPoint(m,px,py);if(ty==='x'||ty==='H'||ty==='A'){bad++;break}}}
  return {n,bad}});
 assert(crossed.n>100&&crossed.bad===0,'a bent arrow never crosses empty space ('+crossed.n+' moves checked)');
 // pick one player
 await p.evaluate(()=>follow('n:fay'));
 assert(await p.evaluate(()=>document.querySelectorAll('#marks .routes .rt').length)===2,'following a player shows only their arrows');
 await p.evaluate(()=>follow(null));await p.click('[data-act=routes]');
 assert(await p.locator('#marks .routes').count()===0,'the switch hides them again');
 console.log('errors',errs);await b.close();})();
