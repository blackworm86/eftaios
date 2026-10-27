// How to play: every card, pod, item and Character is listed with its icon, and every sentence has an Italian version.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForSelector('#flow:not([hidden])');
  const r=await P.evaluate(()=>{
    const host=document.createElement('div');host.innerHTML=rulesHtml();
    const lis=[...host.querySelectorAll('.icol li')];
    const strings=[...RULE_CARDS.flatMap(r=>[r[1],r[2]]),...RULE_PODS.flatMap(r=>[r[1],r[2]]),...Object.values(RULE_ITEM_MORE),...Object.values(ITEMS).flat(),...Object.values(ABILITIES),...CHARS.human,...CHARS.alien,...RULES.flatMap(([h,l])=>[h,...l])];
    return {rows:lis.length,iconless:lis.filter(l=>!l.querySelector('svg')).length,names:lis.map(l=>l.querySelector('b').textContent),missing:strings.filter(s=>!IT[s])};
  });
  console.log(JSON.stringify({rows:r.rows,missing:r.missing}));
  assert(r.rows===5+2+10+8+8&&r.iconless===0,'33 entries (cards, pods, items, Characters), each with an icon ('+r.rows+')');
  assert(['Captain','Medic','Brute Alien','Psychic Alien','Teleport','Sensor','Green pod'].every(n=>r.names.includes(n)),'the Characters, Items and pods are listed by name');
  assert(r.missing.length===0,'every rules sentence has an Italian version'+(r.missing.length?': '+r.missing.slice(0,5).join(' | '):''));
  await P.evaluate(()=>{actions.rules()});await P.waitForSelector('#overlay .rsec');
  assert(await P.locator('#overlay .icol li').count()===33,'the How to play sheet shows them');
  // collapsible: two sections open at first, Expand all opens the rest
  const open=()=>P.evaluate(()=>[...document.querySelectorAll('#overlay .rsec')].filter(d=>d.open).length);
  assert(await open()===2,'the sheet opens with the first two sections open');
  await P.click('#rules-all');assert(await open()===9,'Expand all opens every section');
  await P.click('#rules-all');assert(await open()===0,'and Collapse all closes them');
  // search: only matching entries stay, matching sections open, clearing restores the first state
  const vis=()=>P.evaluate(()=>[...document.querySelectorAll('#overlay .icol li')].filter(l=>!l.hidden).map(l=>l.querySelector('b').textContent));
  await P.fill('#rules-q','teleport');const t1=await vis();
  assert(t1.includes('Teleport')&&t1.includes('Co-pilot')&&t1.length<8&&await open()>=1,'searching "teleport" keeps Teleport and the Characters that mention it ('+t1.join(', ')+')');
  await P.fill('#rules-q','zzzz');assert(await P.evaluate(()=>!document.getElementById('rules-none').hidden)&&await P.locator('#overlay .rsec:not([hidden])').count()===0,'a search with no match says so');
  await P.fill('#rules-q','');assert((await vis()).length===33&&await open()===0,'clearing the search brings every entry back and the sections as they were');
  // no sideways scroll on any screen, in either language
  for(const lang of ['en','it'])for(const [w,h] of [[320,568],[360,640],[390,844],[768,1024],[1280,800]]){
    await P.setViewportSize({width:w,height:h});await P.evaluate(l=>{setLang(l);actions.rules();document.querySelectorAll('#overlay .rsec').forEach(d=>d.open=true)},lang);
    const o=await P.evaluate(()=>{const g=document.querySelector('#overlay .gbody');return g.scrollWidth-g.clientWidth});
    assert(o<=0,lang+' '+w+'px: no horizontal scroll ('+o+')');
  }
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
