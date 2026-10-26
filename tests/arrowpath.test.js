// Route arrows keep off empty sectors and off other players' markers: they bend around them, and stay straight when nothing is in the way.
const {assert,setup,startTable,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H]=pages;
  await startTable(pages);await begin(pages);
  const r=await H.evaluate(()=>{
    const m=T.map;let found=null;
    for(let c=0;c<m.cols&&!found;c++)for(let r=1;r<m.rows-1&&!found;r++){
      const ty=at(m,cid(c,r));if(ty!=='x'&&ty!==undefined&&ty!=='')continue;
      if(!/^[x ]$/.test(String(m.grid[r][c])))continue;
      const u=m.grid[r-1][c],d=m.grid[r+1][c];if(/^[xHA]$/.test(String(u))||/^[xHA]$/.test(String(d)))continue;
      found=[c,r];
    }
    const [c,r]=found,A=hexPos(m,c,r-1),B=hexPos(m,c,r+1),mid=hexPos(m,c,r);
    const mk=(a,b)=>({a:[a.x,a.y,6],b:[b.x,b.y,6],s:{kind:'move',from:'u',to:'d',t0:1,t:2},curve:false});
    const around=bestBend(m,mk(A,B),[]);
    const near=hexPos(m,c+1,r),n2=hexPos(m,c+1,r+1);   // two neighbours side by side: nothing in between
    const adj=bestBend(m,mk(near,n2),[]);
    return {found,around,adj};
  });
  console.log(JSON.stringify(r));
  assert(r.around!==0,'an arrow over an empty sector bends around it ('+r.around+')');
  assert(r.adj===0,'a move between two neighbouring sectors stays straight');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
