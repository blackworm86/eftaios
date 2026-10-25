// A finished game with bots is written to the player's history and statistics (and bot games are counted apart).
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [H]=pages;
  await H.goto('http://localhost:8123/');await H.fill('#flow-name','Host');await H.click('[data-act=hostsetup]');
  await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');
  await H.click('[data-act=addlobbybot]');await H.waitForFunction(()=>document.querySelectorAll('.plist li').length===2);
  await H.click('[data-act=ready]');await H.waitForFunction(()=>!document.querySelector('.startbtn').disabled);
  await H.click('.startbtn');await H.waitForSelector('#app:not([hidden])');await H.evaluate(()=>closeDlg());
  await H.evaluate(()=>Sync.updateSettings({status:'over',result:{aliensWin:true,reason:'time',escaped:[]}}));
  await H.waitForTimeout(1500);
  const r=await H.evaluate(async()=>({games:await Sync.getPath('users/'+Sync.uid+'/games'),stats:await Sync.readStats(),reg:Sync.registered,role:S.role}));
  console.log(JSON.stringify(r));
  assert(r.games&&Object.keys(r.games).length===1,'the finished game is in the history');
  assert(r.stats.botGames===1,'a game with a bot is counted on the bot line');
  assert(errs.length===0,'no page errors');
  await b.close();
})();
