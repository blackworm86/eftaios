// The network input the app computes at every move of 6 Hard-bot games (including the Hard bot's picture of the table) as a number, written to /tmp/chk.json; rl/tests/check_obs.py replays the same games in Python and compares. Needs the static server on :8123.
const {setup}=require('/home/user/eftaios/tests/helpers');const fs=require('fs');
(async()=>{const {b,pages}=await setup(1);const [P]=pages;
await P.goto('http://localhost:8123/');await P.waitForFunction(()=>window.NN&&window.Hot&&T.maps.length>3);
const out=[];
for(let g=0;g<6;g++){
 const r=await P.evaluate(async g=>{window.__rng=(a=>{a=a>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}})(g+11);window.__tr=[];window.__chk=[];const n=[3,4,6,8,5,7][g],setup=dealRoles(n);
  await Hot.start(['A','B','C','D','E','F','G','H'].slice(0,n),['galilei','fermi','volta','socrates','marconi','engarde'][g],'ultimate','auto',Array(n).fill('hard'),setup);
  const d=Hot.dump(),ids=d.seats.map(x=>x.id),cell=x=>{const q=x?parseId(x):null;return q?q[1]*T.map.cols+q[0]:null};
  return {map:d.map,n,setup:setup.map(x=>({role:x.role,char:x.char})),tr:window.__tr,result:d.result,log:d.log.slice().reverse().filter(e=>ids.includes(e.by)).map(e=>[e.turn,ids.indexOf(e.by),e.kind,cell(e.sector),String(e.text||'')]),chk:window.__chk}},g);
 out.push(r)}
fs.writeFileSync('/tmp/chk.json',JSON.stringify(out));await b.close()})();
