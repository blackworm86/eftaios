// The Medic and the Sensor are never aimed at a player who is already out of the game (a wasted power). Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.Hot&&T.maps.length>3);
  const r=await P.evaluate(async()=>{
    let medics=0,wasted=0,games=0;
    for(let g=0;g<25;g++){
      window.__rng=window.__mkRng?window.__mkRng(g+1):undefined;
      const seats=[{role:'human',char:'Medic',items:['sensor']},{role:'human',char:'Co-pilot'},{role:'human',char:'Pilot'},{role:'alien',char:'Fast Alien'},{role:'alien',char:'Psychic Alien'},{role:'alien',char:'Brute Alien'}];
      await Hot.start(['A','B','C','D','E','F'],['galilei','fermi','volta'][g%3],'ultimate','auto',Array(6).fill('hard'),seats);
      const log=Hot.dump().log.slice().reverse();games++;
      log.forEach((e,i)=>{
        if((e.kind==='reveal'&&(e.text==='Sensor'||String(e.text).startsWith('Id|')))){
          medics++;
          if(log.slice(0,i).some(o=>o.kind==='out'&&o.by===e.by&&!String(o.text).startsWith('killed|human')))wasted++;
        }
      });
    }
    return {games,medics,wasted};
  });
  assert(r.games===25&&r.medics>0,'games with the Medic and the Sensor played ('+r.medics+' reveals in '+r.games+' games)');
  assert(r.wasted===0,'no Medic or Sensor reveal falls on a player who was already out ('+r.wasted+')');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
