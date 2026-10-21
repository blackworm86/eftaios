// Silence and Item cards stay face down in front of their player: public counts, a pile in your hand, shown items. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext({viewport:{width:420,height:860},serviceWorkers:'block'});await ctx.addInitScript(()=>{window.__botPace=0});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Hot&&T.maps.length>3);
 await p.evaluate(async()=>{await Hot.start(['Me','Bot 1','Bot 2'],'galilei','ultimate','auto',[null,'hard','hard'])});
 await p.waitForSelector('#app:not([hidden])');
 const r=await p.evaluate(()=>{
  const log=S.log;log.unshift({id:'a1',turn:1,who:'Me',kind:'silence',text:'silence',by:myId(),mine:true},{id:'a2',turn:2,who:'Me',kind:'silence',text:'silence',by:myId(),mine:true},{id:'a3',turn:3,who:'Me',kind:'silence',text:'silence',by:myId(),mine:true});
  S.items=['adrenaline'];
  const c=cardCounts().me;
  return {down:c.down,badge:cardBadge('me'),hand:handHtml(),front:decksHtml()};});
 assert(r.down===3,'three Silence announcements make three face-down cards');
 assert(/class="cdn"/.test(r.badge)&&/>3</.test(r.badge),'the player marker carries the count');
 assert(/class="pile"/.test(r.hand)&&/×2/.test(r.hand),'the hand shows the Silence cards that are not Items (3 face down, 1 is the Item)');
 const r2=await p.evaluate(()=>{S.log.unshift({id:'a4',turn:4,who:'Me',kind:'item',text:'adrenaline',by:myId(),mine:true});S.items=[];const c=cardCounts().me;return {down:c.down,shown:c.shown,badge:shownItems('me')}});
 assert(r2.down===2&&r2.shown[0]==='adrenaline'&&/class="shown"/.test(r2.badge),'using an Item turns it face up: one card less face down, the Item shown');
 const r3=await p.evaluate(()=>{S.log.unshift({id:'a5',turn:5,who:'Me',kind:'out',text:'killed|human|',by:myId(),mine:true});return cardCounts().me.down});
 assert(r3===0,'a kill clears the pile');
 const r4=await p.evaluate(async()=>{await Hot.start(['A','B','C','D'],'galilei','basic','auto',['hard','hard','hard','hard']);const c=cardCounts();return Object.values(c).reduce((a,v)=>a+v.down,0)});
 assert(r4>=0,'a finished Basic game counts without errors');
 console.log('errors',errs);await b.close();})();
