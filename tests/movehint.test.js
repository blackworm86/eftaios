// Reach highlight only on my turn; confirm/deny on the map; declarations stay in the move panel; sheet marks; tap to centre; role colours. Static server on :8123.
const {assert,setup,startTable,begin,current}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);
  const code=await startTable(pages);await begin(pages);
  const mover=await current(pages),other=pages.find(p=>p!==mover);
  await mover.waitForFunction(()=>S.phase==='move'&&T.reach&&T.reach.size>0);
  assert(await other.evaluate(()=>T.reach.size===0&&!document.querySelector('.hex.reach')),'a player waiting for their turn sees no highlighted sectors');
  assert(await mover.evaluate(()=>T.reach.size>0&&!!document.querySelector('.hex.reach')),'the player whose turn it is sees them');
  // a declaration from the other player stays visible in the move panel
  await mover.evaluate(()=>{S.log.unshift({id:'d1',by:'u2',who:'Zed',turn:S.turn,kind:'noise',sector:'K10',text:'noise',at:Date.now()});render()});
  assert((await mover.textContent('#panel-body')).includes('Noise in Sector K10'),'what the others declared stays in the move panel');
  // confirm / deny next to the tapped sector
  const id=await mover.evaluate(()=>[...T.reach.keys()].find(k=>at(T.map,k)==='.'));
  await mover.evaluate(i=>selectCell(i),id);
  assert(await mover.evaluate(()=>!document.querySelector('#movepick').hidden),'confirm and deny buttons show next to the tapped sector');
  await mover.click('#movepick [data-act=mpno]');
  assert(await mover.evaluate(()=>T.sel===null&&document.querySelector('#movepick').hidden),'deny clears the selection');
  await mover.evaluate(i=>selectCell(i),id);await mover.click('#movepick [data-act=mpyes]');
  assert(await mover.evaluate(i=>S.pos===i&&S.phase==='resolve',id),'confirm moves there');
  assert(await mover.evaluate(()=>T.reach.size===0&&!document.querySelector('#movepick [data-act=mpyes]')),'no highlights and no move buttons once moved');
  // sheet: silence marks, role colours, tap to centre
  await mover.evaluate(()=>{S.log.unshift({id:'s1',by:myId(),who:'Me',turn:S.turn,kind:'silence',text:'secure',at:1,mine:true},{id:'s2',by:myId(),who:'Me',turn:S.turn,kind:'info',text:'kill|Zed|human',at:2,mine:true});
    S.path=[{turn:0,pos:'L06'},{turn:1,pos:'L07'},{turn:1,pos:'M10',note:'reborn'},{turn:2,pos:'M11'}];S.turn=2;S.role='alien';S.reborn=true;setTab('table');T.tableSec='sheet';render()});
  const cells=await mover.evaluate(()=>[...document.querySelectorAll('#sheet tbody tr:first-child td')].map(td=>td.className+'|'+td.querySelectorAll('.ci svg').length));
  assert(cells[0].includes('rh')&&cells[1].includes('ra'),'the sheet shows Human turns blue and Alien turns red ('+cells.join(' ; ')+')');
  assert(await mover.evaluate(()=>document.querySelectorAll('#sheet .ci svg').length>=2),'the sheet shows the silence and kill symbols');
  await mover.evaluate(()=>{const td=document.querySelector('#sheet td[data-act=gosector]');td.click()});
  assert(await mover.evaluate(()=>T.inspect&&T.inspect===document.querySelector('#sheet td[data-act=gosector]').dataset.s),'tapping a sheet cell centres and flashes its sector');
  assert((await mover.evaluate(()=>{T.tableSec='log';render();return document.querySelector('.log li.kill')?document.querySelector('.log li.kill').textContent:''})).includes('killed Zed'),'the log says who killed whom');
  // game-over map: a Human killed and reborn shows blue where they were Human and red where they were Alien
  const cols=await mover.evaluate(()=>{const marks=document.querySelector('#marks');marks.textContent='';
    const hp=sec=>{const q=parseId(sec);return hexPos(T.map,q[0],q[1])};
    paintRoutes([{key:'u:x',role:'alien',path:[{turn:0,pos:'L06'},{turn:1,pos:'L07'},{turn:1,pos:'M10',note:'reborn'},{turn:2,pos:'M11'}]}],[],hp,marks);
    return [...marks.querySelectorAll('g.route')].map(g=>[...g.querySelectorAll('path')].map(p=>p.getAttribute('stroke')).filter(Boolean).pop())});
  assert(cols.length===4&&cols[0]==='#2f7dff'&&cols[1]==='#2f7dff'&&cols[2]==='#ff3b30'&&cols[3]==='#ff3b30','final routes: Human turns blue, Alien turns red ('+cols.join(',')+')');
  console.log('errors',errs);await b.close();
})();
