// node tests/batchMode.browser.mjs http://localhost:3137 http://127.0.0.1:9228
import assert from "node:assert/strict";
import JSZip from "jszip";
import { browserClient } from "./browserClient.mjs";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const appUrl = process.argv[2] ?? "http://localhost:3000";
const { send, evaluate, waitFor, errors, requests, close } = await browserClient(process.argv[3]);
const button = (label) => `Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === ${JSON.stringify(label)})`;
const thumbnails = `document.querySelectorAll('[aria-label="Batch images"] button[data-image-id]')`;
async function click(label) { await evaluate(`${button(label)}.click()`); }
async function selectImage(index) {
  await evaluate(`${thumbnails}[${index}].click()`);
  await waitFor(`${thumbnails}[${index}].getAttribute('aria-current') === 'true' && document.querySelector('.reactEasyCrop_Image')?.complete`);
  await new Promise((resolve) => setTimeout(resolve, 350));
}
async function setInput(selector, value) {
  await evaluate(`(() => {
    const input = document.querySelector(${JSON.stringify(selector)});
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))});
    input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
}
async function selectOption(id, label) {
  await evaluate(`document.querySelector('#${id}').click()`);
  await waitFor(`!!document.querySelector('#${id}-options [role=option]')`);
  await evaluate(`Array.from(document.querySelectorAll('#${id}-options [role=option]')).find(option => option.textContent.trim().startsWith(${JSON.stringify(label)})).click()`);
}
async function upload(selector, fileExpression) {
  await evaluate(`(() => {
    const transfer = new DataTransfer();
    for (const file of ${fileExpression}) transfer.items.add(file);
    const input = document.querySelector(${JSON.stringify(selector)}); input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await new Promise((resolve) => setTimeout(resolve, 80));
  await waitFor(`!document.body.textContent.match(/Preparing [0-9]+ of [0-9]+ images/)`);
}
async function drag(offset) {
  const point = await evaluate(`(() => {
    document.querySelector('.ratio-viewport').scrollIntoView({ block: 'center' });
    const rect = document.querySelector('.ratio-viewport').getBoundingClientRect();
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 });
  for (const fraction of [0.25, 0.5, 0.75, 1]) await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + offset * fraction, y: point.y, buttons: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + offset, y: point.y, button: "left", buttons: 0 });
  await new Promise((resolve) => setTimeout(resolve, 150));
}
async function framing() {
  return evaluate(`({ zoom: document.querySelector('[aria-label="Zoom image"]').value,
    transform: document.querySelector('.reactEasyCrop_Image').style.transform,
    fit: ${button("Fit")}.getAttribute('aria-pressed'),
    ratio: document.querySelector('#image-output-info').textContent })`);
}
function assertFraming(actual, expected) {
  const parse = (transform) => transform.match(/translate\(([-\d.]+)px, ([-\d.]+)px\)/)?.slice(1).map(Number);
  assert.deepEqual({ ...actual, transform: undefined }, { ...expected, transform: undefined });
  const current = parse(actual.transform); const previous = parse(expected.transform);
  assert.ok(current && previous && current.every((value, index) => Math.abs(value - previous[index]) < 1), `framing shifted: ${expected.transform} -> ${actual.transform}`);
}
async function download(label, expectZip = false) {
  const before = await evaluate(`window.__downloads.length`);
  await click(label);
  await waitFor(`window.__downloads.length > ${before}`, 500);
  await waitFor(`!${button("Download Image")}.disabled`);
  if (expectZip) {
    const result = await evaluate(`(async () => ({ name: window.__downloads.at(-1).name,
      bytes: await window.__base64(window.__downloads.at(-1).blob) }))()`);
    return { name: result.name, zip: await JSZip.loadAsync(Buffer.from(result.bytes, "base64")) };
  }
  return evaluate(`(async () => ({ name: window.__downloads.at(-1).name, bytes: await window.__base64(window.__downloads.at(-1).blob) }))()`);
}
async function checkWidths() {
  for (const width of [320, 375, 430, 768, 1024, 1440, 1920]) {
    await send("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
    await new Promise((resolve) => setTimeout(resolve, 160));
    assert.equal(await evaluate(`document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth`), true, `overflow at ${width}px`);
    assert.equal(await evaluate(`document.querySelectorAll('.ratio-viewport').length`), 1);
  }
}
async function checkZipRatios(zip, expectedRatio, maximum) {
  const files = Object.keys(zip.files).filter((name) => !zip.files[name].dir);
  for (const name of files) {
    const base64 = await zip.file(name).async("base64");
    const dimensions = await evaluate(`(async () => {
      const blob = await (await fetch('data:application/octet-stream;base64,' + ${JSON.stringify(base64)})).blob();
      const bitmap = await createImageBitmap(blob); const result = [bitmap.width, bitmap.height]; bitmap.close(); return result;
    })()`);
    assert.ok(Math.abs(dimensions[0] / dimensions[1] - expectedRatio) < 0.005, `${name}: ${dimensions}`);
    assert.ok(Math.max(...dimensions) <= maximum, `${name} exceeded output size`);
  }
}

try {
  await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
  await send("Page.setDownloadBehavior", { behavior: "deny" });
  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: appUrl });
  await waitFor(`document.querySelector('input[type=file]') && Object.keys(document.querySelector('input[type=file]')).some(key => key.startsWith('__reactProps'))`);
  await evaluate(`(async () => {
    window.__downloads = []; window.__urls = new Map(); window.__canvases = [];
    window.__batchStatuses = []; window.__sourceLocks = [];
    new MutationObserver(() => {
      const status = Array.from(document.querySelectorAll('p[role=status]')).find(element => /Exporting|Creating ZIP|Preparing batch/.test(element.textContent))?.textContent;
      if (status && window.__batchStatuses.at(-1) !== status) window.__batchStatuses.push(status);
      if (status) window.__sourceLocks.push(Array.from(document.querySelectorAll('[aria-label="Replace image"], button[aria-label$="from batch"], input[aria-label="Add image files"]')).every(element => element.disabled));
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    window.__bitmapLive = 0; window.__bitmapMax = 0;
    const bitmap = createImageBitmap;
    window.createImageBitmap = async (...args) => {
      const result = await bitmap(...args); window.__bitmapLive++;
      window.__bitmapMax = Math.max(window.__bitmapMax, window.__bitmapLive);
      const close = result.close.bind(result); let closed = false;
      result.close = () => { if (!closed) { closed = true; window.__bitmapLive--; } close(); }; return result;
    };
    const create = URL.createObjectURL.bind(URL); const revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => { const url = create(blob); window.__urls.set(url, blob); return url; };
    URL.revokeObjectURL = url => { window.__urls.delete(url); revoke(url); };
    const createElement = document.createElement.bind(document);
    document.createElement = (...args) => {
      const element = createElement(...args);
      if (args[0] === 'canvas') window.__canvases.push(element);
      return element;
    };
    const anchorClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) window.__downloads.push({ name: this.download, blob: window.__urls.get(this.href) });
      else anchorClick.call(this);
    };
    window.__base64 = async blob => {
      const bytes = new Uint8Array(await blob.arrayBuffer()); let binary = '';
      for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
      return btoa(binary);
    };
    const canvas = document.createElement('canvas'); canvas.width = 1600; canvas.height = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#dd2211'; context.fillRect(0, 0, 800, 1000);
    context.fillStyle = '#1122dd'; context.fillRect(800, 0, 800, 1000);
    const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const jpg = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
    const webp = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp'));
    canvas.width = canvas.height = 0;
    window.__sources = [new File([jpg], 'shoot.jpg', { type: 'image/jpeg', lastModified: 1 }),
      new File([png], 'shoot.png', { type: 'image/png', lastModified: 2 }),
      new File([webp], 'third.webp', { type: 'image/webp', lastModified: 3 }),
      new File([png], 'fourth.png', { type: 'image/png', lastModified: 4 }),
      new File([png], 'fifth.png', { type: 'image/png', lastModified: 5 })];
  })()`);

  await upload('input[type=file]', `window.__sources.concat([
    new File(['pdf'], 'bad.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(20 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' }),
    new File(['corrupt'], 'broken.png', { type: 'image/png' })])`);
  await waitFor(`${thumbnails}.length === 5`);
  assert.equal(await evaluate(`document.body.textContent.includes("5 images added. 3 files couldn't be added.")`), true);
  assert.equal(await evaluate(`${thumbnails}[0].getAttribute('aria-current')`), "true");
  assert.equal(await evaluate(`Array.from(${thumbnails}).map(button => button.getAttribute('aria-label')).join(',')`), "Edit shoot.jpg,Edit shoot.png,Edit third.webp,Edit fourth.png,Edit fifth.png");
  console.log("Mixed multi-upload: JPEG/PNG/WebP accepted, PDF/oversize/corrupt skipped, first photo active");

  await click("Options"); await waitFor(`!!document.querySelector('#export-options')`);
  await click("Clear");
  for (const ratio of ["1:1", "4:5", "9:16"]) await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.trim() === '${ratio}').querySelector('input').click()`);
  await selectOption("export-size", "Custom"); await setInput('#export-options input[inputmode=numeric]', 400);
  await click("Options");
  await evaluate(`document.querySelector('[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await setInput('[aria-label="Zoom image"]', 1.5); await drag(160);
  const a = await framing();
  const aDownload = await download("Download Image");
  await selectImage(1);
  await evaluate(`document.querySelector('[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 350));
  await setInput('[aria-label="Zoom image"]', 2); await drag(-170);
  const b = await framing();
  const bDownload = await download("Download Image");
  assert.notEqual(a.transform, b.transform);
  await selectImage(2); await click("Fit");
  const c = await framing();
  await selectImage(3); await click("Presets"); await waitFor(`!!document.querySelector('#platform-presets')`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.includes('Story / Reel')).click()`);
  await click("Safe zone");
  await selectImage(4);
  await evaluate(`document.querySelector('button[aria-label^="Set custom aspect ratio"]').click()`);
  await waitFor(`!!document.querySelector('form')`);
  await setInput('form input', 2); await setInput('form input:nth-of-type(1)', 2);
  await evaluate(`(() => { const input = document.querySelectorAll('form input')[1]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '1'); input.dispatchEvent(new Event('input', { bubbles: true })); })()`);
  await evaluate(`document.querySelector('form').requestSubmit()`);
  await waitFor(`document.body.textContent.includes('2:1 frame')`);
  for (let pass = 0; pass < 2; pass++) {
    await selectImage(0); assertFraming(await framing(), a);
    await selectImage(1); assertFraming(await framing(), b);
    await selectImage(2); assertFraming(await framing(), c);
    await selectImage(3); assert.equal(await evaluate(`document.querySelector('[aria-label="Show platform safe-zone guide"]').getAttribute('aria-pressed')`), "true");
    await selectImage(4); assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('form input')).map(input => input.value)`), ["2", "1"]);
  }
  console.log("Repeated thumbnail switching restores independent crop/zoom/Fit, custom values, preset and safe-zone state");

  const batch = await download("Download Batch", true);
  assert.equal(batch.name, "ratioflow-batch-export.zip");
  const paths = Object.keys(batch.zip.files).filter((name) => !batch.zip.files[name].dir);
  assert.equal(paths.length, 15);
  assert.equal(new Set(paths.map((name) => name.split('/')[0])).size, 5);
  assert.ok(paths.includes("shoot/shoot-1x1.png")); assert.ok(paths.includes("shoot-2/shoot-1x1.png"));
  assert.equal((await batch.zip.file("shoot/shoot-1x1.png").async("base64")), aDownload.bytes);
  assert.equal((await batch.zip.file("shoot-2/shoot-1x1.png").async("base64")), bDownload.bytes);
  assert.equal(await evaluate(`window.__batchStatuses.filter(status => status.includes('of 15')).length > 2 && window.__batchStatuses.includes('Creating ZIP...')`), true);
  assert.equal(await evaluate(`window.__sourceLocks.length > 0 && window.__sourceLocks.every(Boolean)`), true);
  const pixels = await evaluate(`(async () => {
    const results = [];
    for (const base64 of ${JSON.stringify([aDownload.bytes, bDownload.bytes])}) {
      const blob = await (await fetch('data:image/png;base64,' + base64)).blob();
      const image = await createImageBitmap(blob); const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d'); context.drawImage(image, image.width / 2, image.height / 2, 1, 1, 0, 0, 1, 1);
      results.push(Array.from(context.getImageData(0, 0, 1, 1).data)); image.close(); canvas.width = canvas.height = 0;
    }
    return results;
  })()`);
  assert.ok(pixels[0][0] > 180 && pixels[0][2] < 80); assert.ok(pixels[1][2] > 180 && pixels[1][0] < 80);
  console.log("5 × 3 ZIP: 15 outputs, unique folders, each photo's framing matches its direct PNG export and focal pixels");

  await selectImage(0); await click("Options");
  const selected = await download("Download Selected", true); assert.equal(Object.keys(selected.zip.files).length, 3);
  const all = await download("Download All", true); assert.equal(Object.keys(all.zip.files).length, 6);
  const current = await download("Download Current"); assert.equal(current.name, "shoot-1x1.png");
  await click("Options");
  console.log("Current, Selected and All continue exporting only the active photo");

  await selectImage(4); await click("Options"); await click("Clear");
  await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.includes('Custom · 2:1')).querySelector('input').click()`);
  await click("Options");
  const customBatch = await download("Download Batch", true);
  await checkZipRatios(customBatch.zip, 2, 400);
  await click("Options"); await click("Clear");
  for (const ratio of ["1:1", "4:5", "9:16"]) await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.trim() === '${ratio}').querySelector('input').click()`);
  await click("Options"); await selectImage(0);
  console.log("Shared custom 2:1 batch target: every source exported at the expected dimensions");

  await upload('input[aria-label="Add image files"]', '[...window.__sources, new File([window.__sources[1]], "sixth.png", { type: "image/png", lastModified: 6 })]');
  assert.equal(await evaluate(`${thumbnails}.length`), 6);
  assertFraming(await framing(), a);
  await selectImage(5); assert.equal((await framing()).zoom, "1");
  await selectImage(3); await click("Apply ratio to all");
  await selectImage(0); assert.equal((await framing()).zoom, a.zoom);
  await selectImage(1); assert.equal((await framing()).zoom, b.zoom);
  for (let index = 0; index < 6; index++) { await selectImage(index); assert.equal(await evaluate(`document.body.textContent.includes('Story / Reel')`), true); }
  console.log("Append skips duplicates and resets new spatial edits; Apply ratio to all preserves each photo's zoom");

  await checkWidths();
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 1000, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true });
  await evaluate(`document.querySelector('[aria-label="Batch images"]').scrollIntoView({ block: 'center' }); ${thumbnails}[0].click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  const touchPoint = await evaluate(`(() => { const rect = ${thumbnails}[1].getBoundingClientRect(); return { x: rect.left + 35, y: rect.top + 30 }; })()`);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...touchPoint, id: 1 }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitFor(`${thumbnails}[1].getAttribute('aria-current') === 'true'`);
  await evaluate(`${thumbnails}[1].focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
  await waitFor(`${thumbnails}[2].getAttribute('aria-current') === 'true'`);
  await evaluate(`document.querySelector('[aria-label="Zoom image"]').focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowLeft", code: "ArrowLeft", windowsVirtualKeyCode: 37 });
  assert.equal(await evaluate(`${thumbnails}[2].getAttribute('aria-current')`), "true");
  const railBox = await evaluate(`(() => { const rail = document.querySelector('[aria-label="Batch images"] ul'); const rect = rail.getBoundingClientRect(); return { x: rect.left + rect.width - 30, y: rect.top + 30 }; })()`);
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...railBox, id: 1 }] });
  for (const offset of [30, 60, 90, 120]) await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: railBox.x - offset, y: railBox.y, id: 1 }] });
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await click("→"); await click("→"); await click("→");
  await new Promise((resolve) => setTimeout(resolve, 550));
  assert.equal(await evaluate(`(() => { const active = document.querySelector('[data-image-id][aria-current=true]').getBoundingClientRect(); const rail = document.querySelector('[aria-label="Batch images"] ul').getBoundingClientRect(); return active.left >= rail.left - 2 && active.right <= rail.right + 2; })()`), true);
  const screenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(join(tmpdir(), "ratioflow-batch-mobile.png"), Buffer.from(screenshot.data, "base64"));
  await send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-motion", value: "reduce" }] });
  await selectImage(0); await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(await evaluate(`document.querySelector('[aria-label="Batch images"] ul').scrollLeft < 5`), true);
  console.log("320–1920px: one viewport, no page overflow; mobile tap/swipe, scoped keyboard, active visibility and reduced motion passed");

  await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  await click("Options"); await click("Clear");
  await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.includes('Story / Reel')).querySelector('input').click()`);
  await selectOption("export-size", "1080"); await selectOption("export-format", "WebP");
  await click("Options");
  const story = await download("Download Batch", true);
  assert.equal(Object.keys(story.zip.files).filter((name) => !story.zip.files[name].dir).length, 6);
  assert.ok(Object.keys(story.zip.files).filter((name) => !story.zip.files[name].dir).every((name) => name.endsWith('-instagram-story.webp')));
  await checkZipRatios(story.zip, 9 / 16, 1080);
  await click("Options"); await selectOption("export-format", "JPEG"); await click("Options");
  const jpeg = await download("Download Batch", true);
  assert.ok(Object.keys(jpeg.zip.files).filter((name) => !jpeg.zip.files[name].dir).every((name) => name.endsWith('.jpg')));
  await checkZipRatios(jpeg.zip, 9 / 16, 1080);
  console.log("Shared Instagram Story target and PNG/JPEG/WebP batch ZIP encoding passed");

  await evaluate(`(() => { window.__failEncode = HTMLCanvasElement.prototype.toBlob; HTMLCanvasElement.prototype.toBlob = callback => setTimeout(() => callback(null), 0); })()`);
  await click("Download Batch");
  await waitFor(`document.body.textContent.includes('Batch export stopped')`);
  assert.equal(await evaluate(`${thumbnails}.length`), 6);
  assert.equal(await evaluate(`${button("Download Batch")}.disabled`), false);
  await evaluate(`HTMLCanvasElement.prototype.toBlob = window.__failEncode`);
  await download("Download Batch", true);
  console.log("Simulated encoding failure names the photo, keeps the batch, unlocks controls and retries successfully");

  await selectImage(2);
  await evaluate(`document.querySelector('button[aria-label="Remove shoot.jpg from batch"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-image-id][aria-current=true]').getAttribute('aria-label')`), "Edit third.webp");
  await evaluate(`document.querySelector('button[aria-label="Remove third.webp from batch"]').click()`);
  assert.equal(await evaluate(`document.querySelector('[data-image-id][aria-current=true]').getAttribute('aria-label')`), "Edit fourth.png");
  await click("Clear batch"); await waitFor(`!!document.querySelector('[role=alertdialog]')`);
  await click("Keep images"); assert.equal(await evaluate(`${thumbnails}.length`), 4);
  await click("Clear batch"); await click("Clear all images");
  await waitFor(`!!document.querySelector('input[type=file]') && !document.querySelector('.ratio-viewport')`);
  assert.equal(await evaluate(`Array.from(window.__urls.values()).filter(value => value instanceof File).length`), 0);
  console.log("Remove keeps/advances the active photo; confirmed Clear returns to UploadArea and revokes all source URLs");

  await upload('input[type=file]', '[window.__sources[0]]');
  await waitFor(`!!document.querySelector('.ratio-viewport')`);
  assert.equal(await evaluate(`!!document.querySelector('[aria-label="Batch images"]')`), false);
  assert.equal(await evaluate(`!!${button("Download Batch")}`), false);
  await upload('input[aria-label="Add image files"]', `Array.from({ length: 29 }, (_, index) => new File([window.__sources[1]], 'limit-' + index + '.png', { type: 'image/png', lastModified: index + 30 }))`);
  assert.equal(await evaluate(`${thumbnails}.length`), 25);
  assert.equal(await evaluate(`document.body.textContent.includes('up to 25 images per batch')`), true);
  await click("Options"); await click("Clear");
  await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.trim() === '1:1').querySelector('input').click()`);
  await selectOption("export-size", "Custom"); await setInput('#export-options input[inputmode=numeric]', 64);
  await click("Options");
  const maxBatch = await download("Download Batch", true);
  assert.equal(Object.keys(maxBatch.zip.files).filter((name) => !maxBatch.zip.files[name].dir).length, 25);
  assert.equal(await evaluate(`window.__bitmapMax`), 1);
  assert.equal(await evaluate(`window.__bitmapLive`), 0);
  assert.equal(await evaluate(`window.__canvases.every(canvas => canvas.width === 0 && canvas.height === 0)`), true);
  assert.ok(requests.every((request) => !["POST", "PUT", "PATCH"].includes(request.method)));
  assert.equal(errors.length, 0, errors.join("\n"));
  console.log("25-photo maximum: responsive navigator and complete ZIP; one live bitmap at a time, all Canvas objects reset, no upload requests or browser errors");
  await click("Clear batch"); await click("Clear all images");
  await evaluate(`(async () => {
    window.__phoneFiles = [];
    for (const [index, [width, height]] of [[6000, 4000], [4000, 6000], [4032, 3024]].entries()) {
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      const context = canvas.getContext('2d'); context.fillStyle = ['#aa2211', '#11aa22', '#2211aa'][index]; context.fillRect(0, 0, width, height);
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9)); canvas.width = canvas.height = 0;
      window.__phoneFiles.push(new File([blob], 'phone-' + index + '.jpg', { type: 'image/jpeg', lastModified: index + 80 }));
    }
  })()`);
  await upload('input[type=file]', 'window.__phoneFiles');
  await waitFor(`${thumbnails}.length === 3`);
  await selectImage(0); await setInput('[aria-label="Zoom image"]', 1.4);
  const phoneFraming = await framing();
  await selectImage(1); await selectImage(2); await selectImage(0); assertFraming(await framing(), phoneFraming);
  await click("Options"); await click("Clear");
  for (const ratio of ['1:1', '9:16']) await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.trim() === '${ratio}').querySelector('input').click()`);
  await selectOption("export-size", "1080"); await click("Options");
  const phones = await download("Download Batch", true);
  assert.equal(Object.keys(phones.zip.files).filter((name) => !phones.zip.files[name].dir).length, 6);
  assert.equal(await evaluate(`window.__bitmapMax === 1 && window.__bitmapLive === 0 && window.__canvases.every(canvas => canvas.width === 0 && canvas.height === 0)`), true);
  const desktopScreenshot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
  await writeFile(join(tmpdir(), "ratioflow-batch-desktop.png"), Buffer.from(desktopScreenshot.data, "base64"));
  console.log("Three 12–24 megapixel phone images: preparation, switching, six-output batch ZIP and resource cleanup passed");
  await click("Clear batch"); await click("Clear all images");
  console.log("Batch browser suite passed");
} finally { close(); }
