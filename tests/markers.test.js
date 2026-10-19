// Player markers: one shape per player, private suspicion colours; table capped at 8. Static server on :8123.
const {assert,setup,startTable,begin,current}=require('./helpers');const SS='/tmp/claude-0/-home-user-eftaios/e0e2ef74-16c4-5dff-bfb4-67a6a55e2481/scratchpad';
(async()=>{
  const {b,ctx,pages,errs}=await setup(3);const [A,B,C]=pages;
  await startTable(pages);await begin(pages);
  // each player announces a noise on their turn
  for(let k=0;k<3;k++){const p=await current(pages);const i0=await p.evaluate(()=>T.turnState.idx);
    await p.evaluate(sec=>{S.phase='resolve';S.res={stage:'done',say:'x'};S.pos='K10';say('','noise',sec);render()},['M10','N10','O10'][k]);
    await p.click('[data-act=next]');await A.waitForFunction(i=>T.turnState.idx!==i||T.turnState.n>1,i0)}
  await A.waitForFunction(()=>S.log.filter(e=>e.kind==='noise').length>=3);
  const mk=await A.evaluate(()=>[...document.querySelectorAll('#marks .pm:not(.mine)')].map(g=>{const c=g.querySelector('path:not(.mko)');return {d:c.getAttribute('fill'),c:c.getAttribute('stroke')}}));
  assert(mk.length===2,'the other two players appear as markers ('+mk.length+')');
  assert(new Set(mk.map(m=>m.d)).size===2,'each player has a different colour');
  assert(mk.every(m=>m.c==='#ffd23f'),'opponents start with a yellow (undecided) border');
  assert(await A.evaluate(()=>[...document.querySelectorAll('#marks .pm.mine path[stroke]')].every(c=>c.getAttribute('stroke')==='#000000'))&&await A.evaluate(()=>document.querySelectorAll('#marks .pm.mine').length)>=1,'my own markers have a black border');
  const uids=await Promise.all(pages.map(p=>p.evaluate(()=>Sync.uid)));
  const view=async (p)=>p.evaluate(u=>u.map(x=>x===Sync.uid?null:colorOf('u:'+x)),uids);
  const vs=[await view(A),await view(B),await view(C)];
  const same=[0,1,2].every(i=>new Set(vs.map(v=>v[i]).filter(x=>x!==null)).size===1),cols=[0,1,2].map(i=>vs.map(v=>v[i]).find(x=>x!==null));
  assert(same&&new Set(cols).size===3,'every device gives each other player the same, distinct colour');
  assert(await A.evaluate(()=>pal('me')[0])==='#f5f5f5','I am always white on my own device');
  // A suspects B is an alien and C is human
  await A.click('[data-tab=table]');
  const uB=await B.evaluate(()=>Sync.uid),uC=await C.evaluate(()=>Sync.uid);
  const gb=u=>A.click(`.sheet [data-act=sus][data-k="u:${u}"]`);await gb(uB);await gb(uB);await gb(uC);
  const cls=await A.evaluate(()=>[...document.querySelectorAll('#marks .pm:not(.mine) path[stroke]')].map(c=>c.getAttribute('stroke')).join(' '));
  assert(cls.includes('#ff3b30')&&cls.includes('#2f7dff'),'suspicion recolours that player\'s markers (red / blue)');
  assert(await B.evaluate(()=>[...document.querySelectorAll('#marks .pm:not(.mine) path[stroke]')].every(c=>c.getAttribute('stroke')==='#ffd23f')),'suspicions are private to the device');
  assert(await A.locator(`[data-act=sus][data-k="me"]`).count()===0,'you cannot tag yourself');
  await A.screenshot({path:SS+'/m-table.png'});await A.click('[data-tab=play]');await A.evaluate(()=>{focusOn('N10')});await A.screenshot({path:SS+'/m-map.png'});
  // table full at 8
  const code=await A.evaluate(()=>Sync.code);
  await A.evaluate(c=>{const t=JSON.parse(localStorage.getItem('fakefb'));for(let i=0;i<6;i++)t.rooms[c].players['x'+i]={name:'X'+i,ready:false};t.rooms[c].settings.status='lobby';localStorage.setItem('fakefb',JSON.stringify(t))},code);
  const D=await ctx.newPage();await D.goto('http://localhost:8123/?room='+code);await D.click('[data-act=joinroom]');await D.waitForTimeout(600);
  assert((await D.textContent('#flow-card')).includes('full'),'a 9th player is refused');
  console.log('errors',errs);await b.close();
})();
