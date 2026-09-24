// Run against a local production server and an Edge/Chrome CDP port.
// Example: node tests/exportRatioSync.browser.mjs http://localhost:3137 http://127.0.0.1:9228
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
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
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
async function waitFor(expression, attempts = 80) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}
async function checkedRatios() {
  return evaluate(`Array.from(document.querySelectorAll('#export-options label')).filter(label => label.querySelector('input[type=checkbox]:checked')).map(label => label.textContent.trim())`);
}
function assertSelected(actual, expected) {
  if (actual.join(",") !== expected.join(",")) throw new Error(`Expected ${expected}, got ${actual}`);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Page.setDownloadBehavior", { behavior: "deny" });
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: appUrl });
  await waitFor(`document.body?.textContent.includes('Choose Image')`);
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 1200;
    canvas.getContext('2d').fillRect(0, 0, 1600, 1200);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'ratio-test.png', { type: 'image/png' }));
    const input = document.querySelector('input[type=file]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`document.body.textContent.includes('ratio-test.png') && !!document.querySelector('.ratio-viewport')`);

  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await waitFor(`!!document.querySelector('#export-options')`);
  assertSelected(await checkedRatios(), ["16:9"]);
  if (!await evaluate(`document.querySelector('#export-format').textContent.includes('PNG')`)) throw new Error("PNG is not the default format");

  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 4 by 5"]').click()`);
  assertSelected(await checkedRatios(), ["4:5"]);
  await evaluate(`Array.from(document.querySelectorAll('#export-options label')).find(label => label.textContent.trim() === '1:1').querySelector('input').click()`);
  assertSelected(await checkedRatios(), ["1:1", "4:5"]);
  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 3 by 2"]').click()`);
  assertSelected(await checkedRatios(), ["3:2"]);
  await waitFor(`Math.abs(document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height - 1.5) < 0.005`);

  const drag = await evaluate(`(() => {
    const viewport = document.querySelector('.ratio-viewport');
    viewport.scrollIntoView({ block: 'center' });
    const frame = viewport.getBoundingClientRect();
    const handle = document.querySelector('.ratio-resize-handle--right').getBoundingClientRect();
    return { x: Math.round(handle.left + handle.width / 2), y: Math.round(handle.top + handle.height / 2),
      delta: Math.round((frame.height - frame.width) / 2) };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: drag.x, y: drag.y, button: "none", buttons: 0 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: drag.x, y: drag.y, button: "left", buttons: 1, clickCount: 1 });
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: drag.x + drag.delta * fraction, y: drag.y, button: "left", buttons: 1 });
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: drag.x + drag.delta, y: drag.y, button: "left", buttons: 0, clickCount: 1 });
  await waitFor(`!document.querySelector('#export-options')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await waitFor(`!!document.querySelector('#export-options')`);
  await waitFor(`Array.from(document.querySelectorAll('#export-options label')).some(label => label.textContent.trim() === '1:1' && label.querySelector('input:checked'))`);
  assertSelected(await checkedRatios(), ["1:1"]);
  if (await evaluate(`Array.from(document.querySelectorAll('#export-options label')).some(label => label.textContent.trim().startsWith('Custom'))`)) {
    throw new Error("A matched drag still shows a custom export ratio");
  }
  await evaluate(`(() => {
    window.__ratioExports = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.__ratioExports.push(blob); return create(blob); };
    Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Selected')).click();
  })()`);
  await waitFor(`window.__ratioExports.length === 1`);
  await waitFor(`!Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Current')).disabled`);
  await evaluate(`Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Current')).click()`);
  await waitFor(`window.__ratioExports.length === 2`);
  const squareSizes = await evaluate(`(async () => Promise.all(window.__ratioExports.slice(0, 2).map(async blob => {
    const image = await createImageBitmap(blob); const size = [image.width, image.height]; image.close(); return size;
  })))()`);
  if (squareSizes.some(([width, height]) => width !== height)) throw new Error(`Matched drag exported nonsquare images: ${JSON.stringify(squareSizes)}`);

  const customHandle = await evaluate(`(() => {
    const viewport = document.querySelector('.ratio-viewport');
    viewport.scrollIntoView({ block: 'center' });
    const rect = document.querySelector('.ratio-resize-handle--right').getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: customHandle.x, y: customHandle.y, button: "none", buttons: 0 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: customHandle.x, y: customHandle.y, button: "left", buttons: 1, clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: customHandle.x + 55, y: customHandle.y, button: "left", buttons: 1 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: customHandle.x + 55, y: customHandle.y, button: "left", buttons: 0, clickCount: 1 });
  await waitFor(`!document.querySelector('#export-options')`);
  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.trim() === 'Export').click()`);
  await waitFor(`!!document.querySelector('#export-options')`);
  const customSelection = await checkedRatios();
  if (customSelection.length !== 1 || !customSelection[0].startsWith("Custom · ")) throw new Error(`Unexpected custom selection: ${customSelection}`);
  const customFrameRatio = await evaluate(`(() => { const rect = document.querySelector('.ratio-viewport').getBoundingClientRect(); return rect.width / rect.height; })()`);
  await evaluate(`Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Selected')).click()`);
  await waitFor(`window.__ratioExports.length === 3`);
  const customRatio = await evaluate(`(async () => { const image = await createImageBitmap(window.__ratioExports[2]); const value = image.width / image.height; image.close(); return value; })()`);
  if (Math.abs(customRatio - customFrameRatio) > 0.01) throw new Error(`Custom export ratio ${customRatio} differed from frame ${customFrameRatio}`);

  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Presets')).click()`);
  await waitFor(`!!document.querySelector('#platform-presets')`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.trim() === 'YouTube').click()`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.includes('Thumbnail')).click()`);
  assertSelected(await checkedRatios(), ["YouTube · Thumbnail (16:9)"]);
  await evaluate(`Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Selected')).click()`);
  await waitFor(`window.__ratioExports.length === 4`);
  const platformSize = await evaluate(`(async () => { const image = await createImageBitmap(window.__ratioExports[3]); const size = [image.width, image.height]; image.close(); return size; })()`);
  if (Math.abs(platformSize[0] / platformSize[1] - 16 / 9) > 0.01) throw new Error(`Platform export dimensions were ${platformSize}`);
  console.log("Preset, dragged, custom, and platform ratios stay in sync with export selection and downloaded images.");
} finally {
  socket.close();
}
