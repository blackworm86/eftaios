// Mobile UI: tapping the open tab hides the panel, tapping a tab reopens it; players on the bar pick several at once;
// the notes palette carries the game colours. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const ctx=await b.newContext({viewport:{width:360,height:640},serviceWorkers:'block'});await ctx.addInitScript(()=>{window.__botPace=0});
 const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Hot&&T.maps.length>3);
 await p.evaluate(async()=>{await Hot.start(['Me','Bot 1','Bot 2'],'galilei','ultimate','auto',[null,'normal','normal'])});
 await p.waitForSelector('#app:not([hidden])');await p.evaluate(()=>{try{closeDlg()}catch(e){}});
 const tab=k=>p.click(`.tabs [data-tab=${k}]`);
 const hidden=()=>p.evaluate(()=>document.body.classList.contains('panel-closed'));
 const mapH=()=>p.evaluate(()=>document.querySelector('#stage').getBoundingClientRect().height);
 assert(!await hidden(),'the panel is open at start');
 const h0=await mapH();
 await tab('play');assert(await hidden(),'a second tap on PLAY hides the panel');
 assert(await mapH()>h0+40,'the map takes the space the panel gave up');   // the panel is compact on short phones, so the gain is smaller than it was
 assert(await p.locator('.tabs').isVisible(),'the PLAY / TABLE / MORE bar stays visible');
 await tab('table');assert(!await hidden()&&await p.evaluate(()=>S.tab)==='table','a tap on TABLE while hidden reopens the panel on TABLE');
 await tab('table');assert(await hidden(),'a second tap on TABLE hides it again');
 await tab('more');assert(!await hidden()&&await p.evaluate(()=>S.tab)==='more','a tap on MORE reopens on MORE');
 // players on the bar
 await tab('play');
 const pick=k=>p.click(`[data-act=pfocus][data-k="${k}"]`);
 const keys=await p.evaluate(()=>tablePlayers&&Object.keys(tablePlayers()||{}));
 const ks=await p.evaluate(()=>[...document.querySelectorAll('[data-act=pfocus]')].map(b=>b.dataset.k));
 const a=ks[1], c=ks[2];
 await pick(a);assert(await p.evaluate(k=>T.focusSet.length===1&&T.focusSet[0]===k,a),'one tap on a player shows only that player');
 await pick(a);assert(await p.evaluate(()=>T.focusSet.length===0),'a second tap on the same player returns to the normal view');
 await pick(a);await pick(c);assert(await p.evaluate(([x,y])=>T.focusSet.length===2&&T.focusSet.includes(x)&&T.focusSet.includes(y),[a,c]),'a tap on a second player shows both');
 assert(await p.evaluate(()=>document.querySelector('#followbar').hidden===false&&/2/.test(document.querySelector('#followbar').textContent)),'the banner says how many players are shown');
 // the notes palette
 await p.evaluate(()=>{window.__c=ANNO_COLORS});
 const cols=await p.evaluate(()=>ANNO_COLORS.map(x=>x.toLowerCase()));
 assert(cols.length===13&&cols.includes('#ff3b30')&&cols.includes('#2f7dff')&&cols.includes('#ffd23f')&&cols.includes('#000000')&&cols.includes('#ffffff'),'the palette has Alien red, Human blue, Undecided yellow, black and white');
 assert(await p.evaluate(()=>PALETTE.every(([c])=>ANNO_COLORS.map(x=>x.toLowerCase()).includes(c.toLowerCase()))),'and all eight player colours');
 console.log('errors',errs);await b.close();})();
