// Tracking mode is chosen by the host at setup and applies to every player. Static server on :8123.
const {assert,setup,startTable,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H,G]=pages;
  await startTable(pages,{track:'manual'});
  assert((await G.textContent('.kv')).includes('By hand'),'guests see the tracking mode in the lobby');
  await begin(pages);
  assert(await H.evaluate(()=>S.track)==='manual'&&await G.evaluate(()=>S.track)==='manual','"by hand" applies to every player');
  assert(await G.locator('#mkbar [data-act=markmode]').count()===1,'players get the marking pencil');
  console.log('errors',errs);await b.close();
})();
