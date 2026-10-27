// The JavaScript network player gives the same inputs and outputs as the Python code it was trained with (rl/tests/make_parity.py). Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.NN&&window.Hot&&T.maps.length>3);
  const r=await P.evaluate(async()=>{
    const cases=await (await fetch('rl/tests/parity.json')).json(), net=await (await fetch('rl/tests/parity-net.json')).json();
    NN.use(net);
    const actsBad=[];let obsBad=0,globBad=0,logitBad=0,maxLogit=0,checked=0;
    for(const c of cases){
      const map=T.maps.find(m=>m.id===c.map),bd=NN.boardOf(map),N=bd.N,phase=['move','attack','decoy','pre','post','target_cell','target_seat'][c.phase];
      S.hatches={1:c.open_pods.includes(1)?0:1,2:c.open_pods.includes(2)?0:1,3:c.open_pods.includes(3)?0:1,4:c.open_pods.includes(4)?0:1};
      const ev=c.events.map(([turn,seat,kind,cell,text])=>({turn,seat,kind,cell,text}));
      const idOf=i=>cid(i%map.cols,Math.floor(i/map.cols));
      const reach=new Map([...reachable(map,idOf(c.pos),99,c.role)].map(([id,d])=>{const q=parseId(id);return [q[1]*map.cols+q[0],d]}));
      const me={seat:c.me,n:c.n,role:c.role,pos:c.pos,fed:c.fed,reborn:c.reborn,ability:c.ability,path:c.path,reach,items:c.items,powerUsed:c.power_used,adr:c.adr,cat:c.cat,decoys:c.decoys};
      const obs=NN.observe(bd,ev,me,c.open_pods,c.turn,phase,phase==='attack'?[]:c.mask);
      if(phase==='pre'||phase==='post'){   // the actions on offer, worked out from the app's state the way nn.js does, must be the ones Python offered
        T.map=map;const st={items:c.items.slice(),pos:idOf(c.pos),adr:c.adr,reborn:c.reborn,ab:c.power_used?{[c.ability]:1}:{}};
        const others=ev.length?c.n-1-new Set(ev.filter(e=>e.kind==='out'&&!e.text.startsWith('killed|human')).map(e=>e.seat)).size:c.n-1;
        const got=NN.actsOf(phase,st,c.role,c.ability,others,true);
        if(JSON.stringify(got)!==JSON.stringify(c.mask))actsBad.push({phase,got,want:c.mask,items:c.items,ab:c.ability});
      }
      const want=new Uint8Array(37*N);c.dyn.forEach(([ch,i,v])=>{want[ch*N+i]=v});
      let bad=0;for(let i=0;i<want.length;i++)if(Math.abs(want[i]-obs.dyn[i])>1)bad++;
      if(bad)obsBad++;
      if(c.glob.some((v,i)=>Math.abs(v-obs.glob[i])>1e-5))globBad++;
      const lg=NN.forward(obs,bd);let worst=0;
      c.logits.forEach((v,i)=>{if(v===null){if(lg[i]>-1e8)worst=1e9}else worst=Math.max(worst,Math.abs(v-lg[i]))});
      maxLogit=Math.max(maxLogit,worst);if(worst>1e-3)logitBad++;checked++;
    }
    // end to end on a real game: the observation can be built from the app's own state, and the move is legal
    await Hot.start(['A','B','C','D'],'galilei','ultimate','auto',['','','','']);closeDlg();
    const H={seats:[...Array(4)].map((_,i)=>({id:'h'+i})),log:S.log,turn:S.turn,mode:'ultimate'};
    const id=NN.move(H,0,S,S.role,0), legal=[...T.reach.keys()];
    return {actsBad,checked,obsBad,globBad,logitBad,maxLogit,id,legal:legal.includes(id)};
  });
  assert(r.checked>=10,'checked '+r.checked+' game states');
  assert(r.obsBad===0,'the dynamic input maps equal the Python ones');
  assert(r.globBad===0,'the global input vector equals the Python one');
  assert(r.logitBad===0,'the outputs equal the Python outputs (largest difference '+r.maxLogit.toExponential(2)+')');
  assert(r.actsBad.length===0,'the Item / power actions on offer equal the Python ones '+JSON.stringify(r.actsBad.slice(0,2)));
  assert(r.legal,'on a real game state the network picks a legal move ('+r.id+')');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
