// The game viewer (Admin > Games): the list (sorted, typed, dated, filtered, paged) and the analysis screen (map, cards and powers, tabs, layers, devices). Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.Viewer&&window.Hot&&T.maps.length>3);
  await P.evaluate(()=>{Sync.isAdmin=true;S.stage='admin';T.adminTab='games';T.admin={};T.vwTried=true;renderFlow()});
  // a list with dates and kinds: two saved games of different days, then the network sample six times (18 games)
  const list=await P.evaluate(async()=>{
    await Hot.start(['A','B','C','D'],'galilei','ultimate','auto',['hard','hard','hard','hard']);
    const dump=Hot.dump();Hot.clear();S.hot=false;S.stage='admin';T.adminTab='games';
    Viewer.useFile(JSON.stringify({game:dump,test:'older',at:Date.UTC(2026,9,20,10,0)}),'a.json');Viewer.useFile(JSON.stringify({game:dump,test:'newer',at:Date.UTC(2026,9,25,18,30)}),'b.json');
    const txt=await (await fetch('tests/viewer-sample.json')).text();for(let k=0;k<6;k++)Viewer.useFile(txt,'sample');
    const rows=[...document.querySelectorAll('.vw-row')];
    return {n:rows.length,first:rows[0].textContent,pager:document.querySelector('.vw-pager').textContent,total:Viewer.state().all.length,nos:Viewer.state().all.map(g=>g.no).sort((a,b)=>a-b).slice(-2)};
  });
  assert(await P.locator('[data-act=vwsrc]').count()===6,'the Games tab offers the six source filters');
  assert(list.n===15,'the list shows 15 games a page ('+list.n+')');
  assert(/Page 1 of 2/.test(list.pager)&&list.total===20,'there is a second page ('+list.pager+')');
  assert(/Network/.test(list.first)||/File/.test(list.first)||/Test/.test(list.first),'each game says what kind it is');
  const order=await P.evaluate(()=>{Viewer.actions.vwsrc({dataset:{s:'file'}});return [...document.querySelectorAll('.vw-row')].map(r=>r.textContent)});
  assert(order.length===2&&/Oct 25/.test(order[0])&&/Oct 20/.test(order[1]),'newest first, with the date ('+order.map(x=>x.slice(0,60)).join(' | ')+')');
  assert(/#2/.test(order[0])&&/#1/.test(order[1]),'a newer game has the bigger number');
  await P.evaluate(()=>{Viewer.actions.vwsrc({dataset:{s:'network'}});const s=document.querySelector('[data-vwf=sort]');s.value='old';s.dispatchEvent(new Event('change',{bubbles:true}))});
  assert(await P.locator('.vw-row').count()===15,'filtering by kind and sorting keep the pages');
  await P.evaluate(()=>{const s=document.querySelector('[data-vwf=n]');s.value='3';s.dispatchEvent(new Event('change',{bubbles:true}))});
  const three=await P.evaluate(()=>[...document.querySelectorAll('.vw-row')].every(r=>/3 players/.test(r.textContent)));
  assert(three,'the table size filter works');
  // the analysis screen
  await P.evaluate(()=>{Viewer.actions.vwsrc({dataset:{s:'all'}});const s=document.querySelector('[data-vwf=n]');s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));const r=document.querySelector('[data-vwf=res]');r.value='';r.dispatchEvent(new Event('change',{bubbles:true}))});
  const opened=await P.evaluate(()=>{const g=Viewer.state().all.find(x=>x.kind==='network'&&x.seats.length===3);Viewer.actions.vwopen({dataset:{no:g.no}});return {no:g.no,svg:!!document.querySelector('#vw-svg')}});
  assert(opened.svg,'a game opens');
  const d=await P.evaluate(()=>{const g=Viewer.state().cur,map=T.maps.find(m=>m.id===g.map);const cells=map.grid.flat().filter(c=>c!=='x').length;
    return {hex:document.querySelectorAll('#vw-svg polygon').length,cells,lines:document.querySelectorAll('#vw-svg line').length,seats:g.seats.length,tabs:document.querySelectorAll('.vw-tabs button').length}});
  assert(d.hex===d.cells,'the map is drawn with all '+d.cells+' sectors');
  assert(d.lines>=1&&d.tabs===5,'routes are drawn and there are five analysis tabs');
  // cards and powers on the map: a played card and a power, put in by hand
  const tags=await P.evaluate(()=>{const g=Viewer.state().cur;g._st=null;g._steps=null;g.log.push({turn:2,seat:0,kind:'item',cell:null,text:'spotlight'},{turn:2,seat:0,kind:'reveal',cell:g.seats[0].route[2].cell,text:'Spotlight'});
    g.seats[1].route.find(p=>p.turn===2).star=1;Viewer.setTurn(2);
    const on=document.querySelectorAll('#vw-svg .vw-pill').length;const cb=document.querySelector('[data-vwl=cards]');cb.checked=false;cb.dispatchEvent(new Event('change',{bubbles:true}));
    const off=document.querySelectorAll('#vw-svg .vw-pill').length;cb.checked=true;cb.dispatchEvent(new Event('change',{bubbles:true}));return {on,off,txt:document.getElementById('vw-g').textContent}});
  assert(tags.on>tags.off&&/Spo/.test(tags.txt)&&/★/.test(tags.txt),'a played card (Spo) and a power (★) show on the map, and the layer can be switched off ('+tags.on+' tags)');
  // one player's turn at a time: the steps follow the turn order, and from one step to the next only the player who acted moves
  const stp=await P.evaluate(()=>{const g=Viewer.state().cur,st=Viewer.steps(g);const ordered=st.every((x,k)=>k===0||x.ord>st[k-1].ord);const seen=[];let worst=0,prev=null;
    for(let k=0;k<st.length;k++){Viewer.setStep(k);const now=new Set([...document.querySelectorAll('#vw-svg .vw-m')].map(c=>c.getAttribute('cx')+','+c.getAttribute('cy')));
      if(prev){let d=0;for(const x of now)if(!prev.has(x))d++;for(const x of prev)if(!now.has(x))d++;worst=Math.max(worst,d)}prev=now}
    Viewer.setStep(3);const lab=document.getElementById('vw-sl').textContent,mode=Viewer.state().mode;const ev=document.querySelectorAll('#vw-ev li').length;Viewer.setTurn(2);
    return {n:st.length,ordered,worst,lab,mode,after:Viewer.state().mode,hasStepSlider:!!document.getElementById('vw-step')}});
  assert(stp.n>=6&&stp.ordered&&stp.hasStepSlider,'there is a step slider and the steps are in turn order ('+stp.n+' steps)');
  assert(stp.worst<=4&&/player/.test(stp.lab)&&stp.mode==='step'&&stp.after==='round','each step changes the map for the acting player only ('+stp.worst+' markers differ at most; "'+stp.lab+'")');
  const tabs=await P.evaluate(()=>{const out={};for(const k of ['players','stats','time','log']){Viewer.actions.vwtab({dataset:{k}});out[k]=document.getElementById('vw-panel').innerHTML.length}
    Viewer.actions.vwtab({dataset:{k:'stats'}});out.rows=document.querySelectorAll('.vw-tab tbody tr').length;Viewer.actions.vwtab({dataset:{k:'time'}});out.tl=document.querySelectorAll('.vw-tl').length;
    Viewer.actions.vwtab({dataset:{k:'log'}});out.log=document.querySelectorAll('.vw-log li').length;Viewer.actions.vwtab({dataset:{k:'turn'}});return out});
  assert(tabs.rows===3&&tabs.tl>=10&&tabs.log>=10,'statistics, timeline and log have content ('+JSON.stringify(tabs)+')');
  const pub=await P.evaluate(()=>{const before=document.querySelectorAll('#vw-svg .vw-m').length;const c=document.getElementById('vw-pub');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));const after=document.querySelectorAll('#vw-svg .vw-m').length;c.checked=false;c.dispatchEvent(new Event('change',{bubbles:true}));return {before,after}});
  assert(pub.before>=2&&pub.after===0,'the table view hides the real positions');
  // moving, zooming, spread markers
  const z=await P.evaluate(()=>{const w0=Viewer.state().vb.w;Viewer.zoom(0.5);const w1=Viewer.state().vb.w;Viewer.zoom(1/0.5);Viewer.setTurn(0);const ms=[...document.querySelectorAll('#vw-svg .vw-m')].map(c=>c.getAttribute('cx')+','+c.getAttribute('cy'));
    return {zoomIn:w1<w0*0.6,markers:ms.length,distinct:new Set(ms).size}});
  assert(z.zoomIn&&z.markers>=2&&z.distinct===z.markers,'zoom works and markers never overlap');
  // devices: no sideways scroll on a phone, two columns on a wide screen
  const fit=async(w,h)=>{await P.setViewportSize({width:w,height:h});await P.waitForTimeout(250);return P.evaluate(()=>{document.querySelector('#flow').hidden=false;renderFlow();const st=document.querySelector('.vw-stage').getBoundingClientRect(),sd=document.querySelector('.vw-side').getBoundingClientRect();return {over:document.documentElement.scrollWidth-innerWidth,flowOver:(document.querySelector('#flow-card')||document.body).scrollWidth-(document.querySelector('#flow-card')||document.body).clientWidth,side:sd.left>=st.right-2,mapW:document.getElementById('vw-svg').getBoundingClientRect().width}})};
  const phone=await fit(360,740),wide=await fit(1280,800);
  assert(phone.over<=1&&phone.flowOver<=1&&!phone.side&&phone.mapW>300,'on a 360 px phone: no sideways scroll, one column, a big map ('+JSON.stringify(phone)+')');
  assert(wide.over<=1&&wide.side&&wide.mapW>600,'on a wide screen: map and panels side by side ('+JSON.stringify(wide)+')');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
