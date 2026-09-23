// Run with a local production server and a Chrome/Edge CDP port.
// node tests/resizeHandles.browser.mjs http://localhost:3137 http://127.0.0.1:9228
import assert from "node:assert/strict";

const appUrl = process.argv[2] ?? "http://localhost:3000";
const debuggerUrl = process.argv[3] ?? "http://127.0.0.1:9222";
const targets = await (await fetch(`${debuggerUrl}/json/list`)).json();
const target = targets.find((item) => item.type === "page" && item.url === "about:blank")
  ?? targets.find((item) => item.type === "page");
assert.ok(target, "A browser page is available");

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
  const response = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
  return response.result.value;
}
async function waitFor(expression) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out waiting for ${expression}; page: ${await evaluate("document.body.innerText.slice(0, 400)")}`);
}
async function frame() {
  return evaluate(`(() => {
    const rect = document.querySelector('.ratio-viewport').getBoundingClientRect();
    return { width: rect.width, height: rect.height, ratio: rect.width / rect.height,
      transition: getComputedStyle(document.querySelector('.ratio-viewport')).transitionDuration };
  })()`);
}
async function handlePoint(side) {
  return evaluate(`(() => {
    const rect = document.querySelector('.ratio-resize-handle--${side}').getBoundingClientRect();
    return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
  })()`);
}
async function mouseDrag(side, delta, checkDuringDrag) {
  const point = await handlePoint(side);
  assert.ok(point.y > 0 && point.y < 900, `The ${side} handle is in the viewport: ${JSON.stringify(point)}`);
  const hit = await evaluate(`document.elementFromPoint(${point.x}, ${point.y})?.outerHTML.slice(0, 240)`);
  assert.ok(hit?.includes("ratio-resize"), `Pointer hits the ${side} handle: ${hit}`);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", ...point, button: "none", buttons: 0 });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", ...point, button: "left", buttons: 1, clickCount: 1 });
  for (const fraction of [0.25, 0.5, 0.75, 1]) {
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x + delta * fraction, y: point.y, button: "left", buttons: 1 });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  await waitFor(`document.querySelector('.ratio-viewport').classList.contains('ratio-viewport--resizing')`);
  await checkDuringDrag(await frame());
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x + delta, y: point.y, button: "left", buttons: 0, clickCount: 1 });
  await waitFor(`!document.querySelector('.ratio-viewport').classList.contains('ratio-viewport--resizing')`);
}

try {
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Network.enable");
  await send("Network.setCacheDisabled", { cacheDisabled: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await send("Emulation.setDeviceMetricsOverride", { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url: `${appUrl}?resize-test=${Date.now()}` });
  await waitFor(`document.body.textContent.includes('Choose Image')`);
  await new Promise((resolve) => setTimeout(resolve, 500));
  await evaluate(`(async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1600; canvas.height = 1200;
    const context = canvas.getContext('2d');
    context.fillStyle = '#225588'; context.fillRect(0, 0, 1600, 1200);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], 'resize-test.png', { type: 'image/png' }));
    const input = document.querySelector('input[type=file]');
    input.files = transfer.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  })()`);
  await waitFor(`!!document.querySelector('.ratio-viewport')`);
  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await waitFor(`Math.abs(document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height - 1) < 0.005`);
  const square = await frame();

  await mouseDrag("right", -65, async (live) => {
    assert.ok(live.width < square.width - 80, `Right handle changes width live: ${square.width} -> ${live.width}`);
    assert.equal(live.transition, "0s", "CSS transition is disabled during drag");
    assert.ok(Math.abs(live.ratio - 0.8) < 0.05, `Live ratio is near 4:5: ${live.ratio}`);
    assert.equal(await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 4 by 5"]').getAttribute('aria-pressed')`), "true");
  });

  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await waitFor(`Math.abs(document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height - 1) < 0.005`);
  await mouseDrag("right", 108, async (live) => {
    assert.ok(Math.abs(live.ratio - 4 / 3) < 0.04 && live.width > square.width, `Right handle expands to 4:3: ${live.ratio}`);
    assert.equal(await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 4 by 3"]').getAttribute('aria-pressed')`), "true");
  });

  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await waitFor(`Math.abs(document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height - 1) < 0.005`);
  await mouseDrag("left", 65, async (live) => {
    assert.ok(Math.abs(live.ratio - 0.8) < 0.05, `Left handle compresses frame: ${live.ratio}`);
  });

  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 1 by 1"]').click()`);
  await waitFor(`Math.abs(document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height - 1) < 0.005`);
  await mouseDrag("left", -70, async (live) => {
    assert.ok(live.ratio > 1.1, `Left handle expands the frame: ${live.ratio}`);
  });

  await evaluate(`document.querySelector('button[aria-label="Set aspect ratio to 16 by 9"]').click()`);
  const animating = await frame();
  assert.ok(animating.transition.includes("0.26s"), `Preset transition is enabled: ${animating.transition}`);
  await new Promise((resolve) => setTimeout(resolve, 90));
  const midway = await frame();
  assert.ok(midway.ratio > 0.9 && midway.ratio < 1.76, `Preset moves through intermediate ratios: ${midway.ratio}`);
  await waitFor(`Math.abs(document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height - 16 / 9) < 0.005`);

  await send("Emulation.setDeviceMetricsOverride", { width: 320, height: 900, deviceScaleFactor: 1, mobile: true });
  await send("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
  await new Promise((resolve) => setTimeout(resolve, 100));
  const touchStart = await frame();
  const point = await handlePoint("right");
  await send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ ...point, id: 1 }] });
  await send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: point.x - 35, y: point.y, id: 1 }] });
  await waitFor(`document.querySelector('.ratio-viewport').getBoundingClientRect().width / document.querySelector('.ratio-viewport').getBoundingClientRect().height < 1.6`);
  const touchLive = await frame();
  assert.ok(touchLive.ratio < touchStart.ratio, "Touch drag compresses the frame");
  assert.ok(await evaluate(`document.documentElement.scrollWidth <= innerWidth`), "Mobile page does not overflow");
  await send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await waitFor(`!document.querySelector('.ratio-viewport').classList.contains('ratio-viewport--resizing')`);
  console.log("Resize handles: live right/left drag, preset recognition, animated preset, touch, and mobile bounds passed");
} finally {
  socket.close();
}
