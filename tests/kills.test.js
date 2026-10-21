// Kills are recorded: every player marked dead has a "killed" log entry, and every killed log entry has a dead player.
// Pass-and-play games with bots (where attacks happen). Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext({viewport:{width:360,height:640},serviceWorkers:'block'});await ctx.addInitScript(()=>{window.__botPace=0});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Hot&&T.maps.length>3);
 let deadSeats=0, loggedKills=0, bad=[];
 for(let g=0;g<12;g++){
  const r=await p.evaluate(async()=>{await Hot.start(['A','B','C','D','E'],'galilei','ultimate','auto',['hard','normal','hard','easy','normal']);
    const d=Hot.dump();
    const byId=Object.fromEntries(d.seats.map(s=>[s.id,s]));
    // a kill entry (a player eliminated, or a Human restarting as an Alien): the player must be marked dead, or reborn
    const kills=d.log.filter(e=>e.kind==='out'&&/^killed\|/.test(String(e.text))).map(e=>({who:e.who,by:e.by,ok:!!byId[e.by]&&(byId[e.by].over==='dead'||byId[e.by].reborn)}));
    const dead=d.seats.filter(s=>s.over==='dead').map(s=>s.id);
    const logged=d.log.filter(e=>e.kind==='out'&&/^killed\|/.test(String(e.text))).map(e=>e.by);
    return {kills,dead,logged,result:!!d.result};});
  assert(r.result,'game '+(g+1)+' finishes');
  deadSeats+=r.dead.length; loggedKills+=r.kills.length;
  r.kills.filter(k=>!k.ok).forEach(k=>bad.push('kill logged but not marked dead: '+k.who));
  r.dead.forEach(id=>{ if(!r.logged.includes(id)) bad.push('marked dead without a log entry: '+id); });
 }
 assert(bad.length===0,'every killed player is marked dead and logged ('+bad.slice(0,3).join('; ')+')');
 console.log('dead seats',deadSeats,'logged kills',loggedKills);
 assert(errs.length===0,'no page errors');
 await b.close();})();
