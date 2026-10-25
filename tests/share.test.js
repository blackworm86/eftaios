// The Share button in the lobby shares the table link (it once ran the "share anonymous results" switch by mistake).
const {assert,setup,startTable}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H]=pages;
  await startTable(pages);
  await H.evaluate(()=>{window.__shared=null;navigator.share=d=>{window.__shared=d;return Promise.resolve()}});
  await H.click('[data-act=share]');await H.waitForTimeout(300);
  const d=await H.evaluate(()=>window.__shared);
  assert(d&&/\/?\?|#|http/.test(d.url||''),'Share hands the table link to the system share sheet ('+(d&&d.url)+')');
  assert(await H.evaluate(()=>Records.on()),'and does not touch the anonymous-results switch');
  assert(errs.length===0,'no page errors');
  await b.close();
})();
