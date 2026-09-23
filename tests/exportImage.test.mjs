import assert from "node:assert/strict";
import test from "node:test";
import { calculateExportGeometry, exportFilename, exportImage, MAX_EXPORT_DIMENSION } from "../src/lib/exportImage.ts";
import { downloadFile } from "../src/lib/downloadFile.ts";

const ratios = [
  ["9:16", 9, 16], ["1:1", 1, 1], ["4:5", 4, 5], ["3:2", 3, 2], ["16:9", 16, 9],
];

test("Fill uses the largest source crop, keeps ratio and zoom, and clamps the focal point", () => {
  for (const [, width, height] of ratios) {
    const normal = calculateExportGeometry(4000, 3000, { width, height }, { x: 0.72, y: 0.31 }, 1, "fill");
    const zoomed = calculateExportGeometry(4000, 3000, { width, height }, { x: 0.72, y: 0.31 }, 1.25, "fill");
    assert.equal(normal.outputWidth / normal.outputHeight, width / height);
    assert.equal(zoomed.outputWidth / zoomed.outputHeight, width / height);
    assert.ok(normal.sourceX >= 0 && normal.sourceY >= 0);
    assert.ok(normal.sourceX + normal.sourceWidth <= 4000 + 1e-8);
    assert.ok(normal.sourceY + normal.sourceHeight <= 3000 + 1e-8);
    assert.ok(zoomed.sourceWidth < normal.sourceWidth);
    assert.ok(zoomed.sourceHeight < normal.sourceHeight);
    assert.equal(zoomed.destinationWidth, zoomed.outputWidth);
    assert.equal(zoomed.destinationHeight, zoomed.outputHeight);
    assert.ok(zoomed.outputWidth <= zoomed.sourceWidth && zoomed.outputHeight <= zoomed.sourceHeight);
  }
  const square = calculateExportGeometry(4000, 3000, { width: 1, height: 1 }, { x: 0.72, y: 0.31 }, 1, "fill");
  assert.equal(square.sourceX, 1000);
  assert.equal(square.sourceY, 0);
  assert.equal(square.outputWidth, 3000);
});

test("Fit keeps the whole image centered and leaves transparent canvas space", () => {
  const fit = calculateExportGeometry(4000, 3000, { width: 1, height: 1 }, { x: 0.8, y: 0.2 }, 1, "fit");
  assert.deepEqual([fit.sourceX, fit.sourceY, fit.sourceWidth, fit.sourceHeight], [0, 0, 4000, 3000]);
  assert.deepEqual([fit.outputWidth, fit.outputHeight], [3000, 3000]);
  assert.deepEqual([fit.destinationX, fit.destinationY, fit.destinationWidth, fit.destinationHeight], [0, 375, 3000, 2250]);
});

test("large images stay within the Canvas limits", () => {
  const geometry = calculateExportGeometry(20000, 20000, { width: 1, height: 1 }, { x: 0.5, y: 0.5 }, 1, "fill");
  assert.ok(geometry.outputWidth <= MAX_EXPORT_DIMENSION);
  assert.ok(geometry.outputWidth * geometry.outputHeight <= 32_000_000);
});

test("filenames remove the source extension and match the chosen format", () => {
  assert.equal(exportFilename("vacation-photo.jpg", "1:1", "webp"), "vacation-photo-1x1.webp");
  assert.equal(exportFilename("vacation-photo.jpg", "9:16", "jpeg"), "vacation-photo-9x16.jpg");
  assert.equal(exportFilename("vacation-photo.jpg", "16:9", "png"), "vacation-photo-16x9.png");
});

test("Canvas receives the original-image crop and encodes each requested MIME type", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const calls = [];
  let closed = 0;
  globalThis.createImageBitmap = async () => ({ close: () => { closed += 1; } });
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        fillStyle: "",
        fillRect: (...args) => calls.push(["fill", ...args]),
        drawImage: (...args) => calls.push(["draw", ...args]),
      }),
      toBlob(callback, mime) {
        calls.push(["encode", mime]);
        callback(new Blob(["encoded"], { type: mime }));
      },
    }),
  };
  try {
    for (const [format, mime] of [["png", "image/png"], ["jpeg", "image/jpeg"], ["webp", "image/webp"]]) {
      calls.length = 0;
      const blob = await exportImage({
        file: new File(["source"], "source.png", { type: "image/png" }),
        imageWidth: 4000, imageHeight: 3000,
        ratio: { width: 4, height: 5 }, focalPoint: { x: 0.72, y: 0.31 },
        zoom: 1.2, viewMode: "fill", options: { format, quality: 0.9 },
      });
      assert.equal(blob.type, mime);
      assert.deepEqual(calls.find(([kind]) => kind === "encode"), ["encode", mime]);
      const draw = calls.find(([kind]) => kind === "draw");
      assert.deepEqual(draw.slice(2), [1880, 0, 2000, 2500, 0, 0, 2000, 2500]);
      assert.equal(calls.some(([kind]) => kind === "fill"), format === "jpeg");
    }
    assert.equal(closed, 3);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});

test("Fit leaves PNG and WebP padding transparent and paints JPEG padding white", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const fills = [];
  const draws = [];
  globalThis.createImageBitmap = async () => ({ close: () => {} });
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        set fillStyle(value) { this.color = value; },
        fillRect(...args) { fills.push([this.color, ...args]); },
        drawImage(...args) { draws.push(args); },
      }),
      toBlob(callback, mime) { callback(new Blob(["encoded"], { type: mime })); },
    }),
  };
  try {
    for (const format of ["png", "webp", "jpeg"]) {
      fills.length = 0;
      draws.length = 0;
      await exportImage({
        file: new File(["source"], "source.png", { type: "image/png" }),
        imageWidth: 4000, imageHeight: 3000,
        ratio: { width: 1, height: 1 }, focalPoint: { x: 0.8, y: 0.2 },
        zoom: 1, viewMode: "fit", options: { format, quality: 0.9 },
      });
      assert.deepEqual(draws[0].slice(1), [0, 0, 4000, 3000, 0, 375, 3000, 2250]);
      assert.deepEqual(fills, format === "jpeg" ? [["#FFFFFF", 0, 0, 3000, 3000]] : []);
    }
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});

test("download URLs are revoked after the browser can start the download", () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  const events = [];
  let cleanup;
  URL.createObjectURL = () => "blob:export-test";
  URL.revokeObjectURL = (url) => events.push(["revoke", url]);
  globalThis.window = { setTimeout: (callback) => { cleanup = callback; } };
  globalThis.document = {
    body: { appendChild: () => events.push(["append"]) },
    createElement: () => ({
      style: {},
      click: () => events.push(["click"]),
      remove: () => events.push(["remove"]),
    }),
  };
  try {
    downloadFile(new Blob(["image"]), "photo-1x1.png");
    assert.deepEqual(events, [["append"], ["click"], ["remove"]]);
    cleanup();
    assert.deepEqual(events.at(-1), ["revoke", "blob:export-test"]);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
