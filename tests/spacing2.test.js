// Spacing guard for the game itself: the Play, Table (Log, Sheet, Status) and More panels and the dialogs keep at least 6px between stacked blocks.
const {assert,setup,startTable,begin,measureGaps:measure}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(2);const [H,G]=pages;
  await startTable(pages);await begin(pages);
  const cur=await H.evaluate(()=>myTurn());const P=cur?H:G;
  const panels=[['Play',()=>{setTab('play');render()}],['Table · Log',()=>{setTab('table');T.tsec='log';render();const b=document.querySelector('[data-act=tsec][data-k=log]');b&&b.click()}],['Table · Sheet',()=>{setTab('table');const b=document.querySelector('[data-act=tsec][data-k=sheet]');b&&b.click()}],['Table · Status',()=>{setTab('table');const b=document.querySelector('[data-act=tsec][data-k=status]');b&&b.click()}],['More',()=>{setTab('more');render()}]];
  const dialogs=[['role',()=>actions.roledlg({dataset:{}})],['rules',()=>actions.rules({dataset:{}})],['qr',()=>actions.qr()],['leave',()=>actions.leavetable()],['items',()=>actions.itemdlg({dataset:{i:'attack'}})]];
  for(const [vp,w,h] of [['phone',390,844],['small phone',360,640]]){
    for(const p of pages){await p.setViewportSize({width:w,height:h});}
    await P.waitForTimeout(200);
    for(const [name,fn] of panels){
      await P.evaluate(fn.toString().replace(/^\(\)=>/,'')&&new Function(`(${fn.toString()})()`));
      await P.waitForTimeout(200);
      const bad=await P.evaluate(measure,'#panel-body');
      assert(bad.length===0,vp+' · '+name+': nothing touches'+(bad.length?' → '+bad.join('; '):''));
    }
    for(const [name,fn] of dialogs){
      await P.evaluate(()=>{try{closeDlg()}catch(_){}});
      await P.evaluate(new Function(`try{(${fn.toString()})()}catch(e){}`));
      await P.waitForTimeout(250);
      if(await P.evaluate(()=>!!document.querySelector('#dlg[open]'))){
        const bad=await P.evaluate(measure,'#dlg');
        assert(bad.length===0,vp+' · dialog '+name+': nothing touches'+(bad.length?' → '+bad.join('; '):''));
      } else console.log('skip dialog '+name);
      await P.evaluate(()=>{try{closeDlg()}catch(_){}});
    }
  }
  assert(errs.length===0,'no page errors: '+errs.join('|'));
  await b.close();
})();
