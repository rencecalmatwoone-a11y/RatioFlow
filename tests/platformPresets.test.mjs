import assert from "node:assert/strict";
import test from "node:test";
import { PLATFORM_PRESETS, PLATFORMS, getPlatformPresetById, getPresetRatio, getPresetsByPlatform } from "../src/constants/platformPresets.ts";
import { getActiveRatio } from "../src/lib/ratios.ts";
import { calculateExportGeometry } from "../src/lib/exportImage.ts";
import { exportMultiple } from "../src/lib/exportMultiple.ts";

const presetSize = { preset: "preset", customSide: 1920, customAxis: "width" };
const originalSize = { ...presetSize, preset: "original" };

test("platform catalog has unique IDs, valid dimensions, and ratios derived from dimensions", () => {
  assert.equal(new Set(PLATFORM_PRESETS.map((preset) => preset.id)).size, PLATFORM_PRESETS.length);
  for (const platform of PLATFORMS) assert.ok(getPresetsByPlatform(platform.id).length > 0);
  for (const preset of PLATFORM_PRESETS) {
    assert.equal(getPlatformPresetById(preset.id), preset);
    assert.ok(Number.isInteger(preset.width) && preset.width > 0);
    assert.ok(Number.isInteger(preset.height) && preset.height > 0);
    const ratio = getActiveRatio("platform", { width: 21, height: 9 }, preset.id);
    assert.equal(ratio.value, preset.width / preset.height);
    assert.equal(getPresetRatio(preset).label, ratio.label);
  }
  assert.equal(getActiveRatio("platform", { width: 21, height: 9 }, "instagram-story").label, "9:16");
  assert.equal(getActiveRatio("platform", { width: 21, height: 9 }, "instagram-square-post").label, "1:1");
  assert.deepEqual([getActiveRatio("custom", { width: 21, height: 9 }).width, getActiveRatio("custom", { width: 21, height: 9 }).height], [21, 9]);
});

test("preset geometry preserves focal point and zoom in the shared Fill and Fit engine", () => {
  for (const id of ["instagram-story", "youtube-thumbnail", "x-header", "facebook-post", "facebook-story", "facebook-cover", "linkedin-company-banner"]) {
    const preset = getPlatformPresetById(id);
    const ratio = getPresetRatio(preset);
    const fill = calculateExportGeometry(6000, 4000, ratio, { x: 0.75, y: 0.3 }, 1.4, "fill", presetSize, undefined, preset);
    const fit = calculateExportGeometry(6000, 4000, ratio, { x: 0.75, y: 0.3 }, 1, "fit", presetSize, undefined, preset);
    assert.ok(fill.sourceX >= 0 && fill.sourceY >= 0, id);
    assert.ok(fill.sourceX + fill.sourceWidth <= 6000 && fill.sourceY + fill.sourceHeight <= 4000, id);
    assert.ok(fill.sourceWidth < Math.min(6000, 4000 * ratio.value), id);
    assert.equal(fill.outputWidth / fill.outputHeight, preset.width / preset.height, id);
    assert.equal(fit.sourceWidth, 6000, id);
    assert.equal(fit.sourceHeight, 4000, id);
  }
  const story = getPlatformPresetById("instagram-story");
  const ratio = getPresetRatio(story);
  const output = calculateExportGeometry(6000, 4000, ratio, { x: 0.75, y: 0.3 }, 1.4, "fill", presetSize, undefined, story);
  assert.deepEqual([output.outputWidth, output.outputHeight], [1080, 1920]);
  const override = calculateExportGeometry(6000, 4000, ratio, { x: 0.75, y: 0.3 }, 1.4, "fill", { ...presetSize, preset: "1440" }, undefined, story);
  assert.deepEqual([override.outputWidth, override.outputHeight], [810, 1440]);
  assert.deepEqual([override.sourceX, override.sourceY, override.sourceWidth, override.sourceHeight], [output.sourceX, output.sourceY, output.sourceWidth, output.sourceHeight]);
  const limited = calculateExportGeometry(800, 600, ratio, { x: 0.75, y: 0.3 }, 1, "fill", presetSize, undefined, story);
  assert.ok(limited.outputWidth < story.width && limited.outputHeight < story.height);
});

test("Download Current uses preset dimensions and names across PNG, JPEG, WebP without changing multi-ratio exports", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalDocument = globalThis.document;
  globalThis.createImageBitmap = async () => ({ close() {} });
  globalThis.document = { createElement: () => ({
    width: 0, height: 0,
    getContext: () => ({ drawImage() {}, fillRect() {} }),
    toBlob(callback, mime) { callback(new Blob([`${this.width}x${this.height}`], { type: mime })); },
  }) };
  try {
    const preset = getPlatformPresetById("instagram-story");
    const source = {
      file: new File(["source"], "photo.png", { type: "image/png" }),
      imageName: "photo.png", imageWidth: 6000, imageHeight: 4000,
      focalPoint: { x: 0.75, y: 0.3 }, zoom: 1.2, viewMode: "fill",
      exportSize: presetSize, presetDimensions: preset, platformPresetId: preset.id,
      customRatio: { width: 21, height: 9 }, currentRatio: "platform",
    };
    for (const [format, extension] of [["png", "png"], ["jpeg", "jpg"], ["webp", "webp"]]) {
      const files = await exportMultiple({ ...source, options: { format, quality: 0.85 } }, ["platform"]);
      assert.equal(files[0].name, `photo-instagram-story.${extension}`);
      assert.equal(await files[0].blob.text(), "1080x1920");
    }
    const multi = await exportMultiple({ ...source, options: { format: "webp", quality: 0.85 }, exportSize: originalSize, multiRatio: true }, ["9:16", "1:1"]);
    assert.deepEqual(multi.map((file) => file.name), ["photo-9x16.webp", "photo-1x1.webp"]);
  } finally {
    globalThis.createImageBitmap = originalBitmap;
    globalThis.document = originalDocument;
  }
});
