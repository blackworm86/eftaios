// The phone's Back button steps back through the app (stats -> account -> home) and does not leave it until the home screen.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForSelector('#flow:not([hidden])');
  await P.evaluate(async()=>{await Sync.ensure();Sync.profile={handle:'tester',name:'Tester'};renderFlow()});await P.click('[data-act=friends]');assert(await P.evaluate(()=>S.stage)==='friends','Friends opens');
  await P.goBack();await P.waitForTimeout(300);assert(await P.evaluate(()=>S.stage)==='welcome'&&P.url().includes('localhost'),'Back from Friends returns to the home screen, inside the app');
  await P.evaluate(()=>{S.stage='stats';T.stats={s:{games:1},games:[]};renderFlow()});
  await P.goBack();await P.waitForTimeout(300);assert(await P.evaluate(()=>S.stage)==='account','Back from Statistics returns to the account screen');
  await P.goBack();await P.waitForTimeout(300);assert(await P.evaluate(()=>S.stage)==='welcome','and then to the home screen');
  await P.evaluate(()=>{S.stage='account';renderFlow()});
  await P.click('[data-act=hostsetup]').catch(()=>{});
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
