// Turn order + one-player-at-a-time (physical cards). Needs a static server on :8123.
const {assert,setup,startTable,begin,current,uidOf}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(3);const [A,B,C]=pages;
  await startTable(pages);
  // host moves P2 (C) to the top of the order
  await A.click('.plist li:nth-child(3) [data-act=mvup]');await A.click('.plist li:nth-child(2) [data-act=mvup]');
  await A.waitForFunction(()=>document.querySelector('.plist li:first-child .pname').textContent.includes('P2'));
  assert(true,'host can reorder players');
  await B.waitForFunction(()=>document.querySelector('.plist li:first-child .pname').textContent.includes('P2'));assert(true,'order synced to guests');
  assert(await B.locator('[data-act=mvup]').count()===0,'guests cannot reorder');
  await begin(pages);
  const cur=await current(pages);assert(cur===C,'first player is the top of the order');
  assert(await C.locator('#turnbar.mine').count()===1,'current player sees "your turn"');
  assert(await A.locator('[data-act=confirm]').count()===0&&(await A.textContent('#panel-body')).includes('P2'),'other players only wait');
  // current player moves and ends turn
  const id=await C.evaluate(()=>[...T.reach.keys()][0]);await C.evaluate(i=>selectCell(i),id);await C.click('[data-act=confirm]');
  await C.evaluate(()=>{S.res={stage:'done',say:'x'};render()});await C.click('[data-act=next]');
  await A.waitForFunction(()=>T.turnState.idx===1);
  const order=await A.evaluate(()=>Sync.settings.order);const second=await A.evaluate(()=>T.turnState.uid);
  assert(second===order[1],'turn passes to next player in order');
  assert(await A.evaluate(()=>T.turnState.n)===1,'round counter unchanged mid-round');
  // finish the round: next two end their turns
  for(let k=0;k<2;k++){const p=await current(pages);const t0=await p.evaluate(()=>T.turnState.idx);await p.evaluate(()=>{S.phase='resolve';S.res={stage:'done',say:'x'};render()});await p.click('[data-act=next]');await A.waitForFunction(i=>T.turnState.idx!==i,t0);}
  assert(await A.evaluate(()=>T.turnState.n)===2&&await A.evaluate(()=>T.turnState.idx)===0,'round increments after the last player');
  assert(await C.evaluate(()=>S.turn)===2,'players see the new turn number');
  // a player who is eliminated is skipped
  // an Alien is eliminated (roles are dealt at random; a dead Human could end the game)
  let dead=null;for(const p of pages){if(await p.evaluate(()=>S.role)==='alien'){dead=p;break}}
  const deadName=await dead.evaluate(()=>Sync.uid);   // ids, not names: the fake account gives every player the same name
  await dead.evaluate(()=>{S.over='dead';afterChange()});await A.waitForFunction(()=>Object.values(Sync.players).some(p=>p.out==='killed'));
  // the elimination shows the dead player's Character card to the table: dismiss it on every screen, as players would
  for(const pg of pages)if(await pg.waitForSelector('dialog[open] #d-no',{timeout:5000}).then(()=>true,()=>false))await pg.click('dialog[open] #d-no');
  const seq=[];for(let k=0;k<3;k++){const p=await current(pages);seq.push(await p.evaluate(()=>Sync.uid));const i0=await p.evaluate(()=>T.turnState.idx);await p.evaluate(()=>{S.phase='resolve';S.res={stage:'done',say:'x'};render()});await p.click('[data-act=next]');await A.waitForFunction(i=>T.turnState.idx!==i||T.turnState.n>2,i0)}
  assert(!seq.includes(deadName),'eliminated player never gets a turn (sequence '+seq.join(',')+')');
  // host can skip an absent player
  const cur2=await current(pages);const host=A;if(cur2!==A){await A.click('[data-tab=table]');await A.click('[data-act=tsec][data-k=status]');await A.click('[data-act=skipturn]');await A.click('#d-yes');await A.waitForFunction(u=>T.turnState.uid!==u,await cur2.evaluate(()=>Sync.uid));assert(true,'host can skip an absent player')}
  console.log('errors',errs);await b.close();
})();
