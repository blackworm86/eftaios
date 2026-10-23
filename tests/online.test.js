// Digital cards: dealing, decks/reshuffle, items, attack, defense, spotlight, game over. Static server on :8123.
const {assert,setup,startTable,begin,current,uidOf}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(3);const [H,P1,P2]=pages;
  await startTable(pages,{online:true,mode:'ultimate'});
  assert((await H.textContent('#flow-card')).includes('dealt when the game starts'),'lobby says roles and cards are dealt digitally');
  assert(await H.locator('[data-act=faction]').count()===0,'no manual faction pick in digital mode');
  await begin(pages);
  const roles=await Promise.all(pages.map(p=>p.evaluate(()=>S.role)));
  assert(roles.filter(r=>r==='human').length===1&&roles.filter(r=>r==='alien').length===2,'3 players: 1 human, 2 aliens ('+roles+')');
  const chars=await Promise.all(pages.map(p=>p.evaluate(()=>S.char)));assert(chars.every(Boolean)&&new Set(chars).size===3,'each player has a distinct character card');
  const sec=await H.evaluate(()=>Sync.get('secret/'+Sync.uid));assert(sec&&sec.role===roles[0],'host sees own secret');
  const leak=await P1.evaluate(()=>Sync.get('secret/'+Sync.uid));assert(leak&&leak.role===roles[1],'guest reads own secret');
  await H.waitForFunction(()=>T.counts&&T.counts.sector);
  const c0=await H.evaluate(()=>T.counts);assert(c0.sector.d===77&&c0.hatch.d===5&&!c0.item,'decks sized 77 sector / 5 pod cards');
  // composition of the Dangerous Sector deck: draw all 77 cards
  const all=[];for(let i=0;i<77;i++){const r=await H.evaluate(()=>Online.request('sector'));all.push(r.card)}
  const cn=k=>all.filter(x=>x===k).length;
  assert(cn('noise-self')===27&&cn('noise-any')===27&&cn('silence')===6&&all.filter(x=>x.startsWith('item:')).length===17,'27 noise here, 27 noise any, 6 silence, 17 items');
  assert(cn('item:adrenaline')===3&&cn('item:sedatives')===3&&cn('item:attack')===2&&cn('item:cat')===2&&cn('item:spotlight')===2&&['teleport','defense','clone','sensor','mutation'].every(k=>cn('item:'+k)===1),'item cards by type');
  await H.waitForFunction(()=>T.counts.sector.d===0&&T.counts.sector.x===54,null,{timeout:20000});assert(true,'only the 54 noise cards were discarded; silence and items stay with the player');
  await H.evaluate(()=>Online.request('sector'));
  await H.waitForFunction(()=>T.counts.sector.d===53&&T.counts.sector.x===1,null,{timeout:10000});assert(true,'the noise discards are reshuffled into a new pile');
  await H.waitForFunction(()=>S.log.some(e=>e.text==='Sector deck reshuffled'));assert(true,'reshuffle logged for everyone');
  // ---- draw a sector card through the UI
  const cur=await current(pages);
  await cur.evaluate(()=>{S.pos='L09';S.phase='move';T.sel=null;refreshReach();render()});
  const dest=await cur.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));await cur.evaluate(i=>selectCell(i),dest);await cur.click('[data-act=mpyes]');
  await cur.click('[data-act=opt][data-k=draw]');await cur.click('[data-act=optyes]');
  await cur.waitForFunction(()=>S.res&&(S.res.stage==='done'||T.pick),null,{timeout:15000});
  if(await cur.evaluate(()=>!!T.pick)){await cur.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('K09')})}
  await cur.waitForFunction(()=>S.res&&S.res.stage==='done',null,{timeout:15000});
  assert(await cur.evaluate(()=>S.log.some(e=>['noise','silence'].includes(e.kind)))||await cur.evaluate(()=>S.ab&&S.ab.Captain),'card result announced automatically');
  // ---- attack & defense
  const idx=roles.indexOf('human'),human=pages[idx],aliens=pages.filter((_,i)=>roles[i]==='alien');
  await human.evaluate(()=>{S.items=['defense'];S.pos='K09';S.char='Captain';save()});
  for(const a of aliens)await a.evaluate(()=>{S.pos='K09';S.char='Surge Alien'});
  const att=aliens[0];
  await att.evaluate(()=>runAttack(true));  // fromItem path: resolves and shows dialog
  await att.waitForSelector('dialog[open]',{timeout:15000});
  const rep=await att.evaluate(()=>document.querySelector('dialog').textContent);
  assert(/survived with a Defense card/.test(rep),'Defense card auto-played: human survives ('+rep.slice(0,80)+')');
  assert(await human.evaluate(()=>S.items.length)===0&&await human.evaluate(()=>S.over)===null,'defense consumed, human still alive');
  await att.evaluate(()=>closeDlg());
  assert(await att.evaluate(()=>S.pos)==='K09','attacker unaffected');
  // second alien at same sector also present -> was it eliminated? aliens in sector die too
  assert(await aliens[1].evaluate(()=>S.over)==='dead','another Alien in the sector is eliminated (attacks kill everyone there)');
  // attack again: human no longer has defense
  await att.evaluate(()=>{S.role='alien'});
  await att.evaluate(()=>runAttack(true));await att.waitForSelector('dialog[open]',{timeout:15000});
  const rep2=await att.evaluate(()=>document.querySelector('dialog').textContent);
  assert(/was killed/.test(rep2),'second attack kills the human');
  assert(await human.evaluate(()=>S.role)==='alien'&&await human.evaluate(()=>S.pos)===await human.evaluate(()=>find(T.map,'A')),'a killed Human restarts from the Alien Sector as an Alien');
  await H.waitForFunction(()=>Sync.settings.status==='over',null,{timeout:15000});assert(true,'game over when last human is eliminated');
  for(const p of pages)await p.waitForFunction(()=>document.querySelector('#panel-body').textContent.includes('Game over'),null,{timeout:10000});assert(true,'everyone sees the result');
  const res=await H.evaluate(()=>Sync.settings.result);assert(res.aliensWin===true&&res.reason==='eliminated','aliens win');
  console.log('errors',errs);await b.close();
})();
