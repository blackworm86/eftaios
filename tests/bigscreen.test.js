// From 1600 px the panel, top bar and map controls grow 20%; below it nothing changes. The scaled strip still works.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch(),errs=[];
 for(const [w,h,big] of [[1920,1080,true],[1366,768,false]]){
  const p=await (await b.newContext({viewport:{width:w,height:h},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
  await p.evaluate(()=>{const H=JSON.parse(localStorage.getItem('eftaios.hot'));H.seats.slice(1).forEach((s,i)=>S.log.unshift({id:'z'+i,by:s.id,who:s.name,turn:1,kind:'noise',sector:['K10','M10'][i]||'K11',text:'noise',at:Date.now()}));render();paintOverlay()});
  const m=await p.evaluate(()=>({z:getComputedStyle(document.querySelector('#panel')).zoom,tf:getComputedStyle(document.querySelector('#mkbar')).transform,hs:document.documentElement.scrollWidth>innerWidth+1,pw:document.querySelector('#panel').getBoundingClientRect().width}));
  assert(big?(+m.z===1.2&&m.tf.startsWith('matrix(1.2')):(+m.z===1&&m.tf==='none'),w+'px: panel and strip are '+(big?'scaled 20%':'at their normal size')+' (zoom '+m.z+', strip '+m.tf+')');
  assert(!m.hs,w+'px: no sideways scroll');
  assert(big?m.pw>520&&m.pw<620:m.pw<=480,w+'px: the panel is '+Math.round(m.pw)+' px wide');
  const k=await p.evaluate(()=>document.querySelector('#mkbar [data-act=pguess]')&&document.querySelector('#mkbar [data-act=pguess]').dataset.k);
  if(k){await p.click(`#mkbar [data-act=pguess][data-k="${k}"]`);
   const g=await p.evaluate(()=>{const g=document.querySelector('#guesspop'),s=document.querySelector('#stage').getBoundingClientRect(),q=document.querySelector('#mkbar [data-act=pguess]').getBoundingClientRect();if(!g)return null;const r=g.getBoundingClientRect();return {inside:r.left>=s.left&&r.right<=s.right+1&&r.top>=s.top&&r.bottom<=s.bottom+1,beside:Math.abs((r.top+r.height/2)-(q.top+q.height/2))<80&&r.left>=q.right-4}});
   assert(g&&g.inside&&g.beside,w+'px: the guess box opens beside its bubble, inside the map');
   await p.click('#guesspop [data-v=alien]');assert(await p.evaluate(k=>S.sus[k]==='alien',k),w+'px: a guess made on the scaled strip is saved')}
  await p.close()}
 console.log('errors',errs);await b.close()})();
