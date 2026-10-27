// Game page: new bots take the level picked next to the button, and "Shuffle seats at start" draws the seats when the game starts.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [H]=pages;
  await H.goto('http://localhost:8123/');await H.fill('#flow-name','Host');await H.click('[data-act=hostsetup]');await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');
  await H.click('[data-act=botlevel][data-v=hard]');await H.click('[data-act=addlobbybot]');await H.waitForFunction(()=>document.querySelectorAll('.plist li').length===2);
  await H.click('[data-act=botlevel][data-v=easy]');await H.click('[data-act=addlobbybot]');await H.waitForFunction(()=>document.querySelectorAll('.plist li').length===3);
  const lv=await H.evaluate(()=>Object.values(Sync.players).filter(p=>p.bot).map(p=>p.bot).sort().join());
  assert(lv==='easy,hard','each bot takes the level that was picked when it was added ('+lv+')');
  await H.click('[data-act=shuffleopt][data-v=on]');await H.waitForFunction(()=>Sync.settings.shuffle===true);
  assert(await H.locator('[data-act=shuffleopt][data-v=on][aria-checked=true]').count()===1,'Shuffle seats is On');
  await H.evaluate(()=>{Math.random=()=>0});   // with 0 every draw swaps with the first seat: [host, a, b] becomes [a, b, host]
  await H.click('[data-act=ready]');await H.waitForFunction(()=>!document.querySelector('.startbtn').disabled);
  const uid=await H.evaluate(()=>Sync.uid);
  await H.click('.startbtn');await H.waitForSelector('#app:not([hidden])',{timeout:15000});
  const order=await H.evaluate(()=>Sync.settings.order);
  assert(order.length===3&&order[2]===uid&&order[0]!==uid,'the host is no longer first: the seats were drawn at the start');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
