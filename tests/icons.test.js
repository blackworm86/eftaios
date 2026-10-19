// The printed game's icons in the interface: card faces, item slots, announcements, log and map. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const SS=process.env.SS||'/tmp';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');
 assert(await p.evaluate(()=>['noise-here','noise-any','silence','attack','teleport','sedatives','spotlight','defense','adrenaline'].every(n=>!!document.getElementById('gi-'+n))),'the nine icons are in the page');
 // physical cards: the three Dangerous Sector cards are card faces with their icons
 await p.click('[data-act=solo]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 await p.evaluate(()=>{const id=[...T.reach.keys()].find(x=>at(T.map,x)==='.');selectCell(id);confirmMove()});
 assert(await p.locator('.faces .face').count()===3&&await p.locator('.faces .face svg.gi').count()===3,'the card buttons show the three card icons');
 assert(await p.locator('[data-act=noiseHere],[data-act=noiseAny],[data-act=silence]').count()===3,'the card buttons keep their actions');
 await p.screenshot({path:SS+'/ic-cards.png'});
 await p.click('[data-act=silence]');
 assert(await p.locator('.say.hasicon svg.gi').count()===1,'the announcement carries the Silence icon');
 await p.screenshot({path:SS+'/ic-say.png'});
 // items in the hand, log lines and the map
 await p.evaluate(()=>{S.items=['attack','teleport','sedatives'];S.online=true;render()});
 assert(await p.locator('.slot svg.gi').count()===3,'item slots show the item icons');
 await p.screenshot({path:SS+'/ic-hand.png'});
 await p.click('.slot >> nth=0');
 assert(await p.locator('dialog .dlgico svg.gi').count()===1,'the item sheet shows a big icon');
 await p.screenshot({path:SS+'/ic-item.png'});
 await p.evaluate(()=>closeDlg());
 await p.evaluate(()=>{const base={turn:2,who:'Bob',at:Date.now(),by:'x'};
   S.log.unshift(Object.assign({id:'l1',kind:'noise',sector:'K10',text:'noise'},base),Object.assign({id:'l2',kind:'silence',text:'secure'},base),Object.assign({id:'l3',kind:'item',text:'attack'},base),Object.assign({id:'l4',kind:'attack',sector:'M10',text:'attack'},base),Object.assign({id:'l5',kind:'spot',sector:'N11',text:'spot'},base));
   paintOverlay()});
 assert(await p.evaluate(()=>logIcon({kind:'item',text:'teleport'}).includes('gi-teleport'))&&await p.evaluate(()=>logIcon({kind:'silence',text:'secure'}).includes('gi-todo')),'log icons are chosen per announcement');
 assert(await p.locator('#marks use[href="#gi-attack"]').count()>=1&&await p.locator('#marks use[href="#gi-spotlight"]').count()>=1,'the map shows the Attack icon (item attack) and the Spotlight icon');
 await p.click('[data-tab=table]');await p.click('.subtabs button:nth-child(2)');await p.screenshot({path:SS+'/ic-log.png'});
 assert(await p.locator('#panel-body li svg.gi').count()>=4,'the log lines carry their icons');
 const over=await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);assert(!over,'no horizontal overflow');
 console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close()})();
