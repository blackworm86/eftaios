// Game over, real routes: the turn slider works and the declared actions show on the route markers.
const {assert,setup,startTable,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H]=pages;
  await startTable(pages);await begin(pages);
  await H.evaluate(()=>{
    const s=S.pos;S.turn=3;S.path=[{pos:s,turn:0},{pos:s,turn:1},{pos:s,turn:2},{pos:s,turn:3}];
    const ids=[];T.map.grid.forEach((row,r)=>row.forEach((c,i)=>{if(c==='.'||c==='s')ids.push(cid(i,r))}));
    S.path[2].pos=ids[0];S.path[3].pos=ids[1];
    S.log.push({id:'z1',turn:3,kind:'silence',text:'secure',who:S.name,mine:true,sector:''});
    Sync.settings.status='over';render();paintOverlay();
  });
  const n=()=>H.evaluate(()=>document.querySelectorAll('#marks .pm.route').length);
  const all=await n();
  await H.click('#mkbar [data-act=mkall]');
  assert(await H.locator('#tlbar:not([hidden])').count()===1,'the turn slider opens at the end of the game');
  await H.evaluate(()=>{T.rng=[3,3];paintOverlay()});
  assert(await n()<all,'the slider narrows the real routes to the chosen turns ('+await n()+' of '+all+')');
  await H.evaluate(()=>{T.rng=[1,3];paintOverlay()});
  assert(await H.evaluate(()=>document.querySelectorAll('#marks .pm.route use').length)>0,'the declared actions show on the markers');
  assert(errs.length===0,'no page errors');
  await b.close();
})();
