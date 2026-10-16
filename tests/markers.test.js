// Player markers: one shape per player, private suspicion colours; table capped at 8. Static server on :8123.
const {assert,setup,startTable,begin,current}=require('./helpers');const SS='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
(async()=>{
  const {b,ctx,pages,errs}=await setup(3);const [A,B,C]=pages;
  await startTable(pages);await begin(pages);
  // each player announces a noise on their turn
  for(let k=0;k<3;k++){const p=await current(pages);const i0=await p.evaluate(()=>T.turnState.idx);
    await p.evaluate(()=>{S.phase='resolve';S.res={stage:'choose'};S.pos='K10';render()});await p.click('[data-act=noiseAny]');await p.evaluate(sec=>{const cb=T.pick.cb;T.pick=null;cb(sec)},['M10','N10','O10'][k]);
    await p.click('[data-act=next]');await A.waitForFunction(i=>T.turnState.idx!==i||T.turnState.n>1,i0)}
  await A.waitForFunction(()=>S.log.filter(e=>e.kind==='noise').length>=3);
  const mk=await A.evaluate(()=>[...document.querySelectorAll('#marks .pm')].map(g=>({d:g.querySelector('path').getAttribute('d'),c:g.getAttribute('class')})));
  assert(mk.length===3,'three markers on the map ('+mk.length+')');
  assert(new Set(mk.map(m=>m.d)).size===3,'each player has a different shape');
  assert(mk.every(m=>/neutral/.test(m.c)),'markers start neutral');
  const shapesB=await B.evaluate(()=>[...document.querySelectorAll('#marks .pm path')].map(p=>p.getAttribute('d')).sort().join('|'));
  assert(shapesB===mk.map(m=>m.d).sort().join('|'),'every device shows the same shape for the same player');
  // A suspects B is an alien and C is human
  await A.click('[data-tab=table]');
  const uB=await B.evaluate(()=>Sync.uid),uC=await C.evaluate(()=>Sync.uid);
  await A.click(`[data-act=sus][data-k="u:${uB}"][data-v=alien]`);await A.click(`[data-act=sus][data-k="u:${uC}"][data-v=human]`);
  const cls=await A.evaluate(()=>[...document.querySelectorAll('#marks .pm')].map(g=>g.getAttribute('class')).join(' '));
  assert(/alien/.test(cls)&&/human/.test(cls)&&/neutral/.test(cls),'suspicion recolours that player\'s markers (red / blue)');
  assert(await B.evaluate(()=>[...document.querySelectorAll('#marks .pm')].every(g=>/neutral/.test(g.getAttribute('class')))),'suspicions are private to the device');
  assert(await A.locator(`[data-act=sus][data-k="me"]`).count()===0,'you cannot tag yourself');
  await A.screenshot({path:SS+'/m-table.png'});await A.click('[data-tab=play]');await A.evaluate(()=>{focusOn('N10')});await A.screenshot({path:SS+'/m-map.png'});
  // table full at 8
  const code=await A.evaluate(()=>Sync.code);
  await A.evaluate(c=>{const t=JSON.parse(localStorage.getItem('fakefb'));for(let i=0;i<6;i++)t.rooms[c].players['x'+i]={name:'X'+i,ready:false};t.rooms[c].settings.status='lobby';localStorage.setItem('fakefb',JSON.stringify(t))},code);
  const D=await ctx.newPage();await D.goto('http://localhost:8123/?room='+code);await D.click('[data-act=joinroom]');await D.waitForTimeout(600);
  assert((await D.textContent('#flow-card')).includes('full'),'a 9th player is refused');
  console.log('errors',errs);await b.close();
})();
