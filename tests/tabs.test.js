// The four tabs: Play, Friends, Games, Library switch the screen, the active one is marked, and the bar gives way once a game starts.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H]=pages;
  await H.goto('http://localhost:8123/');await H.waitForSelector('#flow:not([hidden])');
  await H.evaluate(async()=>{await Sync.ensure();Sync.profile={handle:'anna',name:'Anna'};renderFlow()});
  const on=()=>H.evaluate(()=>[...document.querySelectorAll('#tabbar button[aria-selected=true]')].map(e=>e.dataset.act).join());
  assert(await H.locator('#tabbar button').count()===4&&await on()==='home','four tabs, Play is selected on the home screen');
  for(const [act,stage,want] of [['friends','friends','friends'],['accountgames','games','accountgames'],['library','library','library'],['home','welcome','home']]){
    await H.click(`#tabbar [data-act=${act}]`);
    assert(await H.evaluate(()=>S.stage)===stage&&await on()===want,`the ${act} tab opens ${stage} and is marked`);
  }
  await H.click('#tabbar [data-act=accountgames]');await H.click('[data-act=browse]');
  assert(await H.evaluate(()=>T.gamesView)==='open'&&await H.locator('#tabbar button[aria-selected=true]').count()===1,'Open games stays under the Games tab');
  await H.evaluate(()=>{S.stage='hotsetup';renderFlow()});
  assert(await H.locator('#tabbar:visible').count()===0,'the tab bar is hidden on a set-up screen');
  await H.evaluate(()=>{S.stage='welcome';renderFlow()});
  await H.evaluate(async()=>{await Hot.start(['Me','Bot 1','Bot 2'],'galilei','ultimate','auto',[null,'normal','normal'])});await H.waitForSelector('#app:not([hidden])');
  assert(await H.locator('#tabbar:visible').count()===0,'and during a game');
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
