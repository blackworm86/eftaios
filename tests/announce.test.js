// Clear declarations, log filter, revealed Characters, the turn-count cycle. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const errs=[];
 const p=await (await b.newContext({viewport:{width:390,height:780},serviceWorkers:'block'})).newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.click('[data-act=hotsetup]');await p.click('[data-act=hotdel][data-i="3"]');await p.click('[data-act=hotstart]');await p.click('[data-act=hotgo]');await p.click('#d-no');
 // the turns button opens the turn slider, and closes it again
 await p.click('#mkbar [data-act=mkall]');assert(await p.locator('#tlbar:not([hidden]) .tl').count()===2,'the turns button opens a slider with two handles');
 await p.click('#tlbar [data-act=mkall]');assert(await p.locator('#tlbar:not([hidden])').count()===0,'the slider closes again');
 // another player's declaration: banner, and a revealed Character with its power
 await p.evaluate(()=>{S.mode='ultimate';S.turn=4;S.tab='table';const L=(who,by,turn,kind,text,sector)=>S.log.unshift({id:Math.random()+'',by,who,turn,kind,text,sector:sector||null,at:Date.now(),mine:false,remote:true});
  window.__L=L;L('Ben','b1',4,'noise','noise','K10');onPublicEntry(S.log[0]);});
 assert(await p.locator('#annbar .ann').count()===1&&/Ben/.test(await p.textContent('#annbar')),'a declaration shows as a banner over the map');
 await p.evaluate(()=>{window.__L('Cal','c1',4,'reveal','Id|human|Medic');onPublicEntry(S.log[0])});
 const dlgTxt=await p.textContent('dialog');
 assert(/Cal/.test(dlgTxt)&&/Medic/.test(dlgTxt)&&/identity/i.test(dlgTxt)&&await p.locator('dialog .gi').count()>=1,'a revealed Character shows with its icon and a reminder of its power');
 await p.click('#d-no');
 await p.evaluate(()=>{window.__L('Dee','d1',4,'out','killed|human|Captain');onPublicEntry(S.log[0])});
 assert(/Captain/.test(await p.textContent('dialog')),'the killed player Character card is shown to everyone');await p.click('#d-no');
 // log filter
 await p.evaluate(()=>{S.log.forEach(e=>{e.by=e.by||''});setTab('table');T.tableSec='log';render()});
 await p.click('[data-act=tsec][data-k=log]');
 const total=await p.locator('ul.log li').count();
 await p.click('.logfilter [data-act=logf]:nth-child(3)');
 const one=await p.locator('ul.log li').count();
 await p.click('.logfilter [data-act=logf]:nth-child(1)');
 assert(total>one&&one>=0&&await p.locator('ul.log li').count()===total,'the log filter narrows to chosen players and "All" brings everything back ('+total+' -> '+one+')');
 // the Status tab lists every Character seen so far
 await p.click('[data-act=tsec][data-k=status]');
 assert(/Medic/.test(await p.textContent('.sec.status'))&&await p.locator('.sec.status .chars .gi').count()>=2,'the Status tab lists the Character cards seen, with icons');
 // a Human killed and reborn as an Alien keeps the original Character card for the final reveal
 const keep=await p.evaluate(()=>{T.map=T.maps[0];const st={role:'human',char:'Captain',items:[],pos:'K09',path:[],fed:false};const r=resolveHit(st,'ultimate',3);return [st.role,st.char,st.reborn,abilOf(st,'ultimate'),r.char]});
 assert(keep[0]==='alien'&&keep[1]==='Captain'&&keep[2]===true&&keep[3]===''&&keep[4]==='Captain','the reborn Alien keeps the original Character card (without its power); the kill reveals it');
 console.log('errors',errs);await b.close();})();
