// A browser driven by a script never uses the real database (its games would be stored as player games). Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();
  const probe=async(init)=>{const ctx=await b.newContext({serviceWorkers:'block'});if(init)await ctx.addInitScript(init);const p=await ctx.newPage();await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Sync);
    const r=await p.evaluate(()=>({host:location.hostname,ua:/HeadlessChrome/.test(navigator.userAgent),enabled:Sync.enabled}));await ctx.close();return r};
  const plain=await probe(null),real=await probe(()=>{window.__REAL_FB=true}),fake=await probe(()=>{window.__FAKE_FB=async()=>({})});
  assert(plain.enabled===false,'a scripted browser stays offline: no real database ('+JSON.stringify(plain)+')');
  assert(real.enabled===true,'a tool that sets __REAL_FB can still use the live database');
  assert(fake.enabled===true,'the tests keep using the fake database');
  await b.close();
})();
