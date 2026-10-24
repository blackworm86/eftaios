// Admin Bot tests start an online table with the bots in the lobby and the scenario's roles, characters and cards. Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [H]=pages;
  await H.goto('http://localhost:8123/');await H.fill('#flow-name','Admin');
  await H.evaluate(()=>{Sync.isAdmin=true;S.stage='admin';T.adminTab='bots';T.admin={};renderFlow()});
  await H.click('[data-act=bottest][data-i="3"]');   // test 4: you are the Surge Alien; bots Pilot, Co-pilot, Captain, Brute, Invisible with cards
  await H.waitForSelector('#app:not([hidden])',{timeout:20000});await H.evaluate(()=>closeDlg());
  const r=await H.evaluate(()=>{const hd=Online._hd();return {status:Sync.settings.status,me:S.role+':'+S.char,bots:Object.values(hd.bots).map(x=>x.state.role+':'+x.state.char+':'+x.level+':'+x.state.items.join('+')),n:Object.keys(Sync.players).length}});
  assert(r.status==='playing'&&r.n===6,'the test opens an online table with six seats ('+r.status+', '+r.n+')');
  assert(r.me==='alien:Surge Alien','you get the scenario role and character ('+r.me+')');
  assert(r.bots.includes('human:Co-pilot:hard:cat+mutation+adrenaline')&&r.bots.includes('alien:Invisible Alien:hard:'),'the bots get the scenario characters, levels and cards ('+r.bots.join(' | ')+')');
  // one round: move, end the turn, the bots play theirs on this device
  await H.evaluate(async()=>{const id=[...T.reach.keys()].find(x=>!'1234'.includes(at(T.map,x)))||[...T.reach.keys()][0];selectCell(id);confirmMove();
    if(S.res&&S.res.stage==='choose'&&at(T.map,S.pos)==='.'){await drawSector();if(T.pick){const cb=T.pick.cb;T.pick=null;await cb(S.pos)}}else if(S.res&&S.res.stage==='choose')announce({say:'x'});closeDlg();endTurn()});
  await H.waitForFunction(()=>T.turnState&&T.turnState.n>=2&&T.turnState.uid===Sync.uid,null,{timeout:60000});
  assert(await H.evaluate(()=>S.log.filter(e=>String(e.by).startsWith('bot_')).length)>=3,'the bots play their turns');
  const rec=await H.evaluate(()=>{const g=JSON.parse(JSON.stringify(Admin.ratePanel()?{ok:1}:{}));return {panel:!!Admin.ratePanel(),seats:0}});
  assert(rec.panel,'the rating panel is offered for a bot test table');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
