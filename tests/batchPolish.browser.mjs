// node tests/batchPolish.browser.mjs http://localhost:3137 http://127.0.0.1:9228
import assert from "node:assert/strict";
import JSZip from "jszip";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { browserClient } from "./browserClient.mjs";

const { send, evaluate, waitFor, errors, requests, close } = await browserClient(process.argv[3]);
const button = label => `Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === ${JSON.stringify(label)})`;
const thumbs = `document.querySelectorAll('[data-image-id]')`;
const active = `document.querySelector('[data-image-id][aria-current=true]')`;
async function click(label) { await evaluate(`${button(label)}.click()`); }
async function input(selector, value) {
  await evaluate(`(() => { const e=document.querySelector(${JSON.stringify(selector)}); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(String(value))}); e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
}
async function upload(expression, expected) {
  const start = performance.now();
  await evaluate(`(() => { const t=new DataTransfer(); for(const f of ${expression}) t.items.add(f); const e=document.querySelector('input[aria-label="Add image files"]') ?? document.querySelector('input[type=file]'); e.files=t.files; e.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  await waitFor(`${thumbs}.length === ${expected} && !document.body.textContent.match(/Preparing [0-9]+ of/)`, 1000);
  return Math.round(performance.now()-start);
}
async function select(index) {
  await evaluate(`${thumbs}[${index}].click()`);
  await waitFor(`${thumbs}[${index}].getAttribute('aria-current') === 'true' && document.querySelector('.ratio-viewport').getAttribute('aria-busy') === 'false'`);
  await new Promise(r => setTimeout(r, 100));
}
async function option(id, label) {
  await evaluate(`document.querySelector('#${id}').click()`);
  await waitFor(`!!document.querySelector('#${id}-options [role=option]')`);
  await evaluate(`Array.from(document.querySelectorAll('#${id}-options [role=option]')).find(e=>e.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);
}
async function targets(ratios, size = "Custom") {
  await click("Options"); await waitFor(`!!document.querySelector('#export-options')`); await click("Clear");
  assert.equal(await evaluate(`${button("Download Batch")}.disabled && document.body.textContent.includes('Select at least one ratio in Options.')`),true);
  for (const ratio of ratios) await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(e=>e.textContent.trim()===${JSON.stringify(ratio)}).querySelector('input').click()`);
  await option("export-size", size);
  if (size === "Custom") await input('#export-options input[inputmode=numeric]', 64);
  await click("Options");
}
async function download(label) {
  const previous = await evaluate(`window.__downloads.length`);
  await click(label);
  await waitFor(`window.__downloads.length > ${previous} && !${button("Download Image")}.disabled`, 1000);
  return evaluate(`window.__downloads.at(-1).name`);
}
async function zip() {
  const base64 = await evaluate(`window.__base64(window.__downloads.at(-1).blob)`);
  return JSZip.loadAsync(Buffer.from(base64, "base64"));
}
async function clear() {
  await click("Clear batch"); await click("Clear all images");
  await waitFor(`!document.querySelector('.ratio-viewport')`);
  await evaluate(`window.__downloads=[]; window.__timers.splice(0).forEach(callback=>callback());`);
  assert.equal(await evaluate(`window.__urls.size`), 0, "all source and expired download URLs released");
  assert.equal(await evaluate(`window.__bitmapLive`), 0);
  assert.equal(await evaluate(`window.__canvases.every(c=>c.width===0&&c.height===0)`), true);
  await evaluate(`window.__canvases=[]`);
}
async function drag(offset) {
  const p = await evaluate(`(() => { document.querySelector('.ratio-viewport').scrollIntoView({block:'center'}); const r=document.querySelector('.ratio-viewport').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await send("Input.dispatchMouseEvent", {type:"mousePressed",...p,button:"left",buttons:1,clickCount:1});
  for(const x of [offset/3,offset*2/3,offset]) await send("Input.dispatchMouseEvent", {type:"mouseMoved",x:p.x+x,y:p.y,buttons:1});
  await send("Input.dispatchMouseEvent", {type:"mouseReleased",x:p.x+offset,y:p.y,button:"left",buttons:0});
  await new Promise(r=>setTimeout(r,100));
}

try {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable"); await send("Performance.enable");
  await send("Page.setDownloadBehavior", {behavior:"deny"});
  await send("Emulation.setDeviceMetricsOverride", {width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send("Emulation.setEmulatedMedia", {features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await send("Page.navigate", {url:process.argv[2] ?? "http://localhost:3137"});
  await waitFor(`document.querySelector('input[type=file]') && Object.keys(document.querySelector('input[type=file]')).some(k=>k.startsWith('__reactProps'))`);
  await evaluate(`(async () => {
    window.__downloads=[]; window.__urls=new Map(); window.__canvases=[]; window.__timers=[];
    window.__bitmapLive=0; window.__bitmapMax=0; window.__progress=[]; window.__announcements=[]; window.__loadingFrames=[];
    const create=URL.createObjectURL.bind(URL), revoke=URL.revokeObjectURL.bind(URL);
    URL.createObjectURL=b=>{const u=create(b);window.__urls.set(u,b);return u;};
    URL.revokeObjectURL=u=>{window.__urls.delete(u);revoke(u);};
    const nativeTimeout=window.setTimeout.bind(window);
    window.setTimeout=(callback,delay,...args)=>{if(delay===60000){window.__timers.push(()=>callback(...args));return 0;}return nativeTimeout(callback,delay,...args);};
    const nativeBitmap=createImageBitmap;
    window.createImageBitmap=async(...args)=>{if(window.__slowExport) await new Promise(r=>nativeTimeout(r,35)); const b=await nativeBitmap(...args);window.__bitmapLive++;window.__bitmapMax=Math.max(window.__bitmapMax,window.__bitmapLive);const close=b.close.bind(b);let closed=false;b.close=()=>{if(!closed){closed=true;window.__bitmapLive--;}close();};return b;};
    const nativeCreate=document.createElement.bind(document);
    document.createElement=(...args)=>{const e=nativeCreate(...args);if(args[0]==='canvas')window.__canvases.push(e);return e;};
    const nativeClick=HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click=function(){if(this.download)window.__downloads.push({name:this.download,blob:window.__urls.get(this.href)});else nativeClick.call(this);};
    window.__base64=async blob=>{const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(binary);};
    new MutationObserver(()=>{
      const viewport=document.querySelector('.ratio-viewport');
      if(viewport?.getAttribute('aria-busy')==='true'){const r=viewport.getBoundingClientRect();window.__loadingFrames.push({width:r.width,height:r.height,placeholder:viewport.textContent.includes('Loading preview')});}
      const bar=document.querySelector('[role=progressbar]'); if(bar){const n=Number(bar.getAttribute('aria-valuenow'));if(window.__progress.at(-1)!==n)window.__progress.push(n);}
      const announcement=document.querySelector('[data-export-phase] .sr-only[role=status]')?.textContent;
      if(announcement&&window.__announcements.at(-1)!==announcement)window.__announcements.push(announcement);
    }).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['aria-valuenow','data-export-phase']});
    const c=document.createElement('canvas');c.width=1600;c.height=1000;
    const ctx=c.getContext('2d');const g=ctx.createLinearGradient(0,0,1600,1000);g.addColorStop(0,'#ee2200');g.addColorStop(.5,'#11aa33');g.addColorStop(1,'#0011ee');ctx.fillStyle=g;ctx.fillRect(0,0,1600,1000);
    const b=await new Promise(r=>c.toBlob(r));c.width=c.height=0;
    window.__files=Array.from({length:40},(_,i)=>new File([b],'photo-'+i+'.png',{type:'image/png',lastModified:i+1}));
  })()`);

  await upload('window.__files.slice(0,8)', 8); await waitFor(`document.querySelector('.ratio-viewport').getAttribute('aria-busy')==='false'`);
  assert.equal(await evaluate(`Array.from(${thumbs}).every(b=>window.__urls.get(b.querySelector('img').src) instanceof Blob && !(window.__urls.get(b.querySelector('img').src) instanceof File))`),true,"queue uses small generated previews, not original Files");
  assert.equal(await evaluate(`Array.from(${thumbs}).filter(b=>b.querySelector('img').complete).every(b=>b.querySelector('img').naturalWidth<=128 && b.querySelector('img').naturalHeight<=128)`),true);
  assert.equal(await evaluate(`Array.from(${thumbs}).some(b=>b.getAttribute('aria-label').includes(', edited'))`), false);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Previous image"]').disabled`), true);
  for(let i=0;i<8;i++){await select(i);await input('[aria-label="Zoom image"]',1.1+i*.1);}
  assert.equal(await evaluate(`document.body.textContent.includes('8 / 8 edited')`), true);
  const saved = await evaluate(`document.querySelector('.reactEasyCrop_Image').style.transform`);
  const activeId = await evaluate(`${active}.dataset.imageId`);
  await upload('window.__files.slice(8,12)', 12);
  assert.equal(await evaluate(`${active}.dataset.imageId`), activeId);
  assert.equal(await evaluate(`document.querySelector('.reactEasyCrop_Image').style.transform`), saved);
  assert.equal(await evaluate(`document.body.textContent.includes('8 / 12 edited')`), true);
  await select(11); assert.equal(await evaluate(`document.querySelector('[aria-label="Next image"]').disabled`), true);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Batch images"] [role=status]').textContent`), "12 of 12");
  await select(0); await click("Reset Image");
  assert.equal(await evaluate(`document.body.textContent.includes('7 / 12 edited')`), true);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Zoom image"]').value`), "1");
  await upload('[window.__files[0]]', 12);
  assert.equal(await evaluate(`document.body.textContent.includes('1 duplicate skipped')`), true);
  await evaluate(`${thumbs}[2].querySelector('img').dispatchEvent(new Event('error'))`);
  assert.equal(await evaluate(`${thumbs}[2].textContent.trim()`), "Preview");
  await evaluate(`document.querySelector('[aria-label="Remove photo-2.png from batch"]').click()`);
  assert.equal(await evaluate(`${thumbs}.length`), 11);
  await evaluate(`document.querySelector('[aria-label="Remove photo-11.png from batch"]').click()`);
  assert.equal(await evaluate(`${thumbs}.length`), 10);
  await waitFor(`document.activeElement.matches('[data-image-id]')`);
  console.log("Edited flags, 8+4 append, active-only Reset, duplicate feedback, failed thumbnail removal, boundaries and counters passed");

  await evaluate(`document.querySelector('[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await click("Apply 1:1 to all 10 images");
  await targets(["1:1","4:5","9:16"]);
  const direct = new Map();
  for(let i=0;i<10;i++) {
    await select(i); await input('[aria-label="Zoom image"]',1.2+i*.07); await drag(i%2 ? -90 : 90);
    const name=await download("Download Image");
    direct.set(name,await evaluate(`window.__base64(window.__downloads.at(-1).blob)`));
  }
  await evaluate(`window.__slowExport=true; window.__progress=[]; window.__announcements=[]`);
  const downloadCount=await evaluate(`window.__downloads.length`);
  await click("Download Batch");
  await waitFor(`!!document.querySelector('[role=progressbar]')`);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Replace image"]').disabled && document.querySelector('[aria-label="Remove image"]').disabled && document.querySelector('input[aria-label="Add image files"]').disabled`),true);
  await click("Options");
  assert.equal(await evaluate(`document.querySelector('#export-options > fieldset').disabled`),true);
  await click("Options");
  await input('[aria-label="Zoom image"]',2.7);
  await waitFor(`window.__downloads.length > ${downloadCount} && !${button("Download Image")}.disabled`,1000);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Zoom image"]').value`),"2.7","live edit remains saved after immutable export");
  await evaluate(`window.__slowExport=false`);
  const batch = await zip(); const paths=Object.keys(batch.files).filter(p=>!batch.files[p].dir);
  assert.equal(paths.length,30); assert.equal(new Set(paths.map(p=>p.split('/')[0])).size,10);
  for(const [name,bytes] of direct) assert.equal(await batch.file(paths.find(p=>p.endsWith('/'+name))).async('base64'),bytes);
  const progress = await evaluate(`window.__progress`);
  assert.equal(progress[0],0); assert.equal(progress.at(-1),30); assert.equal(progress.length,31);
  assert.ok(progress.every((n,i)=>!i||n>=progress[i-1]));
  assert.ok(await evaluate(`window.__announcements.length <= 14`));
  assert.equal(await evaluate(`document.querySelector('[data-export-phase]').dataset.exportPhase`), "success");
  assert.equal(await evaluate(`document.body.textContent.includes('30 files downloaded.')`), true);
  assert.equal(await evaluate(`document.body.textContent.includes('10 images') && document.body.textContent.includes('30 files will be exported') && document.body.textContent.includes('PNG · Lossless')`), true);
  for(const path of paths) {
    const bytes=await batch.file(path).async('base64');
    const dims=await evaluate(`(async()=>{const b=await(await fetch('data:image/png;base64,'+${JSON.stringify(bytes)})).blob();const i=await createImageBitmap(b);const d=[i.width,i.height];i.close();return d;})()`);
    const ratio=path.includes('-1x1.')?1:path.includes('-4x5.')?.8:9/16;
    assert.ok(Math.abs(dims[0]/dims[1]-ratio)<.015,`${path}: ${dims}`);
  }
  console.log("10 × 3 outputs: all 30 ZIP files checked; ten direct PNG comparisons preserve independent framing despite a live edit; source/settings locks, exact progress and throttled announcements passed");

  const before = [];
  for(let i=0;i<10;i++){await select(i);before.push(await evaluate(`document.querySelector('[aria-label="Zoom image"]').value`));}
  await evaluate(`document.querySelector('[aria-label="Set aspect ratio to 4 by 5"]').click()`);
  await click("Apply 4:5 to all 10 images");
  for(let i=0;i<10;i++){await select(i);assert.equal(await evaluate(`document.querySelector('[aria-label="Zoom image"]').value`),before[i]);}
  assert.equal(await evaluate(`document.body.textContent.includes('Applied 4:5 to all 10 images. Framing was kept.')`),true);
  await evaluate(`window.__encode=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=callback=>setTimeout(()=>callback(null),0);`);
  const failedFraming=await evaluate(`document.querySelector('.reactEasyCrop_Image').style.transform`);
  await click("Download Batch"); await waitFor(`document.querySelector('[data-export-phase]').dataset.exportPhase==='error'`);
  assert.ok(await evaluate(`document.body.textContent.includes('photo-0.png') && document.body.textContent.includes('Your edits are still saved')`));
  assert.equal(await evaluate(`document.querySelector('.reactEasyCrop_Image').style.transform`),failedFraming);
  await click("Options"); await click("Options");
  assert.ok(await evaluate(`!!${button("Retry batch")}`),"inspecting settings keeps failure feedback and retry available");
  await evaluate(`HTMLCanvasElement.prototype.toBlob=window.__encode`);
  await download("Retry batch"); const retried = await zip();
  assert.equal(Object.keys(retried.files).filter(p=>!retried.files[p].dir).length,30);
  console.log("Apply 4:5 preserves each zoom; named failure retains framing and Retry downloads the complete batch");

  await send("Emulation.setDeviceMetricsOverride",{width:320,height:900,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.querySelector('[aria-label="Batch images"]').scrollIntoView({block:'center'})`);
  const pageY=await evaluate(`scrollY`);await select(9);
  assert.equal(await evaluate(`scrollY`),pageY);
  assert.equal(await evaluate(`(()=>{const a=${active}.getBoundingClientRect(),r=document.querySelector('[aria-label="Batch images"] ul').getBoundingClientRect();return a.left>=r.left-2&&a.right<=r.right+2;})()`),true);
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[aria-label="Batch images"] button')).every(b=>b.getBoundingClientRect().height>=44)`),true);
  const wheel=await evaluate(`(()=>{const rail=document.querySelector('[aria-label="Batch images"] ul');const e=new WheelEvent('wheel',{deltaY:100,bubbles:true,cancelable:true});rail.dispatchEvent(e);return e.defaultPrevented;})()`);
  assert.equal(wheel,false,"vertical wheel keeps native page scrolling");
  const p=await evaluate(`(()=>{const r=document.querySelector('[aria-label="Batch images"] ul').getBoundingClientRect();return{x:r.left+80,y:r.top+25};})()`);
  const scrollBefore=await evaluate(`document.querySelector('[aria-label="Batch images"] ul').scrollLeft`);
  await send("Input.dispatchMouseEvent",{type:"mouseWheel",...p,deltaX:-180,deltaY:0});
  await new Promise(r=>setTimeout(r,200));
  assert.ok(await evaluate(`document.querySelector('[aria-label="Batch images"] ul').scrollLeft < ${scrollBefore}`));
  await select(5); await select(4); await select(3); await select(2);
  assert.equal(await evaluate(`document.querySelector('[aria-label="Batch images"] [role=status]').textContent`),"3 of 10");
  assert.ok(await evaluate(`window.__loadingFrames.length>0 && window.__loadingFrames.every(f=>f.width>100&&f.height>100&&f.placeholder)`),"loading preserves a visible reserved frame");
  const shot=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});
  await writeFile(join(tmpdir(),"ratioflow-polish-mobile.png"),Buffer.from(shot.data,"base64"));
  await clear();
  console.log("320px targets, rapid navigation, rail-only reduced-motion scrolling and native horizontal/vertical wheel behavior passed");

  const longName = "旅行🌴".repeat(70);
  await upload(`[new File([window.__files[0]], ${JSON.stringify(longName + "A.png")},{type:'image/png',lastModified:600}),new File([window.__files[1]],${JSON.stringify(longName + "B.png")},{type:'image/png',lastModified:601})]`,2);
  await targets(["1:1"]);await download("Download Batch");
  const unicodeZip = await zip(); const unicodePaths = Object.keys(unicodeZip.files).filter(p=>!unicodeZip.files[p].dir);
  assert.equal(unicodePaths.length,2);assert.equal(new Set(unicodePaths.map(p=>p.split('/')[0])).size,2);
  assert.ok(unicodePaths.every(p=>p.split('/').every(part=>Buffer.byteLength(part)<255) && p.startsWith('旅行🌴')));
  await clear();
  console.log("Long Unicode filenames preserve characters and produce safe, distinct ZIP folders");

  await send("Emulation.setDeviceMetricsOverride",{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`(async()=>{
    window.__large=[];
    for(const [i,[w,h]] of [[4032,3024],[6000,4000],[4000,6000]].entries()){
      const c=document.createElement('canvas');c.width=w;c.height=h;const ctx=c.getContext('2d');const g=ctx.createLinearGradient(0,0,w,h);g.addColorStop(0,'#cc5522');g.addColorStop(1,'#2255cc');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);for(let n=0;n<80;n++){ctx.fillStyle=n%2?'#669955':'#aa5577';ctx.fillRect(n*w/80,0,8,h);}
      const b=await new Promise(r=>c.toBlob(r,'image/jpeg',.9));c.width=c.height=0;window.__large.push(b);
    }
  })()`);
  const measures=[];
  for(const count of [5,15,25,10]){
    await evaluate(`(()=>{window.__frames=0;window.__maxFrameGap=0;window.__tracking=true;let last=performance.now();function tick(now){window.__frames++;window.__maxFrameGap=Math.max(window.__maxFrameGap,now-last);last=now;if(window.__tracking)requestAnimationFrame(tick);}requestAnimationFrame(tick);})()`);
    const importMs=await upload(`Array.from({length:${count}},(_,i)=>new File([window.__large[i%3]],'large-${count}-'+i+'.jpg',{type:'image/jpeg',lastModified:i+200}))`,count);
    const responsiveness=await evaluate(`window.__tracking=false;({frames:window.__frames,maxFrameGapMs:Math.round(window.__maxFrameGap)})`);
    assert.ok(responsiveness.frames>5,"metadata preparation yields animation frames");
    if(count===25){
      assert.equal(await evaluate(`document.body.textContent.includes('25 / 25 images · Batch full')`),true);
      await click("Options");await click("Select all");await click("Options");
      assert.equal(await evaluate(`document.body.textContent.includes('150 files may take longer')`),true);
      await select(24);await select(0);
      assert.equal(await evaluate(`document.body.textContent.includes('0 / 25 edited')`),true,"navigation never marks photos edited");
    }
    const ratioCount=count===25?6:1;
    await targets(count===25?["9:16","1:1","4:5","4:3","3:2","16:9"]:["1:1"], count===25?"1080":"Custom");
    await evaluate(`(()=>{window.__frames=0;window.__maxFrameGap=0;window.__tracking=true;let last=performance.now();function tick(now){window.__frames++;window.__maxFrameGap=Math.max(window.__maxFrameGap,now-last);last=now;if(window.__tracking)requestAnimationFrame(tick);}requestAnimationFrame(tick);})()`);
    const start=performance.now();await download("Download Batch");const exportMs=Math.round(performance.now()-start);
    const exportResponsiveness=await evaluate(`window.__tracking=false;({exportFrames:window.__frames,exportMaxFrameGapMs:Math.round(window.__maxFrameGap)})`);
    const zipBytes=await evaluate(`window.__downloads.at(-1).blob.size`);
    const result=await zip();assert.equal(Object.keys(result.files).filter(p=>!result.files[p].dir).length,count*ratioCount);
    assert.equal(await evaluate(`window.__bitmapMax`),1);await clear();
    await send("HeapProfiler.collectGarbage");
    const {metrics}=await send("Performance.getMetrics");
    const heap=metrics.find(m=>m.name==='JSHeapUsedSize').value;
    measures.push({count,outputCount:count*ratioCount,outputSize:count===25?1080:64,importMs,exportMs,...responsiveness,...exportResponsiveness,zipMB:Math.round(zipBytes/1048576*10)/10,afterClearHeapMB:Math.round(heap/1048576*10)/10});
    console.log(JSON.stringify(measures.at(-1)));
  }
  await upload('window.__files',25);
  assert.equal(await evaluate(`document.body.textContent.includes('40 files selected · 25 added · 15 over the image limit')`),true);
  assert.equal(await evaluate(`Array.from(${thumbs}).map(b=>b.getAttribute('aria-label')).join('|') === window.__files.slice(0,25).map(f=>'Edit '+f.name).join('|')`),true);
  await clear();
  assert.ok(requests.every(r=>!['POST','PUT','PATCH'].includes(r.method)),"no upload or remote mutation requests");
  const appOrigin = new URL(process.argv[2] ?? "http://localhost:3137").origin;
  assert.ok(requests.every(r=>r.url.startsWith('blob:')||r.url.startsWith('data:')||new URL(r.url).origin===appOrigin),"all requests stay local");
  assert.deepEqual(errors,[]);
  await writeFile(join(tmpdir(),"ratioflow-polish-measurements.json"),JSON.stringify(measures,null,2));
  console.log("40→25 import order, repeated large-image batch cleanup, sequential export, zero outstanding URLs/bitmaps and clean console/network passed");
} finally {close();}
