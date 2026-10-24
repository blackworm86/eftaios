// Anonymous game records: on by default, off when the player says so, no names in the record, opted-out humans left out. Static server on :8123.
const {assert,setup}=require('./helpers');
(async()=>{
  const {b,pages,errs}=await setup(1);const [P]=pages;
  await P.goto('http://localhost:8123/');
  assert(await P.evaluate(()=>Records.on()),'sharing is on by default');
  assert(await P.locator('[data-act=share][data-v=off]').count()===1,'the start screen has the switch');
  await P.click('[data-act=share][data-v=off]');assert(!await P.evaluate(()=>Records.on()),'the player can turn sharing off');
  await P.click('[data-act=share][data-v=on]');
  // a pass-and-play game with bots: the record has seats and routes by number, no names
  const rec=await P.evaluate(async()=>{
    window.__sent=[];Sync.record=async r=>{window.__sent.push(r)};
    await Hot.start(['Maria Rossi','b1','b2','b3'],'galilei','ultimate','auto',['','hard','hard','hard']);closeDlg();
    S.over='dead';S.outSent=false;afterChange();
    for(let k=0;k<200&&!Hot.isOver();k++)await new Promise(r=>setTimeout(r,200));
    Records.maybeSend();Records.maybeSend();   // twice: still one record
    return {n:window.__sent.length,rec:window.__sent[0]};
  });
  assert(rec.n===1,'one record per game ('+rec.n+')');
  const g=JSON.parse(rec.rec.game);
  assert(!rec.rec.game.includes('Maria'),'no names in the record (player)');{const m=rec.rec.game.match(/.{60}("b[123]"|Bot).{40}/);assert(!m,'no names in the record (bots) '+(m?m[0]:''))}
  assert(g.seats.length===4&&g.seats[1].kind==='hard'&&g.seats[0].kind==='human'&&g.seats[0].route,'seats have kind and route ('+g.seats.map(s=>s.kind).join(',')+')');
  assert(g.log.length>3&&g.log.every(e=>typeof e.s==='number'),'announcements are by seat number');
  // opted-out human: bare seat, announcements left out
  const opt=await P.evaluate(()=>{const s=Records.snapshot();s.seats[0].share=false;const r=Records.build(s);return {seat:r.seats[0],mine:r.log.filter(e=>e.s===0).length}});
  assert(opt.seat.optout===1&&!opt.seat.route&&opt.mine===0,'an opted-out human is a bare seat with no announcements');
  // off: nothing is sent
  const off=await P.evaluate(async()=>{Records.set(false);T.recKey=null;window.__sent=[];Records.maybeSend();return window.__sent.length});
  assert(off===0,'nothing is sent when sharing is off');
  console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
})();
