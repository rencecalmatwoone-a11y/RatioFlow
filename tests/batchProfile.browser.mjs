// Production React commit profiling; run before and after a build with the same fixtures.
import assert from "node:assert/strict";
import { browserClient } from "./browserClient.mjs";
const { send, evaluate, waitFor, errors, close } = await browserClient(process.argv[3]);
try {
  await send("Page.enable"); await send("Runtime.enable");
  const { identifier } = await send("Page.addScriptToEvaluateOnNewDocument", { source: `
    window.__thumbnailRenders = [];
    const previous = new Map();
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = { supportsFiber: true, inject: () => 1,
      onCommitFiberUnmount() {}, onCommitFiberRoot(_, root) {
        function visit(fiber) {
          if (!fiber) return;
          const props = fiber.memoizedProps;
          if (props?.id && typeof props.active === 'boolean' && (fiber.tag === 0 || fiber.tag === 15)) {
            // Reused memo subtrees retain old flags. Count only newly committed fiber work.
            if ((fiber.flags & 1) && previous.get(props.id) !== fiber)
              window.__thumbnailRenders.push({ id: props.id, active: props.active });
            previous.set(props.id, fiber);
          }
          visit(fiber.child); visit(fiber.sibling);
        }
        visit(root.current);
      } };
  ` });
  await send("Page.navigate", { url: process.argv[2] ?? "http://localhost:3137" });
  await waitFor(`document.querySelector('input[type=file]') && Object.keys(document.querySelector('input[type=file]')).some(k => k.startsWith('__reactProps'))`);
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
    canvas.getContext('2d').fillRect(0,0,1600,1000);
    const blob = await new Promise(r => canvas.toBlob(r)); canvas.width = canvas.height = 0;
    const transfer = new DataTransfer();
    for (let i=0;i<25;i++) transfer.items.add(new File([blob], 'profile-'+i+'.png', {type:'image/png',lastModified:i+1}));
    const input = document.querySelector('input[type=file]'); input.files = transfer.files;
    input.dispatchEvent(new Event('change', {bubbles:true}));
  })()`);
  await waitFor(`document.querySelectorAll('[data-image-id]').length === 25 && document.querySelector('.reactEasyCrop_Image')?.complete`);
  await new Promise(r => setTimeout(r, 400));
  assert.ok(await evaluate(`window.__thumbnailRenders.length >= 25`), "React profiler observed thumbnail mounts");
  await evaluate(`window.__thumbnailRenders = []`);
  const point = await evaluate(`(() => { document.querySelector('.ratio-viewport').scrollIntoView({block:'center'}); const r=document.querySelector('.ratio-viewport').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 });
  const started = performance.now();
  for (let i=1;i<=30;i++) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + i*2, y: point.y, buttons: 1 });
    await new Promise(r => setTimeout(r, 17));
  }
  await send("Input.dispatchMouseEvent", {type:"mouseReleased",x:point.x+60,y:point.y,button:"left",buttons:0});
  await new Promise(r => setTimeout(r, 150));
  const result = await evaluate(`({thumbnailRenders:window.__thumbnailRenders.length,inactiveThumbnailRenders:window.__thumbnailRenders.filter(x=>!x.active).length})`);
  result.dragSampleMs = Math.round(performance.now()-started);
  console.log(JSON.stringify(result));
  assert.equal(result.inactiveThumbnailRenders, 0, "crop drag does not render inactive thumbnails");
  assert.deepEqual(errors, []);
  await send("Page.removeScriptToEvaluateOnNewDocument", { identifier });
} finally { close(); }
