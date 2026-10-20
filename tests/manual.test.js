// Companion mode: the app is the paper sheet. Other players' declarations are written down by hand, and map notes. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const SS=process.env.SS||'/tmp';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',d=>d.accept('Zoe'));
 await p.goto('http://localhost:8123/');
 assert((await p.textContent('#flow-card')).includes('Companion'),'the third mode is called Companion');
 await p.click('[data-act=solo]');
 assert(await p.locator('[data-f=cards],[data-f=track]').count()===0,'companion setup: no cards and no tracking options');
 assert((await p.locator('[role=radio][data-f=mode]').evaluateAll(e=>e.map(x=>x.dataset.v))).join()==='basic,ultimate','rules are listed Basic, Ultimate');
 await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 assert(await p.evaluate(()=>S.track)==='manual'&&!(await p.evaluate(()=>S.online)),'companion: tracked by hand, physical cards');
 await p.evaluate(()=>{S.log.unshift({id:'a1',who:'Bob',turn:1,kind:'noise',sector:'N10',text:'noise',at:Date.now()});paintOverlay()});
 assert(await p.evaluate(()=>document.querySelectorAll('#marks .pm:not(.mine)').length)===1,'a declaration written in the log is marked on the map');
 await p.click('#mkbar [data-act=markmode]');
 assert((await p.textContent('#panel-body')).includes('tap'),'the pencil opens the recording banner');
 assert(await p.locator('.dchips .dchip').count()===5,'five kinds of declaration to record');
 await p.click('#mkbar [data-act=markwho]');           // Bob is known from the log
 // noise: tap sectors
 await p.evaluate(()=>{onCell('K10');onCell('L10')});
 assert(await p.evaluate(()=>S.log.filter(e=>e.who==='Bob'&&e.kind==='noise').length)===3&&await p.evaluate(()=>document.querySelectorAll('#marks .pm:not(.mine)').length)>=2,'tapping sectors records noise for the chosen player');
 await p.evaluate(()=>onCell('L10'));assert(await p.evaluate(()=>S.log.filter(e=>e.who==='Bob'&&e.kind==='noise').length)===2,'tapping again removes it');
 // attack
 await p.click('.dchip[data-k=attack]');await p.evaluate(()=>onCell('M10'));
 assert(await p.evaluate(()=>S.log.some(e=>e.who==='Bob'&&e.kind==='attack'&&e.sector==='M10')),'an attack declaration is recorded');
 // silence, silent sector
 await p.click('.dchip[data-k=silence]');await p.click('.dchip[data-k=secure]');
 assert(await p.evaluate(()=>S.log.filter(e=>e.who==='Bob'&&e.kind==='silence').map(e=>e.text).sort().join())==='secure,silence','Silence and Silent Sector are told apart');
 // items
 await p.click('.dchip[data-k=item]');assert(await p.locator('dialog [data-act=markitem]').count()===10,'the item sheet lists the ten items');
 await p.click('dialog [data-act=markitem][data-i=adrenaline]');
 assert(await p.evaluate(()=>S.log.some(e=>e.who==='Bob'&&e.kind==='item'&&e.text==='adrenaline')),'an item played by another player is recorded');
 await p.click('.dchip[data-k=item]');await p.click('dialog [data-act=markitem][data-i=attack]');await p.evaluate(()=>onCell('O09'));
 assert(await p.evaluate(()=>S.log.some(e=>e.who==='Bob'&&e.kind==='item'&&e.text==='attack')&&S.log.some(e=>e.who==='Bob'&&e.kind==='attack'&&e.sector==='O09')),'an Attack card records the item and the attack');
 assert(await p.locator('#marks use[href="#gi-attack"]').count()>=1,'the map shows the Attack icon for an Attack card');
 // turn number and undo
 await p.click('[data-act=mturn][data-d="1"]');await p.evaluate(()=>onCell('M11'));
 assert(await p.evaluate(()=>S.log.some(e=>e.who==='Bob'&&e.sector==='M11'&&e.turn===2)),'the turn number of a declaration can be changed');
 const n0=await p.evaluate(()=>S.log.length);await p.click('[data-act=markundo]');assert(await p.evaluate(()=>S.log.length)<n0,'Undo removes the last declaration');
 await p.click('#mkbar [data-act=addplayer]');await p.evaluate(()=>onCell('O08'));
 assert(await p.evaluate(()=>S.log.some(e=>e.who==='Zoe'&&e.sector==='O08')),'a new player can be added and recorded');
 await p.screenshot({path:SS+'/man-mark.png'});
 await p.click('.banner [data-act=markmode]');
 assert(await p.evaluate(()=>!T.markMode)&&(await p.textContent('#panel-body')).includes('highlighted'),'Done returns to the game');
 // old hand marks become declarations
 const mig=await p.evaluate(()=>{const keep=JSON.parse(JSON.stringify(S));return keep.marks.length});assert(mig===0,'no hand marks are kept');
 // notes: the sector note dialog is still used to edit an old note; the annotate bar places stamps and draws
 await p.evaluate(()=>{S.notes=[{sector:'J10',icon:'alien',text:'alien came from here?'}];save();paintNotes()});
 assert(await p.evaluate(()=>document.querySelectorAll('#notes .sticker').length)===1,'an old sector note is still drawn on the map');
 await p.evaluate(()=>{S.phase='resolve';onCell('J10')});
 assert((await p.textContent('#inspect')).includes('alien came from here?'),'tapping the sector shows the note');
 await p.click('#inspect [data-act=noteedit]');await p.click('#d-del');
 assert(await p.evaluate(()=>S.notes.length)===0,'note can be deleted');
 const fits=await p.evaluate(()=>{const z=document.querySelector('.zoom').getBoundingClientRect(),s=document.querySelector('#stage').getBoundingClientRect();return z.top>=s.top});
 assert(fits,'map buttons still fit in the map area');
 console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close()})()
