// Every map: one Human and one Alien start, and a Human can reach every hatch. Run: node tests/maps.check.js
const maps=require('../maps/maps.json').maps;let bad=0;
for(const m of maps){const g=m.rows_data,R=g.length,C=g[0].length,odd=m.oddColumnsLower!==false;
 const nb=(c,r)=>{const low=odd?c%2===1:c%2===0;const d=low?[[0,-1],[0,1],[-1,0],[-1,1],[1,0],[1,1]]:[[0,-1],[0,1],[-1,-1],[-1,0],[1,-1],[1,0]];return d.map(([a,b])=>[c+a,r+b]).filter(([a,b])=>a>=0&&b>=0&&a<C&&b<R)};
 const find=ch=>{const o=[];g.forEach((row,r)=>[...row].forEach((x,c)=>{if(x===ch)o.push([c,r])}));return o};
 const H=find('H'),A=find('A'),hatches=['1','2','3','4'].filter(n=>find(n).length);
 const seen=new Set([H[0]+'']),q=[H[0]],reached=new Set();
 while(q.length){const [c,r]=q.pop();for(const [a,b] of nb(c,r)){const t=g[b][a],k=a+','+b;if(seen.has(k)||t==='x'||t==='H'||t==='A')continue;seen.add(k);if('1234'.includes(t)){reached.add(t);continue}q.push([a,b])}}
 const alienOut=nb(...A[0]).some(([a,b])=>'.s'.includes(g[b][a]));
 const ok=H.length===1&&A.length===1&&hatches.every(h=>reached.has(h))&&alienOut;if(!ok)bad++;
 console.log((ok?'ok  ':'FAIL')+` ${m.pack} / ${m.name}: hatches ${hatches.join('')}, reachable ${[...reached].sort().join('')}, alien exit ${alienOut}`)}
process.exitCode=bad?1:0;
