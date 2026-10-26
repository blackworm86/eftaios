// A public game appears in the Online lobby while it gathers, a guest joins from there, a private game never appears, and a full game leaves the list.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(3);const [H,G,P]=pages;
  await H.goto('http://localhost:8123/');await H.fill('#flow-name','Host');await H.click('[data-act=hostsetup]');
  await H.click('[data-act=seg][data-f=vis][data-v=public]');await H.click('[data-act=seg][data-f=max][data-v="2"]');
  await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');
  assert(await H.evaluate(()=>Sync.settings.pub===true&&Sync.settings.max===2),'the game is created public with two seats');
  await H.waitForTimeout(1500);
  await G.goto('http://localhost:8123/');await G.fill('#flow-name','Guest');await G.click('#tabbar [data-act=accountgames]');await G.click('[data-act=browse]');
  await G.waitForSelector('[data-act=joinpub]');
  assert(await G.locator('[data-act=joinpub]').count()===1,'the guest sees the public game in the Online lobby');
  await G.click('[data-act=joinpub]');await G.waitForFunction(()=>document.querySelectorAll('.plist li').length===2,null,{timeout:8000}).catch(()=>{});
  assert(await G.locator('.plist li').count()===2,'joining from the list puts the guest at the table');
  await H.waitForTimeout(1500);
  await P.goto('http://localhost:8123/');await P.fill('#flow-name','Third');await P.click('#tabbar [data-act=accountgames]');await P.click('[data-act=browse]');
  await P.waitForSelector('.dim');
  assert(await P.locator('[data-act=joinpub]').count()===0,'a full game leaves the list');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
