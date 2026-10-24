// Bots in pass and play: they play whole games, use only public information, and read the table like a player. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx0=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await ctx0.addInitScript(()=>{window.__botPace=0});const p=await ctx0.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');
 // seat 1 a person, seats 2-4 bots of each level
 await p.selectOption('[data-hb="1"]','easy');await p.selectOption('[data-hb="2"]','normal');await p.selectOption('[data-hb="3"]','hard');
 await p.click('[data-act=hotaddbot]');assert(await p.locator('[data-hb]').count()===5&&await p.inputValue('[data-hb="4"]')==='normal','"Add bot" adds a bot seat');
 await p.click('[data-act=hotdel][data-i="4"]');
 await p.click('[data-act=hotstart]');
 assert(await p.locator('#pass:not([hidden])').count()===0,'one person at the device: no hand-over screen');
 const seats=await p.evaluate(()=>JSON.parse(localStorage.getItem('eftaios.hot')).seats.map(s=>s.bot||'person'));
 assert(JSON.stringify(seats)==='["person","easy","normal","hard"]','seats: a person and three bots ('+seats+')');
 await p.evaluate(()=>closeDlg());
 // play the person's turns automatically until the game ends
 const res=await p.evaluate(async()=>{
   for(let k=0;k<60&&!Hot.isOver();k++){
     if(S.over){await Hot.endTurn();continue}
     const id=[...T.reach.keys()].find(x=>!'1234'.includes(at(T.map,x)))||[...T.reach.keys()][0];
     if(id){selectCell(id);confirmMove()}
     if(S.res&&S.res.stage==='choose'&&at(T.map,S.pos)==='.'){await drawSector();if(T.pick){const cb=T.pick.cb;T.pick=null;await cb(S.pos)}}
     else if(S.res&&S.res.stage==='choose')announce({say:'x'});
     closeDlg();if(!Hot.isOver()&&!S.over)await endTurn();
   }
   const H=JSON.parse(localStorage.getItem('eftaios.hot'));
   return {over:Hot.isOver(),turn:H.turn,botLog:H.log.filter(e=>/^h[123]$/.test(e.by)&&['noise','silence','attack','hatch'].includes(e.kind)).length,kinds:[...new Set(H.log.map(e=>e.kind))]};
 });
 assert(res.botLog>=6,'bots announce like players ('+res.botLog+' announcements, kinds: '+res.kinds+')');
 assert(res.over||res.turn>=10,'the game runs on with bots (turn '+res.turn+', over: '+res.over+')');
 // beliefs come from public announcements only
 const bel=await p.evaluate(()=>{
   const view={seats:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'}],turn:5,mode:'ultimate',log:[]};
   const me={id:'a',state:{role:'human'}},L=e=>view.log.unshift(Object.assign({at:Date.now(),text:e.kind},e));
   L({by:'b',turn:2,kind:'attack',sector:'L08'});                                  // an attack without an Attack card: Alien
   L({by:'c',turn:2,kind:'item',text:'adrenaline'});                               // played an item: Human
   const B=Bot.beliefs(view,me);
   return {b:B.b.pA,c:B.c.pA,d:B.d.pA,keys:Object.keys(view.seats[0]).join(',')};
 });
 assert(bel.b>0.9,'an attack with no Attack card marks that player as an Alien ('+bel.b.toFixed(2)+')');
 assert(bel.c<0.2,'playing an item marks that player as a Human ('+bel.c.toFixed(2)+')');
 assert(bel.d>0.3&&bel.d<0.9,'with no evidence a player stays uncertain ('+bel.d.toFixed(2)+')');
 // a Mutation or a shown identity settles a player's side
 const idb=await p.evaluate(()=>{
   const view={seats:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'}],turn:5,mode:'ultimate',log:[]};
   const me={id:'a',state:{role:'human'}},L=e=>view.log.unshift(Object.assign({at:Date.now(),text:e.kind},e));
   L({by:'b',turn:2,kind:'item',text:'mutation'});L({by:'c',turn:2,kind:'reveal',text:'Id|human|Medic'});
   const B=Bot.beliefs(view,me);return {b:B.b.pA,c:B.c.pA};
 });
 const tb=await p.evaluate(()=>{
   const view={seats:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'}],turn:5,mode:'ultimate',log:[]};
   const me={id:'a',state:{role:'human'}},L=e=>view.log.unshift(Object.assign({at:Date.now(),text:e.kind},e));
   L({by:'b',turn:2,kind:'item',text:'teleport'});L({by:'b',turn:2,kind:'attack',sector:'L08'});   // a Blink Alien: a Teleport card, then an attack with no Attack card
   return Bot.beliefs(view,me).b.pA;
 });
 assert(tb>0.8,'an Alien that teleports and then attacks is still read as an Alien ('+tb.toFixed(2)+')');
 assert(idb.b>0.9,'a player who mutates is an Alien ('+idb.b.toFixed(2)+')');
 assert(idb.c<0.1,'a shown Human identity settles that player ('+idb.c.toFixed(2)+')');
 // an attack that hit nobody tells that the others were not in that sector; the number of Aliens at the table is known
 const ns=await p.evaluate(()=>{
   const mk=(X,withAttack)=>{const view={seats:[{id:'a',name:'A'},{id:'c',name:'C'},{id:'b',name:'B'}],turn:3,mode:'ultimate',log:[]};
     const me={id:'a',state:{role:'human'}},L=e=>view.log.unshift(Object.assign({at:Date.now(),text:e.kind},e));
     L({by:'c',turn:2,kind:'noise',sector:'L08'});if(withAttack)L({by:'b',turn:2,kind:'attack',sector:X});   // c moved before b attacked X and was not hit: it was not in X
     const B=Bot.beliefs(view,me,'hard');return Bot.zoneOf(B.c);};
   const top=mk('L08',false).sort((x,y)=>y[1]-x[1])[0][0];
   const get=z=>(z.find(q=>q[0]===top)||[0,0])[1];
   return {top,w:get(mk(top,true)),n:get(mk(top,false))};
 });
 assert(ns.w<ns.n*0.6,'an attack that hit nobody rules the others out of that sector ('+ns.n.toFixed(2)+' -> '+ns.w.toFixed(2)+')');
 const cnt=await p.evaluate(()=>{
   const view={seats:[{id:'a',name:'A'},{id:'b',name:'B'},{id:'c',name:'C'},{id:'d',name:'D'}],turn:3,mode:'ultimate',log:[]};
   const me={id:'a',state:{role:'human'}},L=e=>view.log.unshift(Object.assign({at:Date.now(),text:e.kind},e));
   L({by:'b',turn:2,kind:'attack',sector:'L08'});   // b is an Alien; with 4 players there are 2 Aliens, so one of c and d is the other
   const B=Bot.beliefs(view,me,'hard');return B.c.pA+B.d.pA;
 });
 assert(cnt>0.7&&cnt<1.3,'the two other players share the one remaining Alien ('+cnt.toFixed(2)+')');
 // the bot is handed a public view of the table, never the other seats' private state
 const src=await p.evaluate(()=>Bot.turn.toString());
 assert(!/H\.seats\[[^\]]*\]\.state|\.state\.pos[^=]*others/.test(src),'bot code never reads another seat\'s state');
 // several more full games with only bots after the person is out, to catch errors
 for(let g=0;g<3;g++){
   await p.evaluate(()=>{Hot.clear();resetToWelcome()});await p.click('[data-act=hotsetup]');
   for(let i=1;i<4;i++)await p.selectOption(`[data-hb="${i}"]`,['easy','normal','hard'][(i+g)%3]);
   await p.click('[data-act=hotstart]');await p.waitForTimeout(300);await p.evaluate(()=>closeDlg());
   await p.evaluate(()=>{S.over='dead';S.outSent=false;afterChange()});await p.waitForFunction(()=>Hot.isOver(),null,{timeout:60000});const r=await p.evaluate(()=>({over:Hot.isOver(),res:Hot.result()}));
   assert(r.over,'game '+(g+2)+' finishes with the bots alone ('+JSON.stringify(r.res)+')');
 }
 console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close()})();
