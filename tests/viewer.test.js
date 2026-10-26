// The game viewer (Admin > Games): sample games of the network, a saved game log, the slider, the players and the events. Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.Viewer&&window.Hot&&T.maps.length>3);
  await P.evaluate(()=>{Sync.isAdmin=true;S.stage='admin';T.adminTab='games';T.admin={};renderFlow()});
  assert(await P.locator('[data-act=vwsrc]').count()===3,'the Games tab offers the three sources');
  const list=await P.evaluate(async()=>{Viewer.useFile(await (await fetch('tests/viewer-sample.json')).text(),'sample');return document.querySelectorAll('[data-act=vwopen]').length});
  assert(list===3,'three sample games are listed ('+list+')');
  await P.click('[data-act=vwopen][data-i="2"]');
  const d=await P.evaluate(()=>{const g=Viewer.state().st.games[2],map=T.maps.find(m=>m.id===g.map);const cells=map.grid.flat().filter(c=>c!=='x').length;
    return {hex:document.querySelectorAll('#vw-map polygon').length,cells,lines:document.querySelectorAll('#vw-map polyline').length,seats:g.seats.length,players:document.querySelectorAll('.plist li').length,turns:g.turns}});
  assert(d.hex===d.cells,'the map is drawn with all '+d.cells+' sectors');
  assert(d.lines>=1&&d.players>=d.seats,'routes and every player are shown ('+d.lines+' routes, '+d.players+' rows)');
  const moved=await P.evaluate(()=>{const before=document.getElementById('vw-map').innerHTML;Viewer.setTurn(1);const after=document.getElementById('vw-map').innerHTML;Viewer.setTurn(99);return {changed:before!==after,tn:document.getElementById('vw-tn').textContent,ev:document.querySelectorAll('#vw-ev li').length}});
  assert(moved.changed,'moving the slider redraws the routes');
  assert(+moved.tn<=40&&moved.ev>=1,'the turn is limited to the game and events are listed ('+moved.tn+')');
  // a game log saved from the app (pass and play with bots) opens straight away
  const dump=await P.evaluate(async()=>{await Hot.start(['A','B','C','D'],'galilei','ultimate','auto',['hard','hard','hard','hard']);const n=Hot.dump().seats.length;
    S.stage='admin';T.adminTab='games';Viewer.useFile(JSON.stringify(Hot.dump()),'log.json');const g=Viewer.state().st.games[0];
    return {n,seats:g.seats.length,routes:g.seats.every(s=>s.route.length>2),open:Viewer.state().cur,svg:!!document.querySelector('#vw-map svg')}});
  assert(dump.seats===4&&dump.routes&&dump.open===0&&dump.svg,'a saved game log of the app opens ('+dump.seats+' seats)');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
