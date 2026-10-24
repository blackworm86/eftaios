// the turn slider, impossible noises, the log grouped by turn
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
let ok=0,bad=0;const assert=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);c?ok++:bad++};
(async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:390,height:844}}),errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
 const r=await p.evaluate(()=>{
  S.mode='ultimate';S.turn=6;S.tab='play';
  const L=(who,turn,kind,sector,text)=>S.log.unshift({id:who+turn+kind+sector,by:'',who,turn,kind,text:text||kind,sector:sector||null,at:Date.now(),mine:false});
  const H=find(T.map,'H'),A=find(T.map,'A');let far=null,bd=-1,near=null;
  for(let c=0;c<T.map.cols;c++)for(let rr=0;rr<T.map.rows;rr++){const id=cid(c,rr);if(at(T.map,id)!=='.')continue;const d=Math.min(hexDist(T.map,id,H),hexDist(T.map,id,A));if(d>bd){bd=d;far=id}if(d===3&&!near)near=id}
  L('Ben',1,'noise',far);L('Cal',1,'noise',near);L('Cal',2,'attack',far);L('Cal',3,'noise',far);L('Cal',5,'noise',far);
  DECOYS=findDecoys();
  return {far,near,bd,ids:[...DECOYS]}});
 assert(r.ids.includes('Ben1noise'+r.far),'a noise too far from both start sectors for one turn is flagged impossible');
 assert(!r.ids.includes('Cal1noise'+r.near),'a noise within reach is not flagged');
 assert(!r.ids.includes('Cal3noise'+r.far),'after an attack in that sector the same place is possible');
 assert(!r.ids.includes('Cal5noise'+r.far),'later noises are judged from the last sure position');
 // the slider
 await p.evaluate(()=>{paintOverlay()});
 await p.click('#mkbar [data-act=mkall]');
 assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[2,6]','the slider opens on the last five turns');
 await p.evaluate(()=>{const hi=document.querySelector('#tlbar .hi');hi.value=3;hi.dispatchEvent(new Event('input'))});
 assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[2,3]','dragging the right handle sets the last turn shown');
 await p.evaluate(()=>{setTab('table');T.tableSec='sheet';render()});
 assert(await p.locator('.sheet thead th').count()===3,'the sheet shows only the turns in the range ('+await p.locator('.sheet thead th').count()+')');
 await p.click('#tlbar [data-act=tlnow]');assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[6,6]','Now jumps to the current turn');
 await p.click('#tlbar [data-act=mkall]');assert(await p.evaluate(()=>T.rng)===null,'closing the slider shows the default view again');
 // the log
 await p.evaluate(()=>{T.tableSec='log';render()});
 const heads=await p.locator('ul.log li.turnh').count();assert(heads>=3,'the log has a header for each turn ('+heads+')');
 await p.click('[data-act=logk][data-k=ev]');assert(await p.locator('ul.log li.noise').count()===0&&await p.locator('ul.log li.attack').count()===1,'Only events keeps the attack and drops the noises');
 console.log('errors',errs);await b.close();process.exit(bad?1:0);
})();
