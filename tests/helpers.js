const {chromium}=require('/opt/node22/lib/node_modules/playwright');
exports.assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
exports.setup=async(n,opts={})=>{
  const b=await chromium.launch();const errs=[];
  const ctx=await b.newContext({viewport:{width:390,height:900},serviceWorkers:'block',locale:'en-US'});
  await ctx.addInitScript({path:'tests/fake-firebase.js'});await ctx.addInitScript(()=>{window.__botPace=0});
  await ctx.addInitScript(()=>{const g=Storage.prototype.getItem,st=Storage.prototype.setItem;Storage.prototype.getItem=function(k){return String(k).startsWith('eftaios')?g.call(sessionStorage,k):g.call(this,k)};Storage.prototype.setItem=function(k,v){return String(k).startsWith('eftaios')?st.call(sessionStorage,k,v):st.call(this,k,v)}});
  const pages=[];for(let i=0;i<n;i++){const p=await ctx.newPage();p.on('pageerror',e=>errs.push(i+': '+e.message));p.on('console',m=>m.type()==='error'&&errs.push(i+': '+m.text()));pages.push(p)}
  return {b,ctx,pages,errs};
};
/* host creates a table; others join; everyone readies; host starts. Roles and cards are dealt digitally. opts: mode, map */
exports.startTable=async(pages,{mode='ultimate',map='galilei'}={})=>{
  const [H,...G]=pages;await H.goto('http://localhost:8123/');await H.fill('#flow-name','P0');await H.click('[data-act=hostsetup]');
  await H.click('.mapcard');await H.click(`.gcard[data-id=\"${map}\"]`);await H.click(`[data-f=mode][data-v=${mode}]`);
  await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');const code=await H.textContent('.roomcard b');
  for(let i=0;i<G.length;i++){const p=G[i];await p.goto('http://localhost:8123/?room='+code);await p.fill('#flow-name','P'+(i+1));await p.click('[data-act=joinroom]');await p.waitForSelector('.plist');}
  await H.waitForFunction(n=>document.querySelectorAll('.plist li').length===n,pages.length);
  for(let i=0;i<pages.length;i++){await pages[i].click('[data-act=ready]')}
  await H.waitForFunction(()=>!document.querySelector('.startbtn').disabled);
  return code;
};
exports.begin=async(pages)=>{await pages[0].click('.startbtn');for(const p of pages)await p.waitForSelector('#app:not([hidden])');for(const p of pages)await p.evaluate(()=>{const d=document.querySelector('dialog[open]');if(d)d.close()})};
exports.uidOf=p=>p.evaluate(()=>Sync.uid);
exports.current=async pages=>{const u=await pages[0].evaluate(()=>T.turnState&&T.turnState.uid);for(const p of pages)if(await exports.uidOf(p)===u)return p;return null};
