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
  await P.evaluate(()=>{actions.rules()});await P.waitForSelector('#overlay .icol');
  assert(await P.locator('#overlay .icol li').count()===33,'the How to play sheet shows them');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
