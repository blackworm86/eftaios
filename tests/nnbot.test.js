// Bots at level 'nn' play whole games with the trained-network player (a tiny random network here: the test checks the plumbing). Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.NN&&window.Hot&&T.maps.length>3);
  const r=await P.evaluate(async()=>{
    NN.use(await (await fetch('rl/tests/parity-net.json')).json());
    const out=[];
    for(const n of [3,6]){
      await Hot.start(['A','B','C','D','E','F'].slice(0,n),'galilei','ultimate','auto',Array(n).fill('nn'));
      const d=Hot.dump();out.push({n,over:Hot.isOver(),turns:d.turn,moves:d.seats.reduce((a,s)=>a+s.path.length-1,0),log:d.log.length});
    }
    return out;
  });
  r.forEach(g=>assert(g.over&&g.moves>5&&g.log>5,'a table of '+g.n+' network bots plays a whole game ('+g.turns+' turns, '+g.moves+' moves)'));
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
