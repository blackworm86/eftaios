// Start sectors and Escape Pod sectors are safe zones: an attack harms nobody standing there. Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.Hot&&T.maps.length>3);
  const r=await P.evaluate(()=>{T.map=T.maps.find(m=>m.id==='galilei');const hit=(role,pos)=>resolveHit({role,pos,items:[],char:'',path:[]},'ultimate',3);
    const danger=T.map.grid.flat().includes('.')?(()=>{for(let r=0;r<T.map.rows;r++)for(let c=0;c<T.map.cols;c++)if(T.map.grid[r][c]==='.')return cid(c,r)})():null;
    return {H:hit('human',find(T.map,'H')),A:hit('alien',find(T.map,'A')),humanInA:hit('human',find(T.map,'A')),pod:hit('human',find(T.map,'1')),danger:hit('human',danger),dangerAlien:hit('alien',danger)}});
  assert(r.H.immune&&r.A.immune&&r.humanInA.immune&&r.pod.immune,'nobody can be harmed in a start sector or in an Escape Pod');
  assert(!r.danger.immune&&r.danger.killed&&!r.dangerAlien.immune&&r.dangerAlien.killed,'in a Dangerous sector an attack still kills');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
