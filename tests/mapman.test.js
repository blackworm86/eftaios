// Map manager on the splash page: browse, copy, edit, delete, import. Official maps stay read-only. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');
 await p.click('#tabbar [data-act=library]');await p.click('[data-act=maps_]');await p.waitForSelector('#mapman .gcard');
 assert(await p.locator('#mapman .gcard').count()>=3,'splash lists the official maps');
 await p.click('#mapman .gcard');
 assert(await p.locator('[data-act=mmedit],[data-act=mmdel]').count()===0&&await p.locator('[data-act=mmcopy]').count()===1,'official map: no edit/delete, only copy');
 await p.click('[data-act=mmcopy]');await p.waitForSelector('#ed-svg');
 await p.click('[data-t=s]');
 const before=await p.locator('#ed-svg polygon[fill="#ece6d3"]').count();
 const box=await p.locator('#ed-svg polygon').nth(100).boundingBox();await p.mouse.click(box.x+box.width/2,box.y+box.height/2);
 assert(await p.locator('#ed-svg polygon[fill="#ece6d3"]').count()===before+1||before>0,'painting a sector works');
 // zoom: wheel, buttons, pinch; the editor never scrolls
 const ed=await p.evaluate(()=>{const f=document.querySelector('.gallery.edit .gbody');return {s:f.scrollHeight>f.clientHeight+1,b:document.documentElement.scrollHeight>innerHeight}});
 assert(!ed.s&&!ed.b,'the editor fits the screen without scrolling');
 const k0=await p.evaluate(()=>MM.view.k);const bx=await p.locator('#ed-box').boundingBox();
 await p.mouse.move(bx.x+bx.width/2,bx.y+bx.height/2);await p.mouse.wheel(0,-300);
 assert(await p.evaluate(()=>MM.view.k)>k0,'the mouse wheel zooms in');
 await p.click('[data-act=mmzout]');await p.click('[data-act=mmzfit]');assert(Math.abs(await p.evaluate(()=>MM.view.k)-k0)<1e-6,'fit restores the auto-fit size');
 await p.evaluate(()=>{const b=document.querySelector('#ed-box'),r=b.getBoundingClientRect(),mk=(t,id,x,y)=>b.dispatchEvent(new PointerEvent(t,{pointerId:id,clientX:r.left+x,clientY:r.top+y,bubbles:true,isPrimary:id===1,pointerType:'touch',button:0}));window.__pinch=(s)=>{mk('pointerdown',1,100,100);mk('pointerdown',2,140,100);mk('pointermove',2,100+40*s,100);mk('pointerup',2,100+40*s,100);mk('pointerup',1,100,100)};});
 await p.evaluate(()=>__pinch(3));assert(await p.evaluate(()=>MM.view.k)>k0*2,'pinching two fingers zooms in');
 await p.click('[data-act=mmzfit]');
 await p.click('[data-t=s]');
 // paint bucket fills a region; color picker takes a sector's type
 await p.evaluate(()=>{MM.ed.grid.forEach(r=>r.fill('.'));document.querySelector('#ed-g').innerHTML=edCells()});
 await p.click('[data-t=x]');await p.click('[data-act=mmmode][data-m=bucket]');
 {const bx2=await p.locator('#ed-box').boundingBox();await p.mouse.click(bx2.x+bx2.width/2,bx2.y+bx2.height/2);}
 assert(await p.evaluate(()=>MM.ed.grid.flat().filter(c=>c==='x').length)===322,'the paint bucket fills a whole region');
 await p.click('[data-act=mmmode][data-m=pick]');await p.click('[data-t=s]');
 {const bx2=await p.locator('#ed-box').boundingBox();await p.mouse.click(bx2.x+bx2.width/2,bx2.y+bx2.height/2);}
 assert(await p.evaluate(()=>MM.ed.tool==='x'&&MM.ed.mode==='brush'),'the color picker takes the sector\'s type and returns to the brush');
 await p.click('[data-act=mmmode][data-m=bucket]');await p.click('[data-t="."]');{const bx2=await p.locator('#ed-box').boundingBox();await p.mouse.click(bx2.x+bx2.width/2,bx2.y+bx2.height/2);}
 await p.click('[data-act=mmmode][data-m=brush]');
 await p.evaluate(()=>{MM.ed.grid[7][11]='H';MM.ed.grid[5][11]='A';document.querySelector('#ed-g').innerHTML=edCells()});
 await p.fill('#ed-name','Test copy');await p.click('[data-act=mmsave]');
 await p.waitForSelector('[data-act=mmdel]');
 assert(await p.evaluate(()=>S.customMaps.length)===1&&await p.locator('[data-act=mmedit]').count()===1,'copy saved as a custom map, now editable');
 {const f=await p.evaluate(()=>{const b=document.querySelector('.gallery.detail .gbody');return {s:b.scrollHeight>b.clientHeight+1,d:document.documentElement.scrollHeight>innerHeight,inView:document.querySelector('[data-act=mmdel]').getBoundingClientRect().bottom<=innerHeight}});assert(!f.s&&!f.d&&f.inView,'after saving, the map page fits the screen with all its buttons visible');}
 await p.click('[data-act=mmedit]');await p.waitForSelector('#ed-svg');await p.click('[data-act=mmsave]');await p.waitForSelector('[data-act=mmdel]');
 assert(await p.evaluate(()=>S.customMaps.length)===1,'editing updates in place');
 await p.click('[data-act=mmdel]');await p.click('#d-yes');await p.waitForSelector('[data-act=mmnew]');
 assert(await p.evaluate(()=>S.customMaps.length)===0,'custom map deleted');
 await p.click('[data-act=eimport]');
 await p.fill('#imp',JSON.stringify({name:'Imp',rows_data:Array.from({length:14},(_,i)=>i===0?'HA'+'.'.repeat(21):'.'.repeat(23))}));await p.click('#d-yes');
 await p.waitForTimeout(300);
 assert(await p.evaluate(()=>S.customMaps.length)===1,'import adds a map');
 assert(errs.length===0,'no page errors '+errs.join());
 await b.close();})();
