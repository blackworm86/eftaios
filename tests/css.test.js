// style.css is well formed: braces balance, and no stray closing brace swallows the next rule (one did, and the More menu lost its layout).
const fs=require('fs');
const s=fs.readFileSync('style.css','utf8').replace(/\/\*[\s\S]*?\*\//g,'');
let d=0,bad=null;
for(let i=0,line=1;i<s.length;i++){const c=s[i];if(c==='\n')line++;if(c==='{')d++;else if(c==='}'){d--;if(d<0&&!bad)bad=line}}
console.log((d===0&&!bad?'ok   ':'FAIL ')+'style.css braces balance'+(bad?' (stray } near line '+bad+' of the comment-free text)':d?' (depth '+d+')':''));
if(d!==0||bad)process.exitCode=1;
