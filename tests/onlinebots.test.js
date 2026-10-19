// Bots at an online table: the host adds them in the lobby, the host's device plays their turns. Static server on :8123.
const {assert,setup,current}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H,G]=pages;
  await H.goto('http://localhost:8123/');await H.fill('#flow-name','Host');await H.click('[data-act=hostsetup]');
  await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');const code=await H.textContent('.roomcard b');
  await G.goto('http://localhost:8123/?room='+code);await G.fill('#flow-name','Guest');await G.click('[data-act=joinroom]');await G.waitForSelector('.plist');
  await H.click('[data-act=addlobbybot]');await H.waitForFunction(()=>document.querySelectorAll('.plist li').length===3);
  await H.click('[data-act=addlobbybot]');await H.waitForFunction(()=>document.querySelectorAll('.plist li').length===4);
  assert(await H.evaluate(()=>Sync.settings.online===true),'adding a bot switches the table to digital cards');
  assert(await G.locator('.plist li').count()===4&&(await G.textContent('.plist')).includes('Bot 1'),'the guest sees the bots in the lobby');
  await H.selectOption('[data-botlvl]:nth-of-type(1) >> nth=0','hard');
  await H.waitForFunction(()=>Object.values(Sync.players).some(p=>p.bot==='hard'));assert(true,'the host sets a bot level');
  await H.click('[data-act=ready]');await G.click('[data-act=ready]');
  await H.waitForFunction(()=>!document.querySelector('.startbtn').disabled);
  await H.click('.startbtn');for(const p of pages)await p.waitForSelector('#app:not([hidden])');for(const p of pages)await p.evaluate(()=>closeDlg());
  const bots=await H.evaluate(()=>Object.keys(Online._hd().bots));
  assert(bots.length===2&&await H.evaluate(()=>Object.values(Online._hd().bots).every(b=>b.state.role&&b.state.pos)),'bots get a secret role and a position, kept on the host only');
  assert(await G.evaluate(()=>Object.values(Sync.players).every(p=>!p.role)),'nobody sees the bots\' roles');
  // people play quick turns; bots play theirs on the host's device
  for(let k=0;k<14;k++){
    const n=await H.evaluate(()=>T.turnState&&T.turnState.n);if(n>=4||await H.evaluate(()=>Sync.settings.status!=='playing'))break;
    const who=await H.evaluate(()=>T.turnState.uid);
    if(who.startsWith('bot_')){await H.waitForFunction(u=>T.turnState.uid!==u||Sync.settings.status!=='playing',who,{timeout:20000});continue}
    const p=who===await H.evaluate(()=>Sync.uid)?H:G;
    await p.evaluate(async()=>{closeDlg();if(S.over){return}const id=[...T.reach.keys()].find(x=>!'1234'.includes(at(T.map,x)))||[...T.reach.keys()][0];selectCell(id);confirmMove();
      if(S.res&&S.res.stage==='choose'&&at(T.map,S.pos)==='.'){await drawSector();if(T.pick){const cb=T.pick.cb;T.pick=null;await cb(S.pos)}}else if(S.res&&S.res.stage==='choose')announce({say:'x'});closeDlg();endTurn()});
    await H.waitForFunction(u=>T.turnState.uid!==u||Sync.settings.status!=='playing',who,{timeout:20000});
  }
  const st=await G.evaluate(()=>({n:T.turnState&&T.turnState.n,status:Sync.settings.status,botLog:S.log.filter(e=>String(e.by).startsWith('bot_')).length}));
  assert(st.botLog>=2,'bot announcements reach the other devices ('+st.botLog+')');
  assert(st.n>=3||st.status==='over','turns go round with bots in the order (turn '+st.n+', '+st.status+')');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
