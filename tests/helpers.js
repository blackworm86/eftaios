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

/* spacing guard: stacked blocks under a root keep at least 6px between them; text inside one small card may be tighter than the blocks around it. Run with page.evaluate(measureGaps, rootSelector) */
exports.measureGaps=(rootSel)=>{
  const root=document.querySelector(rootSel||'#flow-card');const out=[];
  const vis=e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return r.height>0&&r.width>0&&s.position!=='absolute'&&s.position!=='fixed'&&s.display!=='none'&&s.visibility!=='hidden'};
  /* a block has a visible box if it draws a border or a background or is a control */
  const boxy=e=>{const s=getComputedStyle(e);return /^(BUTTON|INPUT|SELECT|TEXTAREA|IMG|CANVAS|TABLE)$/.test(e.tagName)||(parseFloat(s.borderTopWidth)>0&&s.borderTopStyle!=='none'&&!/rgba\(.*,\s*0\)/.test(s.borderTopColor))||(parseFloat(s.borderBottomWidth)>0&&s.borderBottomStyle!=='none')||!/rgba\(.*,\s*0\)|transparent/.test(s.backgroundColor)};
  /* does a box show at this edge of the block (the block itself, or a child that sits right at that edge)? */
  const edge=(e,side,d=0)=>{if(boxy(e))return true;if(d>3)return false;const kids=[...e.children].filter(vis);if(!kids.length)return false;const k=side==='bottom'?kids[kids.length-1]:kids[0],r=e.getBoundingClientRect(),q=k.getBoundingClientRect();return (side==='bottom'?r.bottom-q.bottom:q.top-r.top)<3&&edge(k,side,d+1)};
  const inner='.stc,.mapname,.mapcard,.pname,.who,svg,table';   // text inside one card, icon parts and tables are meant to be tight
  const parents=[root,...root.querySelectorAll('*')].filter(p=>p.children.length>1&&!p.closest(inner));
  for(const p of parents){
    const kids=[...p.children].filter(vis).sort((a,b)=>a.getBoundingClientRect().top-b.getBoundingClientRect().top);
    for(let i=1;i<kids.length;i++){
      const a=kids[i-1].getBoundingClientRect(),b=kids[i].getBoundingClientRect();
      const overlap=Math.min(a.right,b.right)-Math.max(a.left,b.left);
      if(overlap<Math.min(a.width,b.width)*0.3)continue;
      if(b.top<a.top+a.height*0.5)continue;   // side by side
      const gap=b.top-a.bottom;
      if(gap<6&&(edge(kids[i-1],'bottom')||edge(kids[i],'top'))){const d=e=>(e.tagName.toLowerCase()+(e.className&&typeof e.className==='string'?'.'+e.className.trim().split(/\s+/).join('.'):'')+(e.dataset&&e.dataset.act?'['+e.dataset.act+']':''));out.push(Math.round(gap)+'px between '+d(kids[i-1])+' and '+d(kids[i])+' in '+d(p))}
    }
  }
  return out;
};
