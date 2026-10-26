// Quick match joins an open public game, or starts a public one when none is open.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(3);const [A,B,C]=pages;
  for(const [p,h] of [[A,'anna'],[B,'bob'],[C,'cleo']]){await p.goto('http://localhost:8123/');await p.waitForSelector('#flow:not([hidden])');await p.evaluate(async h=>{await Sync.ensure();Sync.profile={handle:h,name:h.toUpperCase()};await Sync.setPath('handles/'+h,Sync.uid);S.name=h},h)}
  await A.evaluate(()=>renderFlow());await A.waitForSelector('[data-act=quickmatch]');await A.click('[data-act=quickmatch]');
  await A.waitForSelector('.roomcard b');assert(await A.evaluate(()=>Sync.settings.pub===true&&Sync.isHost()),'with nothing open, Quick match starts a public game');
  await A.waitForTimeout(1500);
  await B.evaluate(()=>renderFlow());await B.click('[data-act=quickmatch]');
  await B.waitForFunction(()=>document.querySelectorAll('.plist li').length===2,null,{timeout:8000});assert(true,'the next Quick match joins that game');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
