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
  await send("Page.navigate", { url: appUrl });
  await waitFor(`document.body.textContent.includes('Choose Image')`);
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

  await evaluate(`document.querySelector('button[aria-label^="Set custom aspect ratio"]').click()`);
  assertSelected(await checkedRatios(), ["Custom · 21:9"]);
  await evaluate(`(() => {
    window.__ratioExports = [];
    const create = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.__ratioExports.push(blob); return create(blob); };
    Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Selected')).click();
  })()`);
  await waitFor(`window.__ratioExports.length === 1`);
  const customRatio = await evaluate(`(async () => { const image = await createImageBitmap(window.__ratioExports[0]); const value = image.width / image.height; image.close(); return value; })()`);
  if (Math.abs(customRatio - 21 / 9) > 0.01) throw new Error(`Custom export ratio was ${customRatio}`);

  await evaluate(`Array.from(document.querySelectorAll('button')).find(button => button.textContent.includes('Presets')).click()`);
  await waitFor(`!!document.querySelector('#platform-presets')`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.trim() === 'YouTube').click()`);
  await evaluate(`Array.from(document.querySelectorAll('#platform-presets button')).find(button => button.textContent.includes('Thumbnail')).click()`);
  assertSelected(await checkedRatios(), ["YouTube · Thumbnail (16:9)"]);
  await evaluate(`Array.from(document.querySelectorAll('#export-options button')).find(button => button.textContent.includes('Download Selected')).click()`);
  await waitFor(`window.__ratioExports.length === 2`);
  const platformSize = await evaluate(`(async () => { const image = await createImageBitmap(window.__ratioExports[1]); const size = [image.width, image.height]; image.close(); return size; })()`);
  if (Math.abs(platformSize[0] / platformSize[1] - 16 / 9) > 0.01) throw new Error(`Platform export dimensions were ${platformSize}`);
  console.log("Preset, custom, and platform ratios stay in sync with export selection and downloaded images.");
} finally {
  socket.close();
}
