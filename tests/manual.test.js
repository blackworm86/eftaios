// Manual tracking (mark other players by hand) and map notes. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const SS='/tmp/claude-0/-home-user-eftaios/9c1fb807-3ccb-51aa-b179-90ef8efd54ec/scratchpad';
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 p.on('dialog',d=>d.accept('Zoe'));
 await p.goto('http://localhost:8123/');await p.click('[data-act=solo]');await p.click('[data-f=track][data-v=manual]');await p.click('.role-btn.human');await p.waitForSelector('#app:not([hidden])');
 assert(await p.evaluate(()=>S.track)==='manual','"by hand" chosen at setup');
 await p.click('[data-tab=more]');assert(!(await p.textContent('#panel-body')).includes('Tracking'),'no tracking option during the game');await p.click('[data-tab=play]');
 await p.evaluate(()=>{S.log.unshift({id:'a1',who:'Bob',turn:1,kind:'noise',sector:'N10',text:'noise',at:Date.now()});paintOverlay()});
 assert(await p.evaluate(()=>document.querySelectorAll('#marks .pm:not(.mine)').length)===0,'by hand: no automatic markers for other players');
 await p.click('#mkbar [data-act=markmode]');
 assert((await p.textContent('#panel-body')).includes('Marking'),'pencil opens marking mode (banner)');
 await p.click('#mkbar [data-act=markwho]');           // Bob is known from the log
 await p.evaluate(()=>{onCell('K10');onCell('L10')});
 assert(await p.evaluate(()=>S.marks.length)===2&&await p.evaluate(()=>document.querySelectorAll('#marks .pm:not(.mine)').length)===2,'tapping sectors marks the chosen player');
 await p.evaluate(()=>onCell('L10'));assert(await p.evaluate(()=>S.marks.length)===1,'tapping again removes the mark');
 await p.click('[data-act=mturn][data-d="1"]');await p.evaluate(()=>onCell('M10'));
 assert(await p.evaluate(()=>S.marks.some(m=>m.sector==='M10'&&m.turn===2)),'turn number of the mark can be changed');
 await p.click('#mkbar [data-act=addplayer]');await p.evaluate(()=>onCell('O09'));
 assert(await p.evaluate(()=>S.marks.some(m=>m.key==='n:zoe')),'a new player can be added and marked');
 await p.screenshot({path:SS+'/man-mark.png'});
 await p.click('.banner [data-act=markmode]');
 assert(await p.evaluate(()=>!T.markMode)&&(await p.textContent('#panel-body')).includes('highlighted'),'Done returns to the game');
 // notes
 await p.click('[data-act=notemode]');await p.evaluate(()=>{const cb=T.pick.cb;T.pick=null;cb('J10')});
 await p.click('dialog .stick button:nth-child(3)');await p.fill('#note-txt','alien came from here?');await p.click('#d-yes');
 assert(await p.evaluate(()=>S.notes.length===1&&S.notes[0].icon==='👽')&&await p.evaluate(()=>document.querySelectorAll('#notes .sticker').length)===1,'note sticker added on the map');
 await p.evaluate(()=>{S.phase='resolve';onCell('J10')});
 assert((await p.textContent('#inspect')).includes('alien came from here?'),'tapping the sector shows the note');
 await p.click('#inspect [data-act=noteedit]');await p.click('#d-del');
 assert(await p.evaluate(()=>S.notes.length)===0,'note can be deleted');
 const fits=await p.evaluate(()=>{const z=document.querySelector('.zoom').getBoundingClientRect(),s=document.querySelector('#stage').getBoundingClientRect();return z.top>=s.top});
 assert(fits,'map buttons still fit in the map area');
 console.log('errors',errs);await b.close()})()
