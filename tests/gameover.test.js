// The game-over player list never gets wider than the phone, even with long ability text. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 for(const w of [360,320]){
  const ctx=await b.newContext({viewport:{width:w,height:640},serviceWorkers:'block'});await ctx.addInitScript(()=>{window.__botPace=0});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Hot&&T.maps.length>3);
  await p.evaluate(async()=>{await Hot.start(['A','B','C'],'galilei','ultimate','auto',['hard','hard','hard'])});
  await p.waitForTimeout(400);await p.evaluate(()=>{try{closeDlg()}catch(e){}});
  await p.evaluate(()=>{document.querySelectorAll('.plist.rev .pow2').forEach(e=>{e.textContent='Immune to Sensor and Spotlight. Reveals the identity when attacked by anyone.'})});
  const r=await p.evaluate(()=>({w:document.documentElement.clientWidth,rows:[...document.querySelectorAll('.plist.rev li')].map(x=>x.getBoundingClientRect().right)}));
  assert(r.rows.length>=3&&r.rows.every(x=>x<=r.w),w+'px: every player row fits the screen ('+r.rows.map(Math.round).join(',')+')');
  await ctx.close();}
 console.log('errors',errs);await b.close();})();
