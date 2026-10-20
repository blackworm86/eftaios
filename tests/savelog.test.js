// The saved game log holds the routes, roles and log of a finished game. Static server on :8123.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:900,height:800},serviceWorkers:'block',acceptDownloads:true});await ctx.addInitScript(()=>{window.__botPace=0});
 const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8123/');await p.waitForFunction(()=>window.Hot&&T.maps.length>3);
 await p.evaluate(async()=>{await Hot.start(['A','B','C','D'],'galilei','ultimate','auto',['hard','hard','hard','hard'])});
 await p.evaluate(()=>{window.__f=null;saveMapFile=async(n,j)=>{window.__f={n,j}}});
 await p.evaluate(()=>saveGameLog());
 const f=await p.evaluate(()=>window.__f);const d=JSON.parse(f.j);
 assert(/^eftaios-game-/.test(f.n)&&d.seats.length===4&&d.seats.every(s=>s.path&&s.path.length>1&&s.bot),'every seat has its real route and bot level');
 assert(Array.isArray(d.log)&&d.log.length>10&&d.mode&&d.map&&d.mapRows,'the log, mode and map are included');
 assert(d.result&&d.result.reason,'the result is included');
 console.log('errors',errs);await b.close();})();
