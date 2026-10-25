// "Fill empty seats with bots": a host alone can start, and bots take the free seats up to the number of players.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [H]=pages;
  await H.goto('http://localhost:8123/');await H.fill('#flow-name','Host');await H.click('[data-act=hostsetup]');
  await H.click('[data-act=seg][data-f=max][data-v="4"]');await H.click('[data-act=seg][data-f=fill][data-v=hard]');
  await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');
  assert(await H.evaluate(()=>Sync.settings.fill==='hard'&&Sync.settings.max===4),'the game remembers the fill level and the number of players');
  await H.click('[data-act=ready]');await H.waitForFunction(()=>!document.querySelector('.startbtn').disabled);assert(true,'a lone host can start when bots will fill the seats');
  await H.click('.startbtn');await H.waitForSelector('#app:not([hidden])',{timeout:15000});
  const n=await H.evaluate(()=>Object.values(Sync.players).filter(p=>p.bot==='hard').length);
  assert(n===3&&await H.evaluate(()=>Object.keys(Sync.players).length===4),'three Hard bots take the free seats');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
