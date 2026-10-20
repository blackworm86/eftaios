// A host's own map can be played at an online table: the guest receives its rows. Static server on :8123.
const {assert,setup,begin}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H,G]=pages;
  await H.goto('http://localhost:8123/');
  await H.evaluate(async()=>{const rows=Array.from({length:14},(_,i)=>i===5?'x'.repeat(11)+'A'+'.'.repeat(11):i===7?'x'.repeat(11)+'H'+'.'.repeat(11):'.'.repeat(23));rows[1]='.1'+rows[1].slice(2,21)+'2.';rows[12]='.3'+rows[12].slice(2,21)+'4.';S.customMaps=[{id:'custom-test',name:'Home Brew',rows_data:rows,oddColumnsLower:true}];await loadMaps();});
  await H.fill('#flow-name','P0');await H.click('[data-act=hostsetup]');await H.click('.mapcard');
  assert(await H.locator('.gcard[data-id="custom-test"]').count()===1,'the host can pick a custom map for an online table');
  await H.click('.gcard[data-id="custom-test"]');await H.click('[data-act=hostcreate]');await H.waitForSelector('.roomcard b');
  const code=await H.textContent('.roomcard b');
  assert(await H.evaluate(()=>typeof Sync.settings.customMap==='string'&&Sync.settings.map==='custom-test'),'the map travels with the table settings');
  await G.goto('http://localhost:8123/?room='+code);await G.fill('#flow-name','P1');await G.click('[data-act=joinroom]');await G.waitForSelector('.plist');
  await G.waitForFunction(()=>/Home Brew/.test(document.querySelector('.kv').textContent));assert(true,'the guest sees the custom map in the lobby');
  for(const p of pages)await p.click('[data-act=ready]');
  await H.waitForFunction(()=>!document.querySelector('.startbtn').disabled);
  await begin(pages);
  assert(await G.evaluate(()=>T.map.name==='Home Brew'&&S.mapId==='custom-test'&&T.map.cols===23&&T.map.rows===14),'the guest plays on the host\'s map');
  assert(await G.evaluate(()=>!!find(T.map,'A')&&!!find(T.map,'H')&&!!find(T.map,'4')),'start sectors and pods came through');
  console.log('errors',errs);await b.close();
})();
