// the turn slider, impossible noises, the log grouped by turn
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
let ok=0,bad=0;const assert=(c,m)=>{console.log((c?'ok   ':'FAIL ')+m);c?ok++:bad++};
(async()=>{
 const b=await chromium.launch(),p=await b.newPage({viewport:{width:390,height:844}}),errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
 const r=await p.evaluate(()=>{
  S.mode='ultimate';S.turn=6;S.tab='play';
  const L=(who,turn,kind,sector,text)=>S.log.unshift({id:who+turn+kind+(sector||text||''),by:'',who,turn,kind,text:text||kind,sector:sector||null,at:Date.now(),mine:false});
  const H=find(T.map,'H'),A=find(T.map,'A');let far=null,bd=-1,near=null,near2=null;
  for(let c=0;c<T.map.cols;c++)for(let rr=0;rr<T.map.rows;rr++){const id=cid(c,rr);if(at(T.map,id)!=='.')continue;const d=Math.min(hexDist(T.map,id,H),hexDist(T.map,id,A));if(d>bd){bd=d;far=id}if(d===3&&!near)near=id;if(d===2&&!near2)near2=id}
  // chronological order: newest is unshifted last
  L('Ben',1,'noise',far);L('Cal',1,'noise',near2);                       // turn 1: one unreachable, one fine
  L('Dee',2,'noise',near);L('Eli',2,'attack',near);                      // an attack right after, nobody touched
  L('Fay',2,'noise',near);L('Eli',2,'attack',near);L('Fay',2,'out',null,'killed|human|Pilot'); // same, but Fay was hit
  var dt=Math.ceil(hexDist(T.map,near2,far)/3);L('Gus',3,'attack',near2);L('Gus',3+dt+1,'noise',far);L('Hal',3,'attack',near2);L('Hal',3+dt-1,'noise',far); // far from a certain position
  SUGGEST=suggestFakes();
  return {near2,gus:3+dt+1,hal:3+dt-1,far,near,ids:[...SUGGEST.keys()],why:[...SUGGEST.entries()]}});
 const has=id=>r.ids.includes(id);
 assert(has('Ben1noise'+r.far),'turn 1: a noise unreachable from both start sectors is suggested as fake');
 assert(!has('Cal1noise'+r.near2),'turn 1: a reachable noise is not');
 assert(has('Dee2noise'+r.near),'an attack right after in the same sector that touched nobody: suggested fake');
 assert(!has('Fay2noise'+r.near),'...but not when that player was hit by it');
 assert(has('Hal'+r.hal+'noise'+r.far)&&!has('Gus'+r.gus+'noise'+r.far),'far from a certain position in one turn: suggested; three turns later it is reachable');
 // the player decides: marking is kept in the private journal
 await p.evaluate(()=>{setFake('Ben1noise'+arguments[0],'f')},r.far).catch(()=>{});
 await p.evaluate(f=>{setFake('Ben1noise'+f,'f')},r.far);
 assert(await p.evaluate(f=>fakeState('Ben1noise'+f)==='f'&&JSON.parse(journalOf().sus)['~f']['Ben1noise'+f]==='f',r.far),'a mark is saved in the journal');
 assert(await p.evaluate(f=>!suggestFakes().has('Ben1noise'+f),r.far),'a marked declaration is not suggested again');
 await p.evaluate(()=>{setTab('table');render()});assert(await p.locator('.fakeline').count()===1,'the Play box shows how many declarations seem fake');
 await p.click('.fakeline');assert(await p.locator('dialog[open] .fakecard .fk').count()>=1,'tapping it opens the list with the reason for each');
 const before=await p.locator('dialog[open] .fk').count();await p.click('dialog[open] [data-act=fakeno]');
 assert(await p.locator('dialog[open] .fk').count()===before-1||!await p.locator('dialog[open]').count(),'answering one removes it from the list');
 await p.evaluate(()=>closeDlg());
 await p.evaluate(()=>{paintOverlay()});
 // what the table knows about factions and Characters, from the public record only
 const fx=await p.evaluate(()=>{
  S.mode='ultimate';const L=(who,turn,kind,sector,text)=>S.log.unshift({id:'f'+Math.random(),by:'',who,turn,kind,text:text||kind,sector:sector||null,at:Date.now(),mine:false});
  L('Ann',4,'attack','K10');                                            // an attack with no Attack card: an Alien
  L('Bob',4,'item',null,'attack');L('Bob',4,'attack','K11');            // an Attack card: a Human
  L('Cy',4,'reveal',null,'Id|human|Captain');                            // the Captain says so
  L('Dee',4,'noise','K12');L('Dee',4,'noise','K13');                     // two noises and no Cat: the Pilot
  L('Eve',4,'item',null,'cat');L('Eve',4,'noise','K12');L('Eve',4,'noise','K13');   // with a Cat card: nobody in particular
  L('Fox',4,'reveal',null,'Id|human|Soldier');L('Fox',4,'attack','K14');           // the Soldier's attack is shown like a card
  const f=k=>factOf('n:'+k.toLowerCase());
  return {ann:f('Ann').role,bob:f('Bob').role,cy:[f('Cy').role,f('Cy').char],dee:[f('Dee').role,f('Dee').char],eve:f('Eve').char||'',fox:f('Fox').role,txt:entryText(S.log.find(e=>e.who==='Ann'))}});
 assert(fx.ann==='alien'&&/Alien/.test(fx.txt),'an attack with no Attack card marks the attacker as an Alien, in the log text too ('+fx.txt+')');
 assert(fx.bob==='human'&&fx.fox==='human','an Attack card, or the Soldier, marks a Human');
 assert(fx.cy[0]==='human'&&fx.cy[1]==='Captain','the Captain\'s declaration shows who he is');
 assert(fx.dee[1]==='Pilot'&&fx.eve==='','two noises with no Cat card are the Pilot; with a Cat card they prove nothing');
 // the slider
 await p.evaluate(()=>{paintOverlay()});
 await p.evaluate(()=>{S.mkN=0});await p.click('#mkbar [data-act=mkall]');
 assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[1,6]','the slider opens on all the turns');
 const box=await p.evaluate(()=>{const r=document.querySelector('#tlbar .tltrack').getBoundingClientRect();return {x:r.x,w:r.width,y:r.y+15}});
 const px=n=>box.x+(n-1)/5*box.w;   // 6 turns
 const drag=async(x1,x2)=>{await p.mouse.move(x1,box.y);await p.mouse.down();await p.mouse.move((x1+x2)/2,box.y);await p.mouse.move(x2,box.y);await p.mouse.up()};
 await drag(px(6),px(3));
 assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[1,3]','dragging the right handle sets the last turn shown ('+await p.evaluate(()=>JSON.stringify(T.rng))+')');
 await drag(px(1),px(2));assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[2,3]','dragging the left handle sets the first turn');
 await drag((px(2)+px(3))/2,(px(2)+px(3))/2+box.w/5);assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[3,4]','dragging the bar between the handles moves the whole span');
 await p.mouse.click(px(6)-3,box.y);assert(await p.evaluate(()=>T.rng[1])===6,'tapping the track moves the nearest handle');
 await p.evaluate(()=>{T.rng=[2,3];render();paintOverlay()});
 await p.evaluate(()=>{T.rng=[2,3];setTab('table');T.tableSec='sheet';render()});
 assert(await p.locator('.sheet thead th').count()===3,'the sheet shows only the turns in the range ('+await p.locator('.sheet thead th').count()+')');
 await p.click('#tlbar [data-act=tlnow]');assert(await p.evaluate(()=>JSON.stringify(T.rng))==='[6,6]','Now jumps to the current turn');
 await p.click('#tlbar [data-act=mkall]');assert(await p.evaluate(()=>T.rng)===null,'closing the slider shows the default view again');
 // the log
 await p.evaluate(()=>{T.tableSec='log';render()});
 const heads=await p.locator('ul.log li.turnh').count();assert(heads>=3,'the log has a header for each turn ('+heads+')');
 await p.click('[data-act=logk][data-k=ev]');assert(await p.locator('ul.log li.noise').count()===0&&await p.locator('ul.log li.attack').count()>=1,'Only events keeps the attack and drops the noises');
 console.log('errors',errs);await b.close();process.exit(bad?1:0);
})();
