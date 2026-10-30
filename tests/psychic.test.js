// The Psychic Alien: a Silence card counts as Noise in Any Sector and is discarded; an Item card is not a Silence card. Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.Hot&&T.maps.length>3);
  const run=card=>P.evaluate(async card=>{
    const real=window.deckDraw;window.deckDraw=d=>({card,reshuffled:false});   // every Dangerous Sector card drawn is this one
    try{
      const seats=[{role:'alien',char:'Psychic Alien'},{role:'alien',char:'Fast Alien'},{role:'human',char:'Captain'},{role:'human',char:'Pilot'}];
      await Hot.start(['Psy','B','C','Me'],'galilei','ultimate','auto',['hard','hard','hard',''],seats);
      const d=Hot.dump(),mine=d.log.filter(e=>e.by===d.seats[0].id&&['noise','silence'].includes(e.kind));
      return {said:mine.map(e=>e.kind+(e.text==='secure'?'-secure':'')),disc:Hot.counts().sector.x,items:d.seats[0].items};
    }finally{window.deckDraw=real}
  },card);
  const s=await run('silence');
  assert(s.said.includes('noise')&&!s.said.includes('silence'),'on a Silence card the Psychic Alien announces a noise ('+s.said.join(',')+')');
  assert(s.disc===s.said.filter(x=>x==='noise').length,'and the Silence card goes to the discard pile ('+s.disc+' discarded)');
  const i=await run('item:attack');
  assert(i.said.includes('silence')&&!i.said.includes('noise')&&i.items.includes('attack'),'an Item card is not a Silence card: silence, and the Item is kept ('+i.said.join(',')+'; '+i.items.join(',')+')');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
