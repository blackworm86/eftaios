// Spacing guard: on every start/flow screen, blocks stacked on top of each other keep at least 6px between them (nothing touches).
const {assert,setup,measureGaps:measure}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForSelector('#flow:not([hidden])');
  await P.evaluate(async()=>{await Sync.ensure();Sync.profile={handle:'anna',name:'Anna'};Sync.isAdmin=true;
    Sync.inbox={invites:[{from:'x',name:'Marco',code:'KEMQC6',map:'Galilei',at:Date.now()}],requests:1};
    T.friendList={friends:[{uid:'a',handle:'bob',mutual:true},{uid:'b',handle:'cleo',mutual:false}],requests:[{uid:'c',handle:'dan',name:'Dan'}]};
    T.pubList=[['ABCD1',{host:'x',name:'Anna',map:'galilei',mode:'ultimate',n:2,max:6,at:Date.now()}],['EFGH2',{host:'y',name:'Bo',map:'galilei',mode:'basic',n:5,max:8,at:Date.now()}]];
    T.myGames=[['KEMQC6',{state:'playing',mine:true,host:true,turn:4}],['ZZZZ11',{state:'lobby',host:false}],['OLD111',{state:'over'}]];
    T.stats={s:{games:5,wins:3,humans:2,winsHuman:1,aliens:3,winsAlien:2,escapes:1,streak:1,bestStreak:2,botGames:2,botWins:1,c_Pilot:3,cw_Pilot:2},games:[{result:'win',role:'human',chars:'Pilot',map:'galilei',at:1}]};
    T.homeGames=[['KEMQC6',{state:'playing',mine:true,turn:4}]];});
  const screens=[['home',()=>{S.stage='welcome'}],['host',()=>{S.stage='host'}],['hotsetup',()=>{S.stage='hotsetup'}],['solo',()=>{S.stage='solo'}],['friends',()=>{S.stage='friends'}],['browse',()=>{S.stage='browse'}],['games',()=>{S.stage='games'}],['stats',()=>{S.stage='stats'}],['account',()=>{S.stage='account'}],['auth',()=>{Sync.registered=false;Sync.profile=null;S.stage='auth'}]];
  for(const [vp,w,h] of [['phone',390,844],['small phone',360,640]]){
    await P.setViewportSize({width:w,height:h});
    for(const [name,set] of screens){
      await P.evaluate(async fn=>{await Sync.ensure();if(!Sync.profile){Sync.registered=true;Sync.profile={handle:'anna',name:'Anna'}}new Function('S',`(${fn})()`)(S);renderFlow()},set.toString());
      await P.waitForTimeout(150);
      const bad=await P.evaluate(measure);
      assert(bad.length===0,vp+' · '+name+': nothing touches'+(bad.length?' → '+bad.join('; '):''));
    }
  }
  // the game page (lobby) as host, with a bot and a public game
  await P.evaluate(()=>{Sync.registered=true;Sync.profile={handle:'anna',name:'Anna'};S.stage='welcome';renderFlow()});
  await P.setViewportSize({width:390,height:844});
  await P.click('[data-act=hostsetup]');await P.click('[data-act=seg][data-f=vis][data-v=public]');await P.click('[data-act=hostcreate]');await P.waitForSelector('.roomcard b');
  await P.click('[data-act=addlobbybot]');await P.waitForFunction(()=>document.querySelectorAll('.plist li').length===2);
  for(const [vp,w,h] of [['phone',390,844],['small phone',360,640]]){
    await P.setViewportSize({width:w,height:h});await P.waitForTimeout(150);
    const bad=await P.evaluate(measure);assert(bad.length===0,vp+' · game page: nothing touches'+(bad.length?' → '+bad.join('; '):''));
  }
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
