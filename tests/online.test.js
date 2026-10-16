// Digital cards: dealing, decks/reshuffle, items, attack, defense, spotlight, game over. Static server on :8123.
const {assert,setup,startTable,begin,current,uidOf}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(3);const [H,P1,P2]=pages;
  await startTable(pages,{online:true,mode:'advanced'});
  assert((await H.textContent('#flow-card')).includes('Digital'),'lobby shows digital cards');
  assert(await H.locator('[data-act=faction]').count()===0,'no manual faction pick in digital mode');
  await begin(pages);
  const roles=await Promise.all(pages.map(p=>p.evaluate(()=>S.role)));
  assert(roles.filter(r=>r==='human').length===1&&roles.filter(r=>r==='alien').length===2,'3 players: 1 human, 2 aliens ('+roles+')');
  const chars=await Promise.all(pages.map(p=>p.evaluate(()=>S.char)));assert(chars.every(Boolean)&&new Set(chars).size===3,'each player has a distinct character card');
  const sec=await H.evaluate(()=>Sync.get('secret/'+Sync.uid));assert(sec&&sec.role===roles[0],'host sees own secret');
  const leak=await P1.evaluate(()=>Sync.get('secret/'+Sync.uid));assert(leak&&leak.role===roles[1],'guest reads own secret');
  await H.waitForFunction(()=>T.counts&&T.counts.sector);
  const c0=await H.evaluate(()=>T.counts);assert(c0.sector.d===25&&c0.item.d===12&&c0.hatch.d===6,'decks sized 25/12/6');
  // ---- draw a sector card through the UI
  const cur=await current(pages);
  await cur.evaluate(()=>{S.pos='L09';S.phase='move';T.sel=null;refreshReach();render()});
  const dest=await cur.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));await cur.evaluate(i=>selectCell(i),dest);await cur.click('[data-act=confirm]');
  await cur.click('[data-act=drawcard]');
  await cur.waitForFunction(()=>S.res&&(S.res.stage==='done'||T.pick),null,{timeout:15000});
  if(await cur.evaluate(()=>!!T.pick)){await cur.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('K09')})}
  await cur.waitForFunction(()=>S.res&&S.res.stage==='done',null,{timeout:15000});
  await H.waitForFunction(()=>T.counts.sector.d===24&&T.counts.sector.x===1);assert(true,'sector card drawn and discarded: 24 left, 1 discarded');
  assert((await cur.evaluate(()=>S.log[0].kind))!==undefined&&await cur.evaluate(()=>S.log.some(e=>['noise','silence'].includes(e.kind))),'card result announced automatically');
  // ---- reshuffle
  for(let i=0;i<24;i++)await H.evaluate(()=>Online.request('sector'));
  await H.waitForFunction(()=>T.counts.sector.d===0&&T.counts.sector.x===25,null,{timeout:20000});assert(true,'sector deck empty after 25 draws');
  await H.evaluate(()=>Online.request('sector'));
  await H.waitForFunction(()=>T.counts.sector.d===24&&T.counts.sector.x===1,null,{timeout:10000});assert(true,'empty deck reshuffles the discards into a new deck');
  await H.waitForFunction(()=>S.log.some(e=>e.text==='Sector deck reshuffled'));assert(true,'reshuffle logged for everyone');
  // item deck: all 12 items exist exactly once per quantity
  await new Promise(r=>setTimeout(r,500));
  const left=await H.evaluate(()=>T.counts.item.d);const items=[];for(let i=0;i<left;i++){const r=await H.evaluate(()=>Online.request('item'));items.push(r.card)}
  for(const p of pages)items.push(...await p.evaluate(()=>S.items));
  const cnt=k=>items.filter(x=>x===k).length;
  assert(cnt('attack')===2&&cnt('teleport')===2&&cnt('adrenaline')===2&&cnt('sedatives')===3&&cnt('spotlight')===2&&cnt('defense')===1,'item deck composition correct');
  const none=await H.evaluate(()=>Online.request('item'));assert(!none.card,'no item left when all are in hands');
  // ---- attack & defense
  const idx=roles.indexOf('human'),human=pages[idx],aliens=pages.filter((_,i)=>roles[i]==='alien');
  await human.evaluate(()=>{S.items=['defense'];S.pos='K09';save()});
  for(const a of aliens)await a.evaluate(()=>{S.pos='K09'});
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
  assert(/was eliminated/.test(rep2),'second attack eliminates the human');
  assert(await human.evaluate(()=>S.over)==='dead','human is out');
  await H.waitForFunction(()=>Sync.settings.status==='over',null,{timeout:15000});assert(true,'game over when last human is eliminated');
  for(const p of pages)await p.waitForFunction(()=>document.querySelector('#panel-body').textContent.includes('Game over'),null,{timeout:10000});assert(true,'everyone sees the result');
  const res=await H.evaluate(()=>Sync.settings.result);assert(res.aliensWin===true&&res.reason==='eliminated','aliens win');
  console.log('errors',errs);await b.close();
})();
