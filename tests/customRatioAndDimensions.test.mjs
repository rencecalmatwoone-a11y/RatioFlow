import assert from "node:assert/strict";
import test from "node:test";
import { getActiveRatio, parseRatioSide } from "../src/lib/ratios.ts";
import { calculateOutputDimensions, dimensionsFromSide, parseOutputInput } from "../src/lib/exportDimensions.ts";
import { calculateExportGeometry, exportFilename } from "../src/lib/exportImage.ts";
import { exportMultiple } from "../src/lib/exportMultiple.ts";
import { RATIOS } from "../src/lib/ratios.ts";

const size = (preset, customSide = 1920, customAxis = "width") => ({ preset, customSide, customAxis });

test("custom ratios accept decimals, normalize labels, and reject invalid sides", () => {
  assert.equal(parseRatioSide("1.500"), 1.5);
  for (const value of ["", "0", "-5", "abc", "Infinity", "100000", "1e2"]) {
    assert.equal(parseRatioSide(value), null);
  }
  const ratio = getActiveRatio("custom", { width: 1.91, height: 1 });
  assert.equal(ratio.label, "1.91:1");
  assert.equal(exportFilename("photo.jpg", "custom", "webp", ratio.label), "photo-1.91x1.webp");
});

test("preset sizes round the secondary side independently for each ratio", () => {
  const cases = [
    [{ width: 16, height: 9 }, 1080, 608],
    [{ width: 9, height: 16 }, 608, 1080],
    [{ width: 1, height: 1 }, 1080, 1080],
    [{ width: 4, height: 5 }, 864, 1080],
    [{ width: 3, height: 2 }, 1080, 720],
  ];
  for (const [ratio, width, height] of cases) {
    const result = calculateOutputDimensions(2000, ratio, size("1080"));
    assert.deepEqual([result.width, result.height], [width, height]);
  }
  assert.deepEqual(dimensionsFromSide({ width: 16, height: 9 }, 1920, "width"), { width: 1920, height: 1080 });
  assert.deepEqual(dimensionsFromSide({ width: 16, height: 9 }, 720, "height"), { width: 1280, height: 720 });
});

test("custom output inputs stay within bounds and requested sizes never upscale", () => {
  for (const value of ["", "0", "-1", "NaN", "Infinity", "8193", "12.5"]) {
    assert.equal(parseOutputInput(value), null);
  }
  assert.equal(parseOutputInput("1920"), 1920);
  const limited = calculateExportGeometry(800, 600, { width: 16, height: 9 }, { x: 0.5, y: 0.5 }, 1, "fill", size("2160"));
  assert.ok(limited.outputWidth <= limited.sourceWidth);
  assert.ok(limited.outputHeight <= limited.sourceHeight);
  assert.deepEqual([limited.outputWidth, limited.outputHeight], [800, 450]);
  const decimal = calculateExportGeometry(4000, 3000, { width: 1.91, height: 1 }, { x: 0.5, y: 0.5 }, 1, "fill", size("1080"));
  assert.deepEqual([decimal.outputWidth, decimal.outputHeight], [1080, 565]);
  const huge = calculateOutputDimensions(100000, { width: 1.91, height: 1 }, size("original"));
  assert.ok(huge.width <= 8192 && huge.height <= 8192);
  assert.ok(huge.width * huge.height <= 32_000_000);
});

test("custom portrait and wide crops keep the focal point and Fill boundaries", () => {
  for (const ratio of [{ width: 21, height: 9 }, { width: 3, height: 4 }, { width: 1.91, height: 1 }]) {
    const fill = calculateExportGeometry(4000, 3000, ratio, { x: 0.8, y: 0.2 }, 1.5, "fill", size("1440"));
    const fit = calculateExportGeometry(4000, 3000, ratio, { x: 0.8, y: 0.2 }, 1, "fit", size("1440"));
    assert.ok(fill.sourceX >= 0 && fill.sourceY >= 0);
    assert.ok(fill.sourceX + fill.sourceWidth <= 4000);
    assert.ok(fill.sourceY + fill.sourceHeight <= 3000);
    assert.equal(fill.destinationWidth, fill.outputWidth);
    assert.equal(fill.destinationHeight, fill.outputHeight);
    assert.deepEqual([fit.sourceX, fit.sourceY, fit.sourceWidth, fit.sourceHeight], [0, 0, 4000, 3000]);
  }
});

test("multi-ratio exports size each file separately and custom uses a descriptive filename", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  globalThis.createImageBitmap = async () => ({ close() {} });
  globalThis.document = {
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({ drawImage() {} }),
      toBlob(callback, mime) { callback(new Blob([`${this.width}x${this.height}`], { type: mime })); },
    }),
  };
  try {
    const source = {
      file: new File(["source"], "photo.png", { type: "image/png" }),
      imageName: "photo.png", imageWidth: 4000, imageHeight: 3000,
      focalPoint: { x: 0.5, y: 0.5 }, zoom: 1, viewMode: "fill",
      options: { format: "webp", quality: 0.85 },
      exportSize: size("1080"),
    };
    const files = await exportMultiple(source, RATIOS.map((ratio) => ratio.id));
    assert.deepEqual(await Promise.all(files.map((file) => file.blob.text())), ["608x1080", "1080x1080", "864x1080", "1080x720", "1080x608"]);
    const custom = await exportMultiple({ ...source, exportSize: size("custom", 1920), customRatio: { width: 21, height: 9 } }, ["custom"]);
    assert.equal(custom[0].name, "photo-21x9.webp");
    assert.equal(await custom[0].blob.text(), "1920x823");
    const multiCustom = await exportMultiple({ ...source, exportSize: size("custom", 1500), multiRatio: true, currentRatio: "16:9" }, ["9:16", "1:1", "16:9"]);
    assert.deepEqual(await Promise.all(multiCustom.map((file) => file.blob.text())), ["844x1500", "1500x1500", "1500x844"]);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});
