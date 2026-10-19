// Pass and play on one device. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const SS='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:820},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');
 assert(await p.locator('[data-hn]').count()===4,'setup starts with 4 player names');
 await p.click('[data-act=hotdel][data-i="3"]');await p.fill('[data-hn="0"]','Ann');await p.fill('[data-hn="1"]','Ben');await p.fill('[data-hn="2"]','Cal');
 await p.screenshot({path:SS+'/h-setup.png'});
 await p.click('[data-act=hotstart]');
 assert(await p.locator('#pass:not([hidden])').count()===1&&(await p.textContent('#pass')).includes('Ann'),'hand-over screen asks for the first player');
 await p.screenshot({path:SS+'/h-pass.png'});
 await p.click('[data-act=hotgo]');
 assert(await p.locator('dialog[open]').count()===1&&/Human|Alien/.test(await p.textContent('dialog')),'first turn shows the secret role privately');
 await p.click('#d-no');
 const roles=await p.evaluate(()=>JSON.parse(localStorage.getItem('eftaios.hot')).seats.map(s=>s.role0));
 assert(roles.filter(r=>r==='human').length===1&&roles.length===3,'roles dealt: 1 human, 2 aliens ('+roles+')');
 // Ann moves to a dangerous sector and draws a card
 const go=async()=>{const id=await p.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));await p.evaluate(i=>selectCell(i),id);await p.click('[data-act=confirm]');return id};
 await p.evaluate(()=>{S.ab={Captain:1}});
 const annPos=await go();await p.click('[data-act=drawcard]');
 await p.waitForFunction(()=>(S.res&&S.res.stage==='done')||T.pick);if(await p.evaluate(()=>!!T.pick))await p.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('M10')});
 await p.waitForFunction(()=>S.res&&S.res.stage==='done');
 assert(await p.evaluate(()=>T.counts.sector.d)===76,'card drawn from the shared deck');
 await p.screenshot({path:SS+'/h-play.png'});
 await p.click('[data-act=next]');
 assert((await p.textContent('#pass')).includes('Ben')&&await p.locator('#pass:not([hidden])').count()===1,'turn passes to Ben behind the hand-over screen');
 await p.click('[data-act=hotgo]');await p.click('#d-no');
 assert(await p.evaluate(()=>S.name)==='Ben'&&await p.evaluate(()=>S.path.length)===1,'Ben sees his own fresh route, not Ann\'s');
 assert(await p.evaluate(()=>S.log.some(e=>e.kind==='noise'||e.kind==='silence')),'public announcements are shared');
 // Ben attacks Ann's sector (force positions)
 await p.evaluate(a=>{S.role='alien';S.pos=a;const H=JSON.parse(localStorage.getItem('eftaios.hot'));},annPos);
 const r=await p.evaluate(()=>Hot.attack(S.pos));
 assert(r.hits.length===1&&r.hits[0].name==='Ann','attack hits the player standing in that sector');
 if(await p.evaluate(()=>Hot.isOver())){await p.evaluate(()=>render());assert(await p.evaluate(()=>Hot.result().aliensWin)&&(await p.textContent('#panel-body')).includes('Game over'),'killing the only Human ends the game: Aliens win');await p.screenshot({path:SS+'/h-over.png'});await p.click('#panel-body [data-act=newgame]');await p.click('#d-yes');assert(await p.evaluate(()=>!S.hot&&!localStorage.getItem('eftaios.hot')),'new game clears the pass-and-play game');console.log('errors',errs);await b.close();return;}
 await p.evaluate(()=>{S.phase='resolve';S.res={stage:'done',say:'x'};render()});await p.click('[data-act=next]');
 await p.click('[data-act=hotgo]');await p.click('#d-no').catch(()=>{});
 assert(await p.evaluate(()=>S.name)==='Cal','Cal is next');
 await p.evaluate(()=>{S.phase='resolve';S.res={stage:'done',say:'x'};render()});await p.click('[data-act=next]');
 const next=await p.textContent('#pass').catch(()=>'');
 const annOut=await p.evaluate(()=>JSON.parse(localStorage.getItem('eftaios.hot')).seats[0].state.over);
 if(annOut==='dead'){assert(!next.includes('Ann'),'eliminated player is skipped');}
 else{assert(next.includes('Ann'),'Ann (saved by Defense / infection) plays again');await p.click('[data-act=hotgo]');assert(/attacked/.test(await p.textContent('dialog')),'victim is told what happened on their next turn');await p.click('#d-no');}
 // reload keeps the game and the privacy screen
 await p.reload();await p.waitForTimeout(400);
 assert(await p.evaluate(()=>S.hot)===true,'pass-and-play survives a reload');
 // game over: kill all humans
 const over=await p.evaluate(()=>{const H=JSON.parse(localStorage.getItem('eftaios.hot'));return H.result});
 const hpos=await p.evaluate(()=>{const H=JSON.parse(localStorage.getItem('eftaios.hot'));const h=H.seats.find(x=>x.role0==='human'&&!x.state.over);return h&&h.id!==H.seats[H.cur].id?h.state.pos:null});
 if(hpos){await p.evaluate(()=>{if(!document.querySelector('#pass').hidden)Hot.go();closeDlg()});await p.evaluate(h=>{S.pos=h;return Hot.attack(h)},hpos);await p.evaluate(()=>render());
  assert(await p.evaluate(()=>Hot.isOver()&&Hot.result().aliensWin),'last human eliminated: Aliens win');
  assert((await p.textContent('#panel-body')).includes('Game over'),'result screen shown with roles');await p.screenshot({path:SS+'/h-over.png'});
  await p.click('#panel-body [data-act=newgame]');await p.click('#d-yes');assert(await p.evaluate(()=>!S.hot&&!localStorage.getItem('eftaios.hot')),'new game clears the pass-and-play game');}
 console.log('errors',errs);await b.close()})()
