// Map picker: preview card opens a gallery of all maps. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const S='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
const p=await (await b.newContext({viewport:{width:390,height:844},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');
assert(await p.locator('select#f-map').count()===0&&await p.locator('.mapcard').count()===1,'no dropdown: a preview card');
await p.screenshot({path:'/dev/null'});
await p.click('.mapcard');assert(await p.locator('#gallery .gcard').count()===15,'gallery shows all 15 maps');
assert(await p.locator('#gallery h3').count()===3,'grouped in 3 packs');
await p.screenshot({path:'/dev/null'});
await p.click('.gcard[data-id="balena"]');
assert(await p.locator('#gallery').count()===0&&await p.evaluate(()=>document.querySelector('#f-map').value)==='balena'&&(await p.textContent('#f-map-name'))==='Balena','picking a map closes the gallery and selects it');
await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');assert(await p.evaluate(()=>T.map.id)==='balena','game starts on the chosen map');
console.log('errors',errs);await b.close()})()
