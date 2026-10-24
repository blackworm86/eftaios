// Adrenaline and Teleport on the map at the start of the move; the Status pods in the map's colours.
const {assert,setup,startTable,begin,current}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);await startTable(pages);await begin(pages);
  const P=await current(pages);
  const r=await P.evaluate(()=>{S.role='human';S.items=['adrenaline','teleport','cat'];S.adr=false;S.phase='move';T.sel=null;T.pick=null;T.rng=null;S.tab='play';S.pos='K10';render();paintOverlay();
    return {bar:!document.querySelector('#premove').hidden,btns:[...document.querySelectorAll('#premove [data-i]')].map(x=>x.dataset.i),hand:[...document.querySelectorAll('#panel-body .slots [data-i]')].map(x=>x.dataset.i)}});
  assert(r.bar&&r.btns.join()==='adrenaline,teleport','the two pre-move items are on the map ('+r.btns+')');
  assert(r.hand.join()==='cat','the hand panel does not repeat them ('+r.hand+')');
  const sel=await P.evaluate(()=>{T.sel=[...T.reach.keys()][0];render();paintOverlay();return !document.querySelector('#premove').hidden});
  assert(!sel,'once a destination is picked the row is gone');
  const sl=await P.evaluate(()=>{T.sel=null;T.rng=[1,1];render();paintOverlay();return {bar:!document.querySelector('#premove').hidden,hand:[...document.querySelectorAll('#panel-body .slots [data-i]')].map(x=>x.dataset.i)}});
  assert(!sl.bar&&sl.hand.includes('adrenaline'),'with the turn slider open the items stay reachable in the hand');
  await P.evaluate(()=>{T.rng=null;S.tab='play';render();paintOverlay()});
  await P.click('#premove [data-i=adrenaline]');assert(await P.locator('dialog[open]').count()===1,'tapping one asks to confirm, like a card in the hand');
  await P.evaluate(()=>closeDlg());
  // pods: blue open, green escaped, red damaged, as on the map
  const pods=await P.evaluate(()=>{S.hatches={};const hs=mapHatches();S.hatches[hs[0]]=1;S.hatches[hs[1]]=1;S.log.unshift({id:'p1',by:'',who:'Zed',turn:2,kind:'hatch',text:'hatch',sector:'A01',n:hs[0],ok:1,at:Date.now(),mine:false},{id:'p2',by:'',who:'Zed',turn:2,kind:'hatch',text:'hatch',sector:'A02',n:hs[1],ok:0,at:Date.now(),mine:false});
    S.tab='table';T.tableSec='status';render();return [...document.querySelectorAll('.sec.status .hatches .hb')].map(x=>x.className.replace('hb','').trim()||'open')});
  assert(pods[0]==='closed green'&&pods[1]==='closed red'&&pods[2]==='open','Status pods: green escaped, red damaged, blue open ('+pods+')');
  console.log('errors',errs);await b.close();
})();
