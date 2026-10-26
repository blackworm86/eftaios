// Start screens stay centred in the page and the version line never sits over a control (phone, small phone, desktop).
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch(),errs=[];
 for(const [name,w,h] of [['phone',390,844],['desktop',1280,800],['small phone',360,640]]){
  const ctx=await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'});await ctx.addInitScript({path:'tests/fake-firebase.js'});
  const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8123/');await p.waitForSelector('#flow:not([hidden])');await p.waitForTimeout(300);
  const screens=[['welcome',null],['host setup','[data-act=hostsetup]'],['pass and play','[data-act=hotsetup]']];
  for(const [label,sel] of screens){
   if(sel){await p.goto('http://localhost:8123/');await p.waitForSelector('#flow:not([hidden])');await p.click(sel).catch(()=>{});await p.waitForTimeout(300)}
   const r=await p.evaluate(()=>{const f=document.querySelector('#flow:not([hidden])')||document.querySelector('.screen:not([hidden])');if(!f)return null;const c=(f.querySelector('.setup-card')||f).getBoundingClientRect(),v=document.querySelector('#ver'),vr=v&&!v.hidden&&v.textContent.trim()?v.getBoundingClientRect():null;
    const over=[...f.querySelectorAll('button,input,a,[data-act],label')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&r.height&&vr&&r.left<vr.right&&r.right>vr.left&&r.top<vr.bottom&&r.bottom>vr.top}).map(e=>e.dataset.act||e.tagName);
    return {top:c.top,below:innerHeight-c.bottom,fits:c.height<=innerHeight-8,hscroll:document.documentElement.scrollWidth>innerWidth+1,over}});
   if(!r){assert(false,name+' '+label+': a start screen is shown');continue}
   if(r.fits&&label!=='welcome')assert(Math.abs(r.top-r.below)<=60,name+' '+label+': the card is centred, not pushed to an edge (above '+Math.round(r.top)+', below '+Math.round(r.below)+')');
   assert(!r.hscroll,name+' '+label+': no sideways scroll');
   assert(!r.over.length,name+' '+label+': the version line is not over a control'+(r.over.length?' ('+r.over+')':''));
  }
  await ctx.close()}
 console.log('errors',errs);await b.close()})();
