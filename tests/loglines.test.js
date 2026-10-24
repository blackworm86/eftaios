// What the log says about kills, escapes and Spotlight: wording, the sector, and the order of cause and effect.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch(),errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
 const r=await p.evaluate(()=>{
  const L=(who,turn,kind,text,sector)=>({id:who+turn+kind+text,by:'',who,turn,kind,text,sector:sector||null,at:Date.now(),mine:false});
  const kill=L('Ann',5,'info','kill|Bob|human','J09'),out=L('Bob',5,'out','killed|human|Pilot'),esc=L('Cy',6,'out','escaped|human|Captain'),spot=L('Dee',7,'spot','spot','K10'),dead=L('Eli',8,'out','killed|alien|Brute Alien');
  const order=killFirst([kill,out]).map(e=>e.kind);   // newest first: the kill arrived after the elimination
  return {kill:entryText(kill),out:entryText(out),esc:entryText(esc),spot:entryText(spot),dead:entryText(dead),order}});
 assert(/killed Bob \(Human\) in Sector J09/.test(r.kill),'a kill line names the victim, the faction and the sector ('+r.kill+')');
 assert(/eliminated \(Human, Pilot\).*restarts as an Alien/.test(r.out),'a killed Human is said to restart as an Alien ('+r.out+')');
 assert(!/restarts/.test(r.dead),'a killed Alien does not restart');
 assert(/escaped \(Human, Captain\)/.test(r.esc),'an escape says who escaped');
 assert(/Spotlight on Sector K10/.test(r.spot),'Spotlight names its sector');
 assert(r.order.join()==='out,info','the elimination is listed above the kill that caused it (cause first when read from the bottom)');
 console.log('errors',errs);await b.close()})();
