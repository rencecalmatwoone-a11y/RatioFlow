// Run against a local production server and a Chrome/Edge CDP port.
// Example: node tests/browserSmoke.mjs http://localhost:3137 http://127.0.0.1:9228
import JSZip from "jszip";

const appUrl = process.argv[2] ?? "http://localhost:3000";
const debuggerUrl = process.argv[3] ?? "http://127.0.0.1:9222";
const targets = await (await fetch(`${debuggerUrl}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url === "about:blank")
  ?? targets.find((item) => item.type === "page");
if (!target) throw new Error("No browser page is available");

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Runtime.consoleAPICalled" && ["error", "warning"].includes(message.params.type)) {
    errors.push(message.params.args.map((arg) => arg.value ?? arg.description).join(" "));
  }
  if (!message.id) return;
  const task = pending.get(message.id);
  if (!task) return;
  pending.delete(message.id);
  message.error ? task.reject(new Error(message.error.message)) : task.resolve(message.result);
});
function send(method, params = {}) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}
async function waitFor(expression, attempts = 50) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
async function widthCheck(width, label) {
  await send("Emulation.setDeviceMetricsOverride", { width, height: 900, deviceScaleFactor: 1, mobile: width < 768 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const result = await evaluate(`({ width: innerWidth, document: document.documentElement.scrollWidth, body: document.body.scrollWidth })`);
  if (result.document > result.width || result.body > result.width) {
    throw new Error(`${label} overflows at ${width}px: ${JSON.stringify(result)}`);
  }
  console.log(`${label} ${width}px: no page overflow`);
}
try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.setDownloadBehavior", { behavior: "deny" });
  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await send("Page.navigate", { url: appUrl });
  await waitFor(`!!document.querySelector('button') && document.body.textContent.includes('Choose Image')`);
  for (const width of [320, 375, 768, 1024, 1280, 1440, 1920]) await widthCheck(width, "Upload");

  await evaluate(`(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 1200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#225588'; context.fillRect(0, 0, 1600, 1200);
    context.fillStyle = '#ffeeaa'; context.fillRect(400, 250, 500, 600);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'smoke.png', { type: 'image/png' }));
    const input = document.querySelector('input[type=file]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.body.textContent.includes('smoke.png') && !!document.querySelector('.ratio-viewport')`);
  for (const width of [320, 375, 768, 1024, 1280, 1440, 1920]) await widthCheck(width, "Editor");
  await send("Emulation.setDeviceMetricsOverride", { width: 1024, height: 900, deviceScaleFactor: 1, mobile: false });
  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await new Promise((resolve) => setTimeout(resolve, 450));
  const beforeDrag = await evaluate(`document.querySelector('.reactEasyCrop_Image').style.transform`);
  const dragPoint = await evaluate(`(() => {
    const rect = document.querySelector('.ratio-viewport').getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: dragPoint.x, y: dragPoint.y, button: "left", buttons: 1, clickCount: 1 });
  for (const offset of [25, 50, 75]) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: dragPoint.x + offset, y: dragPoint.y, button: "left", buttons: 1 });
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: dragPoint.x + 75, y: dragPoint.y, button: "left", buttons: 0, clickCount: 1 });
  const afterDrag = await evaluate(`document.querySelector('.reactEasyCrop_Image').style.transform`);
  if (!afterDrag || afterDrag === beforeDrag || afterDrag.includes('NaN')) {
    throw new Error(`Image drag did not update crop: ${beforeDrag} -> ${afterDrag}`);
  }
  console.log("Mouse drag: crop updated");

  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await waitFor(`!!document.querySelector('#export-options')`);
  await widthCheck(320, "Export menu");
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(`!document.querySelector('#export-options')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await waitFor(`!!document.querySelector('#export-options')`);
  await evaluate(`document.querySelector('#export-size').value = 'custom'; document.querySelector('#export-size').dispatchEvent(new Event('change', { bubbles: true }))`);
  await widthCheck(320, "Custom output size");
  if (!await evaluate(`!!document.querySelector('#export-options input[inputmode=numeric]')`)) {
    throw new Error("Custom output controls did not open");
  }
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Presets')).click()`);
  await waitFor(`!!document.querySelector('#platform-presets')`);
  await widthCheck(320, "Platform presets");
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Presets')).focus()`);
  await send("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await send("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await waitFor(`!document.querySelector('#platform-presets')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Presets')).click()`);
  await waitFor(`!!document.querySelector('#platform-presets')`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.trim() === 'YouTube').click()`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.includes('Thumbnail')).click()`);
  await waitFor(`document.body.textContent.includes('YouTube') && !document.querySelector('#platform-presets')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Safe zone')).click()`);
  for (const label of ['9 by 16', '1 by 1', '4 by 5', '3 by 2', '16 by 9']) {
    await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to ${label}"]').click()`);
  }
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Fit').click()`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Fill').click()`);
  await evaluate(`(() => {
    const slider = document.querySelector('input[aria-label="Zoom image"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, '1.5');
    slider.dispatchEvent(new Event('input', { bubbles: true }));
    slider.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.querySelector('input[aria-label="Zoom image"]').getAttribute('aria-valuetext') === '150 percent'`);
  await widthCheck(320, "After editor interactions");

  await evaluate(`(() => {
    window.__smokeBlobs = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.__smokeBlobs.push(blob); return create(blob); };
    Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click();
  })()`);
  await waitFor(`!!document.querySelector('#export-options')`);
  await evaluate(`(() => {
    const select = document.querySelector('#export-size');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'original');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  for (const [format, mime] of [['png', 'image/png'], ['jpeg', 'image/jpeg'], ['webp', 'image/webp']]) {
    await evaluate(`(() => {
      const select = document.querySelector('#export-format');
      Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, '${format}');
      select.dispatchEvent(new Event('change', { bubbles: true }));
      Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Current')).click();
    })()`);
    await waitFor(`window.__smokeBlobs.length >= ${format === 'png' ? 1 : format === 'jpeg' ? 2 : 3}`);
    const result = await evaluate(`({ type: window.__smokeBlobs.at(-1).type, size: window.__smokeBlobs.at(-1).size })`);
    if (result.type !== mime || result.size === 0) throw new Error(`${format} export failed: ${JSON.stringify(result)}`);
    console.log(`${format.toUpperCase()} export: ${result.size} bytes`);
  }
  await evaluate(`Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download All')).click()`);
  await waitFor(`window.__smokeBlobs.length >= 4`);
  const zip = await evaluate(`({ type: window.__smokeBlobs.at(-1).type, size: window.__smokeBlobs.at(-1).size })`);
  if (zip.type !== 'application/zip' || zip.size === 0) throw new Error(`ZIP export failed: ${JSON.stringify(zip)}`);
  console.log(`ZIP export: ${zip.size} bytes`);

  await evaluate(`(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 6000; canvas.height = 4000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#cc3311'; context.fillRect(0, 0, 6000, 4000);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'large.png', { type: 'image/png' }));
    const input = document.querySelector('input[aria-label="Replace image file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.body.textContent.includes('large.png') && !!document.querySelector('.ratio-viewport')`, 150);
  await evaluate(`window.__smokeBlobs = []; Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await evaluate(`Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download All')).click()`);
  await waitFor(`window.__smokeBlobs.some(blob => blob.type === 'application/zip')`, 300);
  console.log("6000 x 4000 Download All: completed");

  await evaluate(`(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000; canvas.height = 1000;
    const context = canvas.getContext('2d');
    context.fillStyle = '#22bb44'; context.fillRect(0, 0, 1000, 1000);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'replacement.png', { type: 'image/png' }));
    const input = document.querySelector('input[aria-label="Replace image file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.body.textContent.includes('replacement.png') && !!document.querySelector('.ratio-viewport')`, 150);
  await evaluate(`window.__smokeBlobs = []; Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await evaluate(`(() => {
    const select = document.querySelector('#export-format');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'png');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Current')).click();
  })()`);
  await waitFor(`window.__smokeBlobs.some(blob => blob.type === 'image/png')`, 150);
  const pixel = await evaluate(`(async () => {
    const image = await createImageBitmap(window.__smokeBlobs.find(blob => blob.type === 'image/png'));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 1;
    const context = canvas.getContext('2d');
    context.drawImage(image, image.width / 2, image.height / 2, 1, 1, 0, 0, 1, 1);
    image.close();
    return Array.from(context.getImageData(0, 0, 1, 1).data);
  })()`);
  if (pixel[1] < 150 || pixel[0] > 100) throw new Error(`Replacement export used stale image: ${pixel}`);
  console.log("Export after replacement: correct source image");

  await evaluate(`document.querySelector('button[aria-label^="Set custom aspect ratio"]').click()`);
  await waitFor(`!!document.querySelector('form')`);
  await evaluate(`(() => {
    const inputs = document.querySelectorAll('form input');
    for (const [input, value] of [[inputs[0], '2'], [inputs[1], '1']]) {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    document.querySelector('form').requestSubmit();
  })()`);
  await waitFor(`document.body.textContent.includes('2:1 frame')`);
  await evaluate(`(() => {
    const select = document.querySelector('#export-size');
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(select, 'custom');
    select.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`!!document.querySelector('#export-options input[inputmode=numeric]')`);
  await evaluate(`(() => {
    const input = document.querySelector('#export-options input[inputmode=numeric]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, '800');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    window.__smokeBlobs = [];
    Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Current')).click();
  })()`);
  await waitFor(`window.__smokeBlobs.some(blob => blob.type === 'image/png')`, 150);
  const customDimensions = await evaluate(`(async () => {
    const image = await createImageBitmap(window.__smokeBlobs.find(blob => blob.type === 'image/png'));
    const result = [image.width, image.height];
    image.close();
    return result;
  })()`);
  if (customDimensions[0] !== 800 || customDimensions[1] !== 400) {
    throw new Error(`Custom ratio/size export failed: ${customDimensions}`);
  }
  console.log("Custom 2:1 ratio at 800 x 400: completed");
  await evaluate(`(() => {
    Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.trim() === '1:1').click();
    window.__smokeBlobs = [];
    Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Selected')).click();
  })()`);
  await waitFor(`window.__smokeBlobs.some(blob => blob.type === 'application/zip')`, 150);
  const zipBytes = await evaluate(`(async () => {
    const bytes = new Uint8Array(await window.__smokeBlobs.find(blob => blob.type === 'application/zip').arrayBuffer());
    let binary = '';
    for (let index = 0; index < bytes.length; index += 8192) {
      binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
    }
    return btoa(binary);
  })()`);
  const selectedZip = await JSZip.loadAsync(Buffer.from(zipBytes, 'base64'));
  const selectedNames = Object.keys(selectedZip.files).sort();
  if (selectedNames.join(',') !== 'replacement-16x9.png,replacement-1x1.png') {
    throw new Error(`Download Selected contained unexpected files: ${selectedNames}`);
  }
  console.log("Download Selected: exact ratio set in ZIP");
  const outsideDropBlocked = await evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File(['x'], 'outside.png', { type: 'image/png' }));
    const event = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer });
    document.body.dispatchEvent(event);
    return event.defaultPrevented;
  })()`);
  if (!outsideDropBlocked) throw new Error("Dropping a file outside the upload area may navigate away");
  await evaluate(`(() => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([], 'empty.png', { type: 'image/png' }));
    const input = document.querySelector('input[aria-label="Replace image file"]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.body.textContent.includes('This image file is empty')`);
  if (!await evaluate(`document.body.textContent.includes('replacement.png')`)) {
    throw new Error("A rejected replacement removed the active image");
  }
  console.log("Empty replacement: recoverable; outside drop blocked");
  if (errors.length) throw new Error(`Browser exceptions: ${errors.join('; ')}`);
  console.log("Browser smoke passed");
} finally {
  socket.close();
}
