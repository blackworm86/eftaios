// The real Firebase sign-in code (the SDK files from node_modules stand in for the CDN, same version) on an iPhone-like browser:
// start-up must finish quickly and a wrong password must come back as an error, never hang. Needs no account.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const fs=require('fs');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();
 const ctx=await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block',userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'});
 await ctx.route('https://www.gstatic.com/firebasejs/*/*.js',r=>{const f='node_modules/firebase/'+r.request().url().split('/').pop();fs.existsSync(f)?r.fulfill({status:200,contentType:'text/javascript',body:fs.readFileSync(f)}):r.abort()});
 const p=await ctx.newPage();await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Sync&&Sync.enabled,null,{timeout:10000});
 const r=await p.evaluate(async()=>{const t0=Date.now();let up='';try{await Promise.race([Sync.ensure(true),new Promise((_,j)=>setTimeout(()=>j(new Error('hung')),9000))]);up='ready'}catch(e){up=e.message}
  const ms=Date.now()-t0;let sign='';try{await Promise.race([Sync.signInEmail('nobody@example.com','wrongpass1'),new Promise((_,j)=>setTimeout(()=>j(new Error('hung')),9000))]);sign='signed in'}catch(e){sign=e.code||e.message}
  return {up,ms,sign,authReady:Sync.authReady,inApp:Sync.inAppBrowser()}});
 assert(r.up==='ready'&&r.authReady&&r.ms<6000,'sign-in start-up finishes without hanging ('+r.up+', '+r.ms+' ms)');
 assert(r.sign!=='hung'&&r.sign!=='signed in','a wrong password comes back as an error, not a hang ('+r.sign+')');
 assert(r.inApp===false,'Safari itself is not treated as an in-app browser');
 const inapp=await ctx.newPage();await inapp.addInitScript(()=>Object.defineProperty(navigator,'userAgent',{get:()=>'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0'}));
 await inapp.goto('http://localhost:8123/');await inapp.waitForFunction(()=>window.Sync&&Sync.enabled,null,{timeout:10000});
 assert(await inapp.evaluate(()=>Sync.inAppBrowser()),'an in-app browser (Instagram) is recognised');
 await b.close()})();
