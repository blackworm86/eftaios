// Every English string passed to t('...') has an Italian entry, so no English islands in the Italian screens.
const fs=require('fs');
const src=fs.readFileSync('i18n.js','utf8'),it=new Set([...src.matchAll(/^"((?:[^"\\]|\\.)*)":/gm)].map(m=>JSON.parse('"'+m[1]+'"')));
const files=fs.readdirSync('.').filter(f=>f.endsWith('.js')&&!['i18n.js','gicons.js','cards.js','sw.js','firebase-config.js'].includes(f));
// strings that are data, not text for the screen, or are dynamic: skipped on purpose
const skip=s=>!/[A-Za-z]{2}/.test(s)||/^[a-z0-9_:.\-/|]+$/.test(s)||s.length<2;
const missing=new Map();
for(const f of files){const s=fs.readFileSync(f,'utf8');
  for(const m of s.matchAll(/\bt\(\s*'((?:[^'\\\n]|\\.)*)'/g)){const k=m[1].replace(/\\'/g,"'");if(!it.has(k)&&!skip(k))missing.set(k,f)}}
for(const f of ['index.html']){const s=fs.readFileSync(f,'utf8');for(const m of s.matchAll(/data-i18n(?:-ph|-aria)?="([^"]+)"/g))if(!it.has(m[1])&&!skip(m[1]))missing.set(m[1],f)}
if(missing.size){console.error('FAIL '+missing.size+' strings have no Italian entry:');for(const [k,f] of missing)console.error('  '+f+': '+k);process.exitCode=1}else console.log('ok   every screen string has an Italian entry ('+it.size+' translations)');
