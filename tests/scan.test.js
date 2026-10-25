// Joining a table by scanning its QR code with the camera. A fake camera plays a recorded QR code. Static server on :8123, needs python3 + PIL.
const {chromium}=require('/opt/node22/lib/node_modules/playwright');const {execFileSync}=require('child_process');const fs=require('fs');const os=require('os');const path=require('path');
const assert=(c,m)=>{if(!c){console.error('FAIL',m);process.exitCode=1}else console.log('ok  ',m)};
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'scan-'));
async function makeVideo(b,url,file){   // a 640x480 clip of the QR code on a white wall
  const p=await b.newPage({viewport:{width:480,height:480}});await p.goto('http://localhost:8123/');
  const svg=await p.evaluate(u=>qrSvg(u),url);
  await p.setContent(`<body style="margin:0;background:#fff;display:grid;place-items:center;height:480px"><div style="width:380px;height:380px">${svg.replace('<svg','<svg style="width:100%;height:100%"')}</div></body>`);
  await p.screenshot({path:file+'.png'});await p.close();
  execFileSync('python3',['-c',`
from PIL import Image
im=Image.open(${JSON.stringify(file+'.png')}).convert('L').resize((640,480))
Y=im.tobytes(); U=bytes([128])*(320*240)
with open(${JSON.stringify(file)},'wb') as f:
    f.write(b'YUV4MPEG2 W640 H480 F10:1 Ip A1:1 C420jpeg\\n')
    for _ in range(20): f.write(b'FRAME\\n'+Y+U+U)
`]);
}
(async()=>{
  const b0=await chromium.launch();
  const good=path.join(tmp,'good.y4m'),bad=path.join(tmp,'bad.y4m');
  await makeVideo(b0,'http://localhost:8123/?room=ABCD',good);await makeVideo(b0,'https://example.com/not-a-table',bad);await b0.close();
  for(const [name,video,expect] of [['a table QR code',good,'ABCD'],['a QR code that is not a table',bad,null]]){
    const b=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-video-capture='+video]});const errs=[];
    const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block',permissions:['camera']});const p=await ctx.newPage();p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8123/');
    assert(await p.locator('.joinrow [data-act=scanqr]').count()===1,'a QR button sits next to Join');
    const box=await p.evaluate(()=>{const j=document.querySelector('.joinrow [data-act=joinroom]').getBoundingClientRect(),s=document.querySelector('.joinrow [data-act=scanqr]').getBoundingClientRect();return {sameRow:Math.abs(j.top-s.top)<4,right:s.left>=j.right-1}});
    assert(box.sameRow&&box.right,'the QR button is on the same row, after Join');
    await p.evaluate(()=>{window.__joined=null;Sync.join=async c=>{window.__joined=c;return true}});
    await p.click('[data-act=scanqr]');await p.waitForSelector('#scan-video');
    if(expect){await p.waitForFunction(()=>window.__joined,null,{timeout:15000});
      assert(await p.evaluate(()=>window.__joined)===expect,'scanning '+name+' joins table '+expect);
      assert(await p.evaluate(()=>!document.querySelector('dialog[open]')),'the scanner closes after a scan');}
    else{await p.waitForFunction(()=>/not a game/.test(document.querySelector('#scan-msg').textContent),null,{timeout:15000});
      assert(await p.evaluate(()=>window.__joined)===null,'scanning '+name+' does not join anything');
      await p.click('#d-no');}
    assert(await p.evaluate(()=>!document.querySelector('dialog[open]')),'the scanner dialog is closed');
    console.log('errors',errs);if(errs.length)process.exitCode=1;await b.close();
  }
  // no camera: a clear message, nothing breaks
  const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:390,height:800},serviceWorkers:'block'});const p=await ctx.newPage();
  await p.goto('http://localhost:8123/');await p.click('[data-act=scanqr]');await p.waitForFunction(()=>/camera is not available/.test(document.querySelector('#scan-msg').textContent),null,{timeout:15000});
  assert(true,'without camera access the scanner explains it');
  await p.screenshot({path:(process.env.SS||'/tmp')+'/scan-nocam.png'});await b.close();
})();
