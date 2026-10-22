// A table hosts many games: after game over the host takes everyone back to the lobby, and starts again. Static server on :8123.
const {assert,setup,startTable,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H,G]=pages;
  const code=await startTable(pages);await begin(pages);
  const dump=p=>p.evaluate(()=>Sync.getPath('rooms/'+Sync.code+'/hostdata').then(v=>!!v));
  assert(await dump(H),'the first game has host data');
  // end the game as the host's engine would
  await H.evaluate(()=>Sync.updateSettings({status:'over',result:{aliensWin:true,reason:'time',escaped:[]}}));
  await G.waitForFunction(()=>Sync.settings&&Sync.settings.status==='over');
  assert((await H.textContent('[data-act=rematch]')).length>0,'host is offered "Play again"');
  assert(await G.evaluate(()=>!document.querySelector('[data-act=rematch]')),'a guest is not');
  await H.evaluate(()=>actions.rematch());
  for(const p of pages){await p.waitForFunction(()=>S.stage==='lobby',{timeout:10000});}
  assert(await H.evaluate(()=>Sync.settings.status==='lobby'&&Sync.settings.n===2),'same table is back in the lobby, game 2');
  assert(await H.evaluate(()=>Sync.code)===code,'the table code is unchanged');
  assert(!(await dump(H)),'last game\'s host data is gone');
  assert(await G.evaluate(()=>!Object.values(Sync.players).some(p=>p.role||p.out||p.route)),'players carry no role from the last game');
  // everyone ready, play again
  for(const p of pages)await p.evaluate(()=>actions.ready());
  await H.waitForSelector('.startbtn:not([disabled])',{timeout:10000});
  await begin(pages);
  assert(await G.evaluate(()=>S.stage)==='game'&&await H.evaluate(()=>Sync.settings.status)==='playing','a second game starts at the same table');
  console.log('errors',errs);await b.close();
})();
