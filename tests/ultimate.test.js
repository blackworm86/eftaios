// Ultimate Edition rules on one device (pass and play): killed Humans, Clone, pods, Cat, Mutation, abilities. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:820},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');
 assert(await p.evaluate(()=>MAX_TURN)===40,'40 turns');
 assert(await p.evaluate(()=>SECTOR_DECK.length===77&&HATCH_DECK.length===5&&Object.keys(ITEMS).length===10&&CHARS.human.length===8&&CHARS.alien.length===8),'77 sector cards, 5 pod cards, 10 items, 16 characters');
 // pure rule checks on resolveHit
 const r=await p.evaluate(()=>{
   T.map=T.maps[0];const out={};const mk=o=>Object.assign({role:'human',char:'Pilot',items:[],pos:'K09',path:[],fed:false},o);
   out.kill=resolveHit(mk(),'ultimate',3);
   let s=mk({items:['clone','silence']});out.clone=resolveHit(s,'ultimate',3);out.cloneState=[s.role,s.pos,s.items.length];
   s=mk({items:['defense','clone']});out.def=resolveHit(s,'ultimate',3);out.defLeft=s.items.join();
   s=mk({role:'alien',char:'Brute Alien'});out.brute=resolveHit(s,'ultimate',3);
   s=mk({role:'alien',char:'Brute Alien'});out.bruteBasic=resolveHit(s,'basic',3);
   s=mk({role:'human',items:['attack'],char:'Captain'});resolveHit(s,'ultimate',3);out.reborn=[s.role,s.pos,s.items.length,s.reborn,abilOf(s,'ultimate')];
   s=mk({pos:find(T.map,'1')||'B02'});out.pod=resolveHit(s,'ultimate',3);
   return out;});
 assert(r.kill.killed&&r.kill.conv,'a killed Human is reborn');
 await p.evaluate(()=>{T.map=T.maps[0]});assert(r.clone.clone&&r.cloneState[0]==='human'&&r.cloneState[1]===await p.evaluate(()=>find(T.map,'H'))&&r.cloneState[2]===0,'Clone: survive, Human sector, hand dropped');
 assert(r.def.def&&r.defLeft==='clone','Defense is used before Clone');
 assert(r.brute.reveal&&!r.bruteBasic.reveal,'Brute is immune and revealed (Ultimate only)');
 assert(r.reborn[0]==='alien'&&r.reborn[1]===await p.evaluate(()=>find(T.map,'A'))&&r.reborn[2]===0&&r.reborn[3]&&r.reborn[4]==='','reborn: Alien Sector, no items, no abilities');
 assert(r.pod.immune,'nobody can be attacked in a damaged pod');
 assert(await p.evaluate(()=>startSector(T.map,'human','Psychologist','ultimate')===find(T.map,'A')&&startSector(T.map,'human','Psychologist','basic')===find(T.map,'H')),'the Psychologist starts in the Alien Sector (Ultimate only)');
 // the Engineer keeps the better pod card and shuffles the other back
 const eng=await p.evaluate(()=>{const d={draw:['red','green'],disc:[]};const r=drawPod(d,true);return [r.card,d.draw.length]});
 assert(eng[0]==='green'&&eng[1]===1,'Engineer: picks green, the other card goes back');
 // pass and play: a Cat plays two noises
 await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
 await p.evaluate(()=>{S.role='human';S.char='Medic';S.items=['cat'];S.pos='K10';S.phase='resolve';S.res={stage:'choose'};render()});
 await p.click('[data-act=itemdlg][data-i=cat]');await p.click('dialog [data-act=useitem]');
 assert(await p.evaluate(()=>S.cat)===true,'Cat is armed before drawing');
 await p.evaluate(()=>{window.__rng=()=>0.5});
 await p.click('[data-act=drawcard]');
 await p.waitForFunction(()=>T.pick||(S.res&&S.res.stage==='done'));
 for(let i=0;i<2&&await p.evaluate(()=>!!T.pick);i++)await p.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('M10')});
 await p.waitForFunction(()=>S.res&&S.res.stage==='done');
 assert(await p.evaluate(()=>S.log.filter(e=>e.kind==='noise').length)>=2||await p.evaluate(()=>S.res.say.includes('Sectors')),'two noises announced');
 // Mutation
 await p.evaluate(()=>{S.items=['mutation'];S.phase='resolve';S.res={stage:'choose'};S.pos='K09';render()});
 await p.click('[data-act=itemdlg][data-i=mutation]');await p.click('dialog [data-act=useitem]');await p.click('#d-yes');
 assert(await p.evaluate(()=>S.role==='alien'&&S.pos==='K09'&&S.reborn),'Mutation: Alien in place, no abilities');
 console.log('errors',errs);await b.close();})();
