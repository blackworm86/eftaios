// Player bubbles (outline, square, guess box, picking, Show all, compact), facts, the end-of-game reveal, the cap on fake marks.
const {assert,setup,startTable,begin,uidOf}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(3);const [H,A,B]=pages;
  await startTable(pages);await begin(pages);
  const uA=await uidOf(A);
  assert(await H.locator('#mkbar .pb').count()===3,'one bubble for me and one for each other player');
  // guess: the square opens a box with three big buttons
  const kA='u:'+uA;
  await H.click(`#mkbar [data-act=pguess][data-k="${kA}"]`);
  assert(await H.locator('#guesspop button').count()===3,'tapping the square opens the guess box (? / Human / Alien)');
  const box=await H.locator('#guesspop button').first().boundingBox();assert(box.height>=44&&box.width>=44,'guess buttons are finger sized ('+Math.round(box.width)+'x'+Math.round(box.height)+')');
  await H.click('#guesspop [data-v=alien]');
  assert(await H.evaluate(k=>S.sus[k]==='alien',kA)&&await H.locator('#guesspop').count()===0,'a guess is saved and closes the box');
  assert(await H.locator(`#mkbar .pb.guess`).count()===1,'a guess has the thin outline');
  // known: an attack with no Attack card in an online game
  await H.evaluate(u=>{S.log.unshift({id:'atk1',by:u,who:'P1',turn:S.turn,kind:'attack',text:'attack',sector:'K10',mine:false,at:Date.now()});paintOverlay()},uA);
  assert(await H.locator('#mkbar .pb.known').count()===1&&await H.locator('#mkbar .plk').count()===0&&await H.locator(`#mkbar [data-act=pguess][data-k="${kA}"]`).count()===0,'a known faction has the thick outline (no lock) and cannot be guessed');
  assert(await H.evaluate(u=>/Alien/.test(entryText(S.log[0])),uA),'the attack line says Alien');
  // companion mode: a hand-typed attack proves nothing
  const comp=await H.evaluate(u=>{S.online=false;const r=factOf('u:'+u).role||'';S.online=true;return r},uA);
  assert(comp==='','in companion mode an attack does not mark anybody an Alien');
  // pick for the map, Show all
  const uB=await uidOf(B);
  await H.click(`#mkbar [data-act=pfocus][data-k="u:${uB}"]`);
  assert(await H.evaluate(()=>T.focusSet.length===1)&&await H.locator('#mkbar .pb.picked').count()===1&&await H.locator('#mkbar .pb.off').count()===2,'tapping a bubble picks that player; the others fade');
  await H.click('#mkbar [data-act=pshowall]');
  assert(await H.evaluate(()=>!T.focusSet.length)&&await H.locator('#mkbar .pb.off').count()===0&&await H.locator('#mkbar [data-act=pshowall]').count()===1,'Show all brings everybody back');
  // compact: guessing is full view only, the outline stays
  await H.click('#mkbar [data-act=pcompact]');
  assert(await H.locator('#mkbar .pb.mini').count()===3&&await H.locator('#mkbar [data-act=pguess]').count()===0,'the compressed strip has no guess squares');
  const bw=await H.evaluate(u=>{const e=document.querySelector(`#mkbar .pb.mini[data-k="u:${u}"]`);const c=getComputedStyle(e);return [c.borderTopWidth,c.borderTopColor]},uB);
  assert(bw[0]==='3px'&&bw[1]==='rgb(255, 210, 63)','a compressed tile keeps the yellow outline ('+bw+')');
  await H.click('#mkbar [data-act=pcompact]');
  // the end of the game shows every Character
  const end=await H.evaluate(u=>{Sync.settings.status='over';const p=Sync.players[u];const keep=[p.role,p.char,p.conv];p.role='human';p.char='Captain';p.conv=false;const f=factOf('u:'+u);p.role=keep[0];p.char=keep[1];p.conv=keep[2];Sync.settings.status='playing';return f},uA);
  assert(end.role==='human'&&end.char==='Captain','at game over the table shows the real faction and Character');
  // fake marks never grow past what the journal can hold
  const cap=await H.evaluate(()=>{for(let i=0;i<150;i++)S.log.unshift({id:'m'+i,by:'',who:'Zed',turn:1,kind:'noise',text:'noise',sector:'K10',mine:false,at:Date.now()});for(let i=0;i<150;i++)setFake('m'+i,'f');return [Object.keys(fakeMap()).length,journalOf().sus.length]});
  assert(cap[0]<=120&&cap[1]<4000,'fake marks are capped so the journal save is never refused ('+cap+')');
  console.log('errors',errs);await b.close();
})();
