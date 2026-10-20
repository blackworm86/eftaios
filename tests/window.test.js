// The turns button shows the last N known steps of every player (yours too); following a player centers their markers; arrows are solid at game over. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:900,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 await p.evaluate(()=>{const L=(who,turn,kind,sector)=>S.log.unshift({id:Math.random()+'',who,turn,kind,sector,text:kind,at:Date.now()+turn,mine:false});
  const BOB=['I06','I07','J07','J08','K08','K09'],CAL=['M05','M06','N06','N07','O07','O08'];
  BOB.forEach((s,i)=>L('Bob',i+1,'noise',s));CAL.forEach((s,i)=>L('Cal',i+1,'noise',s));
  // my own route: six different sectors
  S.path=[{turn:0,pos:S.pos}];['K10','K11','L11','L12','M12','M13'].forEach((s,i)=>S.path.push({turn:i+1,pos:s}));S.pos='M13';S.turn=6;S.mkN=1;save();paintOverlay()});
 const marks=()=>p.evaluate(()=>document.querySelectorAll('#marks .pm').length);
 assert(await marks()===3,'1 turn: the last step of every player, mine included ('+await marks()+' markers)');
 await p.evaluate(()=>{S.mkN=3;paintOverlay()});assert(await marks()===9,'3 turns: the last three steps of everybody');
 await p.evaluate(()=>{S.mkN=0;paintOverlay()});assert(await marks()===6+6+7,'all turns: everything');
 // arrows follow the same window
 await p.evaluate(()=>{S.mkN=1;S.routesOn=true;paintOverlay()});
 assert(await p.evaluate(()=>document.querySelectorAll('#marks .routes .rt').length)===3,'1 turn: one arrow per player, the last move');
 await p.evaluate(()=>{S.mkN=3;paintOverlay()});assert(await p.evaluate(()=>document.querySelectorAll('#marks .routes .rt').length)===9,'3 turns: the last three moves of everybody');
 // following a player: only them, each marker in the middle of its sector
 await p.evaluate(()=>{S.mkN=0;follow('n:bob');});
 const f=await p.evaluate(()=>{const ms=[...document.querySelectorAll('#marks .pm')];return {n:ms.length,centered:ms.every(m=>{const t=m.getAttribute('transform').match(/translate\(([-\d.]+) ([-\d.]+)\)/);return ['I06','I07','J07','J08','K08','K09'].some(id=>{const q=parseId(id),h=hexPos(T.map,q[0],q[1]);return Math.abs(h.x-t[1])<.6&&Math.abs(h.y-t[2])<.6})})}});
 assert(f.n===6&&f.centered,'following a player shows only their markers, centered in each sector');
 await p.evaluate(()=>follow(null));
 // game over: every arrow is solid
 await p.evaluate(()=>{S.turn=40;const routes=[{key:'me',path:S.path},{key:'n:bob',path:[{turn:1,pos:'I06'},{turn:2,pos:'I07'},{turn:3,pos:'J07'}]}];const hp=sec=>{const q=parseId(sec);return hexPos(T.map,q[0],q[1])};const m=document.querySelector('#marks');m.textContent='';paintRoutes(routes,null,hp,m)});
 const ops=await p.evaluate(()=>[...document.querySelectorAll('#marks .routes .rt')].map(g=>g.getAttribute('opacity')));
 assert(ops.length>=5&&ops.every(o=>o==='1.00'),'at game over the arrows are solid for everybody ('+ops.join(',')+')');
 console.log('errors',errs);await b.close();})();
