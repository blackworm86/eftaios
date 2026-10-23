// Digital cards, part 2: items, hand limit, hatches, escape ends the game. Static server on :8123.
const {assert,setup,startTable,begin,current}=require('./helpers');const S='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
(async()=>{
  const {b,pages,errs}=await setup(3);const [H,P1,P2]=pages;
  await startTable(pages,{online:true,mode:'ultimate'});
  await H.screenshot({path:S+'/o-lobby.png'});
  await begin(pages);
  const roles=await Promise.all(pages.map(p=>p.evaluate(()=>S.role)));const hi=roles.indexOf('human'),human=pages[hi],others=pages.filter((_,i)=>i!==hi);
  // make it the human's turn
  async function giveTurn(p){const me=await p.evaluate(()=>Sync.uid);const ord=await H.evaluate(()=>Sync.settings.order);const idx=ord.indexOf(me);await H.evaluate(([i,u])=>Sync.setTurn({n:T.turnState.n,idx:i,uid:u}),[idx,me]);await p.waitForFunction(u=>T.turnState.uid===u,me);await p.waitForTimeout(100)}
  await giveTurn(human);
  await human.screenshot({path:S+'/o-move.png'});
  // ---- adrenaline: only before moving, doubles movement
  await human.evaluate(()=>{S.items=['adrenaline','teleport','sedatives'];S.pos='K09';S.phase='move';refreshReach();render()});
  await human.click('[data-act=itemdlg][data-i=adrenaline]');await human.click('dialog [data-act=useitem]');
  assert(await human.evaluate(()=>allowance())===2&&await human.evaluate(()=>S.items.length)===2,'Adrenaline: 2 sectors, card consumed');
  await human.evaluate(()=>{const k=[...T.reach.entries()].find(([id,d])=>d===2&&at(T.map,id)==='.')[0];selectCell(k)});await human.click('[data-act=mpyes]');
  assert(await human.evaluate(()=>S.phase)==='resolve','moved 2 sectors');
  await human.screenshot({path:S+'/o-resolve.png'});
  // ---- sedatives replace the card draw
  const before=await H.evaluate(()=>T.counts.sector.d+T.counts.sector.x);
  await human.evaluate(()=>{S.pos=[...T.reach.keys()][0]||S.pos});
  await human.evaluate(()=>{S.pos='K10';S.res={stage:'choose'};render()});
  await human.click('[data-act=opt][data-k="item:sedatives"]');await human.click('[data-act=optyes]');
  assert(await human.evaluate(()=>S.res.stage)==='done'&&await human.evaluate(()=>S.items.join())==='teleport','Sedatives: no card, card consumed');
  assert(await H.evaluate(()=>T.counts.sector.d+T.counts.sector.x)===before,'no sector card drawn with Sedatives');
  assert(await H.waitForFunction(()=>S.log.some(e=>e.kind==='item'&&e.text==='sedatives'),null,{timeout:5000}).then(()=>true,()=>false),'item use is public');   // the entry reaches the host a moment after the action
  // ---- teleport
  await human.click('[data-act=itemdlg][data-i=teleport]');await human.click('dialog [data-act=useitem]');
  assert(await human.evaluate(()=>S.pos)===await human.evaluate(()=>find(T.map,'H')),'Teleport: back to the Human sector');
  // ---- spotlight reveals positions of players in range
  await human.evaluate(()=>{S.items=['spotlight'];render()});
  await others[0].evaluate(()=>{S.pos='K09';S.char='Surge Alien'});await others[1].evaluate(()=>{S.pos='A14';S.char='Surge Alien'});
  await human.click('[data-act=itemdlg][data-i=spotlight]');await human.click('dialog [data-act=useitem]');
  await human.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('K10')});
  await human.waitForSelector('dialog[open]',{timeout:15000});
  const txt=await human.evaluate(()=>document.querySelector('dialog').textContent);
  assert(txt.includes('K09')&&!txt.includes('A14'),'Spotlight reveals only players in range ('+txt.slice(0,60)+')');
  assert(await H.waitForFunction(()=>S.log.some(e=>e.kind==='reveal'&&e.sector==='K09'),null,{timeout:5000}).then(()=>true,()=>false),'revealed position is public');   // the entry reaches the host a moment after the action
  await human.evaluate(()=>closeDlg());
  // ---- no hand limit in the Ultimate rules
  await human.evaluate(()=>{S.char='Captain';S.items=['attack','attack','defense','cat'];render()});
  await human.evaluate(()=>addItem('adrenaline'));
  assert(await human.evaluate(()=>S.items.length)===5&&await human.locator('.slot').count()===5,'Items are kept without a hand limit');
  // ---- hatch: draw card (green) -> escape ends game for the last human
  await giveTurn(human);
  await human.evaluate(()=>{S.items=[];S.char='Captain';S.pos='B03';S.phase='move';T.sel=null;refreshReach();render()});
  await human.evaluate(()=>{window.__forceCard=null});
  await human.evaluate(()=>selectCell('B02'));await human.click('[data-act=mpyes]');await human.click('[data-act=opt][data-k=pod]');await human.click('[data-act=optyes]');
  await human.waitForFunction(()=>S.over==='escaped'||(S.res&&S.res.stage==='done'),null,{timeout:15000});
  const esc=await human.evaluate(()=>S.over==='escaped');
  console.log('hatch card result:',esc?'green':'red');
  await H.waitForFunction(()=>T.counts.hatch.d+T.counts.hatch.x===4,null,{timeout:10000});assert(true,'one of the 5 pod cards was drawn');
  if(esc){await H.waitForFunction(()=>Sync.settings.status==='over',null,{timeout:15000});const r=await H.evaluate(()=>Sync.settings.result);assert(r.aliensWin===false&&r.escaped.length===1,'last human escaped: Humans win');await human.screenshot({path:S+'/o-over.png'})}
  else{assert(await human.evaluate(()=>S.hatches[1])===1,'red card closes the hatch');}
  await H.click('[data-tab=table]');await H.screenshot({path:S+'/o-table.png'});
  console.log('errors',errs);await b.close();
})();
