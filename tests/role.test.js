// Character icon + role explanation; Cat can be played before moving. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:820},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');
 const first=await p.textContent('dialog');
 assert(await p.locator('dialog .gi').count()>=1&&/Ability|Basic/.test(first)&&/Reach an Escape Pod|Hunt the Humans/.test(first),'the secret-role screen shows the Character icon, its ability and what the role does');
 await p.click('#d-no');
 await p.click('.ph .chr');
 assert(await p.locator('dialog[open] .gi').count()>=1,'tapping the role chip shows it again');await p.click('#d-no');
 assert(await p.evaluate(()=>CHAR_ICON&&Object.values(CHAR_ICON).every(k=>GI_ART[k])&&Object.keys(CHAR_ICON).length===16),'all 16 Characters have an icon');
 // Cat in the move phase
 await p.evaluate(()=>{S.role='human';S.char='Medic';S.items=['cat'];S.pos='K09';S.phase='move';T.sel=null;refreshReach();render()});
 await p.click('[data-act=itemdlg][data-i=cat]');await p.click('dialog [data-act=useitem]');
 assert(await p.evaluate(()=>S.cat)===true&&/Cat is ready/.test(await p.textContent('#panel-body')),'Cat can be armed before moving and is shown as ready');
 console.log('errors',errs);await b.close();})();
