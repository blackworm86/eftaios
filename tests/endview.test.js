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
  // arrows follow the slider: a step is drawn when both its turns are shown; the start sector counts as turn 1
  await H.evaluate(()=>{S.routesOn=true});
  const arrows=async r=>{await H.evaluate(r=>{T.rng=r;paintOverlay()},r);return H.evaluate(()=>document.querySelectorAll('#marks .routes .rt').length)};
  const a13=await arrows([1,3]),a33=await arrows([3,3]),a23=await arrows([2,3]);
  assert(a13===3&&a33===0&&a23===1,'arrows follow the slider at game end ([1,3] '+a13+', [3,3] '+a33+', [2,3] '+a23+')');
  // a killed player's marker with several icons: nothing overlaps, and the killed badge is visible
  await H.evaluate(()=>{const sec=S.path[3].pos;S.over='dead';S.log.push({id:'z2',turn:3,kind:'noise',text:'noise',who:S.name,mine:true,sector:sec},{id:'z3',turn:3,kind:'item',text:'adrenaline',who:S.name,mine:true,sector:''});T.rng=[1,3];paintOverlay()});
  const boxes=await H.evaluate(()=>[...document.querySelectorAll('#marks .pm.route.mine')].map(g=>[...g.querySelectorAll('use')].map(u=>({h:u.getAttribute('href'),x:+u.getAttribute('x'),y:+u.getAttribute('y'),w:+u.getAttribute('width'),hh:+u.getAttribute('height')}))).sort((a,b)=>b.length-a.length)[0]||[]);
  const hit=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.hh&&b.y<a.y+a.hh;
  let over=0;for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(hit(boxes[i],boxes[j]))over++;
  assert(boxes.length>=4&&boxes.some(b=>b.h==='#gi-killed')&&over===0,'several icons and the killed badge sit side by side, none over another ('+boxes.length+' icons, '+over+' overlaps)');
  const atk=await H.evaluate(()=>{S.log.push({id:'z4',turn:5,kind:'attack',text:'attack',sector:'A01',by:'zz',who:'Zed'});return [stepIcons('u:zz',5,'A01','human'),stepIcons('u:zz',5,'A01','alien')]});
  assert(atk[0][0]==='attack'&&atk[1][0]==='claws','a Human attack shows the Attack card icon, an Alien attack the claws');
  assert(errs.length===0,'no page errors');
  await b.close();
})();
