// Host closes the game: everyone returns to the start screen; a closed table cannot be rejoined. Static server on :8123.
const {assert,setup,startTable,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H,G]=pages;
  const code=await startTable(pages);await begin(pages);
  await H.evaluate(()=>actions.closetable());await H.click('#d-yes');
  await H.waitForSelector('#flow:not([hidden])');assert((await H.textContent('#flow-card')).includes('Create a game'),'host lands on the "create game" screen');
  await G.waitForSelector('#flow:not([hidden])',{timeout:10000});assert(await G.evaluate(()=>S.stage)==='welcome'&&await G.evaluate(()=>S.room)===null,'guest is sent back to the start screen');
  await G.fill('#join-code',code);await G.click('[data-act=joinroom]');await G.waitForTimeout(500);
  assert((await G.textContent('#flow-card')).includes('closed'),'closed table cannot be rejoined');
  // guest leaving: only the guest leaves
  const pages2=(await setup(2));const [H2,G2]=pages2.pages;await startTable(pages2.pages);await begin(pages2.pages);
  await G2.evaluate(()=>actions.leavetable());await G2.click('#d-yes');
  await G2.waitForSelector('#flow:not([hidden])');assert(await H2.evaluate(()=>S.stage)==='game','when a guest leaves, the host stays in the game');
  console.log('errors',errs.concat(pages2.errs));await b.close();await pages2.b.close();
})();
