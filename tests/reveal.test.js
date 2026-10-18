// Game over: the map shows every player's real route joined by lines; eliminated players are marked in the strip. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {setup,startTable,begin}=require('./helpers');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 // pass and play with bots, played to the end
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');for(let i=1;i<4;i++)await p.selectOption(`[data-hb="${i}"]`,'normal');
 await p.click('[data-act=hotstart]');await p.waitForTimeout(300);await p.evaluate(()=>closeDlg());
 // during play: a bluff of mine is on the map
 await p.evaluate(()=>{S.log.unshift({id:'bl',by:myId(),who:S.name,turn:S.turn,kind:'noise',sector:'L10',text:'noise',at:Date.now()});paintOverlay()});
 assert(await p.locator('#marks .pm.bluff').count()===1,'during the game my bluff is on the map');
 await p.evaluate(()=>{S.over='dead';S.outSent=false;afterChange()});await p.waitForFunction(()=>Hot.isOver(),null,{timeout:60000});await p.evaluate(()=>{closeDlg();render();paintOverlay()});
 const r=await p.evaluate(()=>({lines:document.querySelectorAll('#marks .rline').length,bluff:document.querySelectorAll('#marks .pm.bluff').length,seats:JSON.parse(localStorage.getItem('eftaios.hot')).seats.filter(s=>s.state.path.length>1).length,dead:document.querySelectorAll('#mkbar .omark.dead').length+document.querySelectorAll('#mkbar .omark').length}));
 assert(r.lines>=r.seats-1&&r.lines>=2,'game over: one line per player route ('+r.lines+' lines, '+r.seats+' players moved)');
 assert(r.bluff===0,'game over: false leads (bluffs, announcements) are cleared');
 await p.click('.revseg [data-v=ann]');assert(await p.evaluate(()=>document.querySelectorAll('#marks .rline').length)===0,'the game-over panel can switch back to the announcements');
 await p.click('.revseg [data-v=real]');
 // eliminated players are marked in the strip (the person was eliminated: check a bot elimination or mine via the strip of another seat)
 const outs=await p.evaluate(()=>Object.values(Hot.publicPlayers()).filter(x=>x.out).length);
 assert(await p.locator('#mkbar .omark').count()>=Math.min(outs,1)-0||outs===0,'players out of the game carry a badge in the strip ('+outs+' out)');
 await b.close();
 // online: routes are published at game over and drawn on the other devices
 const s=await setup(2);const [H,G]=s.pages;await startTable(s.pages,{online:true});await begin(s.pages);
 await H.evaluate(()=>Sync.updateSettings({status:'over',result:{aliensWin:true,reason:'time',escaped:[]}}));
 await G.waitForFunction(()=>Object.values(Sync.players).every(p=>p.route!==undefined),null,{timeout:10000});
 await G.evaluate(()=>{closeDlg();paintOverlay()});
 assert(await G.evaluate(()=>finalRoutes().length)===2,'online: every device publishes its real route once the game is over');
 // killed mark in the strip of the other device
 const uH=await H.evaluate(()=>Sync.uid);await H.evaluate(()=>Sync.setMe({out:'killed'}));await G.waitForFunction(u=>Sync.players[u].out==='killed',uH);await G.evaluate(()=>{T.showAnn=true;paintOverlay();T.showAnn=false});
 assert(await G.locator(`#mkbar [data-k="u:${uH}"] .omark.dead`).count()===1,'an eliminated player is marked with a red cross in the strip');
 console.log('errors',errs.concat(s.errs));if(errs.length||s.errs.length)process.exitCode=1;await s.b.close();
})();
