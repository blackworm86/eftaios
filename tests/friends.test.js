// Friends: add by handle, accept, invite to a game from the game page, join from the invitation on the home screen.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [A,B]=pages;
  for(const [p,h] of [[A,'anna'],[B,'bob']]){await p.goto('http://localhost:8123/');await p.waitForSelector('#flow:not([hidden])');await p.evaluate(async h=>{await Sync.ensure();Sync.profile={handle:h,name:h.toUpperCase()};await Sync.setPath('handles/'+h,Sync.uid);S.name=h;},h)}
  await A.evaluate(()=>{renderFlow()});await A.click('[data-act=friends]');await A.fill('#friend-handle','bob');await A.click('[data-act=friendadd]');
  await A.waitForSelector('.plist');assert((await A.textContent('#flow-card')).includes('@bob')&&(await A.textContent('#flow-card')).includes('Waiting for them'),'a request shows as waiting');
  await A.fill('#friend-handle','nobody123');await A.click('[data-act=friendadd]');await A.waitForFunction(()=>/Nobody has that handle/.test(document.body.innerText));assert(true,'an unknown handle is refused');
  await B.evaluate(()=>{renderFlow()});await B.waitForFunction(()=>Sync.inbox&&Sync.inbox.requests===1);
  await B.click('[data-act=friends]');await B.waitForSelector('[data-act=friendok]');await B.click('[data-act=friendok]');
  await B.waitForFunction(()=>/Friends/.test(document.querySelector('.glist small')&&document.querySelector('.glist small').textContent||''));assert(true,'accepting makes them friends');
  await A.click('[data-act=back]');await A.click('[data-act=hostsetup]');await A.click('[data-act=hostcreate]');await A.waitForSelector('.roomcard b');
  await A.click('[data-act=invitefriend]');await A.waitForSelector('[data-act=sendinvite]');await A.click('[data-act=sendinvite]');
  await B.click('[data-act=back]');await B.waitForSelector('[data-act=joininvite]',{timeout:8000});assert(true,'the friend sees the invitation on the home screen');
  await B.click('[data-act=joininvite]');await B.waitForFunction(()=>document.querySelectorAll('.plist li').length===2,null,{timeout:8000});assert(true,'joining from the invitation puts them in the game');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
