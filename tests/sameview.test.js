// The map looks the same with the turn slider open on a span and with it closed on the number of turns you chose.
const {assert,setup,startTable,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H]=pages;
  await startTable(pages);await begin(pages);
  const r=await H.evaluate(()=>{
    const ids=[];T.map.grid.forEach((row,r)=>row.forEach((c,i)=>{if(c==='.'||c==='s')ids.push(cid(i,r))}));
    S.turn=6;S.path=[{pos:ids[0],turn:0},...[1,2,3,4,5,6].map(n=>({pos:ids[n],turn:n}))];S.routesOn=true;
    const count=()=>({marks:document.querySelectorAll('#marks .pm').length,arrows:document.querySelectorAll('#marks .routes .rt').length,solid:[...document.querySelectorAll('#marks .routes .rt')].every(g=>g.getAttribute('opacity')==='1.00')});
    T.rng=[5,6];paintOverlay();const open=count();
    T.rng=null;S.mkN=2;paintOverlay();const closed=count();
    S.mkN=0;paintOverlay();const all=count();
    return {open,closed,all};
  });
  console.log(JSON.stringify(r));
  assert(r.open.marks>0&&r.open.arrows>0,'the open slider shows markers and arrows');
  assert(r.open.marks===r.closed.marks&&r.open.arrows===r.closed.arrows&&r.closed.solid,'closed on 2 turns it shows the same markers and arrows as the open span');
  assert(r.all.marks>r.closed.marks&&r.all.arrows>r.closed.arrows,'"All" shows more than 2 turns');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
