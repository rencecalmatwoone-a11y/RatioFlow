import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { exportMultiple } from "../src/lib/exportMultiple.ts";
import { downloadZip } from "../src/lib/downloadZip.ts";
import { exportZipFilename } from "../src/lib/fileName.ts";
import { RATIOS } from "../src/lib/ratios.ts";

test("batch export uses the original source sequentially and gives each ratio its own crop", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  const draws = [];
  const encodes = [];
  const progress = [];
  let active = 0;
  let maxActive = 0;
  let decodes = 0;

  globalThis.createImageBitmap = async (file) => {
    assert.equal(file.name, "summer.jpg");
    decodes += 1;
    active += 1;
    maxActive = Math.max(maxActive, active);
    return { close: () => { active -= 1; } };
  };
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage: (...args) => draws.push(args),
        imageSmoothingQuality: "",
      }),
      toBlob(callback, mime, quality) {
        encodes.push([mime, quality]);
        setTimeout(() => callback(new Blob([`${this.width}x${this.height}`], { type: mime })), 0);
      },
    }),
  };

  try {
    const source = {
      file: new File(["original"], "summer.jpg", { type: "image/jpeg" }),
      imageName: "summer.jpg",
      imageWidth: 4000,
      imageHeight: 3000,
      focalPoint: { x: 0.72, y: 0.31 },
      zoom: 1.2,
      viewMode: "fill",
      options: { format: "webp", quality: 0.9 },
    };
    const files = await exportMultiple(source, RATIOS.map((ratio) => ratio.id), (current, total) => progress.push([current, total]));

    assert.deepEqual(files.map((file) => file.name), [
      "summer-9x16.webp", "summer-1x1.webp", "summer-4x5.webp", "summer-4x3.webp", "summer-3x2.webp", "summer-16x9.webp",
    ]);
    assert.deepEqual(progress, [[1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [6, 6]]);
    assert.equal(decodes, 6);
    assert.equal(maxActive, 1);
    assert.equal(active, 0);
    assert.equal(draws.length, 6);
    assert.deepEqual(encodes, Array.from({ length: 6 }, () => ["image/webp", 0.9]));
    assert.equal(new Set(draws.map((draw) => `${draw[1]},${draw[2]},${draw[3]},${draw[4]}`)).size, 6);
    for (const [index, file] of files.entries()) {
      assert.equal(file.blob.type, "image/webp");
      const [width, height] = (await file.blob.text()).split("x").map(Number);
      assert.equal(width / height, RATIOS[index].value);
    }
    assert.equal(source.focalPoint.x, 0.72);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});

test("ZIP download contains the generated files with a clean source-based name", async () => {
  const originalDocument = globalThis.document;
  const originalWindow = globalThis.window;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;
  let zipBlob;
  let downloadName;
  let cleanup;
  let revoked = false;

  URL.createObjectURL = (blob) => { zipBlob = blob; return "blob:ratioflow-test"; };
  URL.revokeObjectURL = () => { revoked = true; };
  globalThis.window = { setTimeout: (callback) => { cleanup = callback; } };
  globalThis.document = {
    body: { appendChild: () => {} },
    createElement: () => ({
      style: {},
      set download(value) { downloadName = value; },
      click: () => {},
      remove: () => {},
    }),
  };

  try {
    await downloadZip([
      { name: "summer-1x1.png", blob: new Blob(["square"], { type: "image/png" }) },
      { name: "summer-4x5.png", blob: new Blob(["portrait"], { type: "image/png" }) },
    ], exportZipFilename("summer.jpg"));

    assert.equal(downloadName, "summer-ratioflow.zip");
    const zip = await JSZip.loadAsync(zipBlob);
    assert.deepEqual(Object.keys(zip.files).sort(), ["summer-1x1.png", "summer-4x5.png"]);
    assert.equal(await zip.file("summer-1x1.png").async("string"), "square");
    assert.equal(await zip.file("summer-4x5.png").async("string"), "portrait");
    cleanup();
    assert.equal(revoked, true);
  } finally {
    URL.createObjectURL = originalCreate;
    URL.revokeObjectURL = originalRevoke;
    globalThis.document = originalDocument;
    globalThis.window = originalWindow;
  }
});
