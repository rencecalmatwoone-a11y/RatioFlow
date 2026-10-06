import assert from "node:assert/strict";
import test from "node:test";
import JSZip from "jszip";
import { createImageEditorState, prepareBatchImages, releaseImageUrls, selectActiveImage, summarizeImageImport } from "../src/lib/batchImages.ts";
import { MAX_BATCH_IMAGES, MAX_FILE_SIZE, MAX_BATCH_TOTAL_BYTES } from "../src/constants/batchLimits.ts";
import { useEditorStore } from "../src/store/editorStore.ts";
import { exportBatchImages, snapshotBatchExport } from "../src/lib/exportBatchImages.ts";
import { createBatchImageFolderNames, exportFilename } from "../src/lib/fileName.ts";
import { calculateExportGeometry } from "../src/lib/exportImage.ts";

function item(id, name = `${id}.png`, editor = createImageEditorState()) {
  const file = new File([id], name, { type: "image/png", lastModified: id.length });
  return { id, name, file, objectUrl: `blob:${id}`, size: file.size, width: 1600, height: 1000, isEdited: false, editor };
}
function reset(images = []) {
  useEditorStore.setState({ ...useEditorStore.getInitialState(), batchImages: images, activeImageId: images[0]?.id ?? null }, true);
  return useEditorStore.getState();
}

test("photos restore independent crop, focal point, zoom, Fit/Fill memory, custom and preset state", () => {
  const state = reset([item("a"), item("b")]);
  state.setCrop({ x: 90, y: -20 }); state.setFocalPoint({ x: 0.2, y: 0.7 }); state.setZoom(1.4);
  state.setCustomRatio(2, 1); state.setViewMode("fit");
  const savedA = structuredClone(selectActiveImage(useEditorStore.getState()).editor);
  state.setActiveImage("b"); state.setActivePlatformPreset("instagram-story");
  state.setCrop({ x: -80, y: 30 }); state.setFocalPoint({ x: 0.8, y: 0.3 }); state.setZoom(2);
  const savedB = structuredClone(selectActiveImage(useEditorStore.getState()).editor);
  state.setActiveImage("a");
  assert.deepEqual(selectActiveImage(useEditorStore.getState()).editor, savedA);
  state.setViewMode("fill");
  assert.equal(selectActiveImage(useEditorStore.getState()).editor.zoom, 1.4);
  assert.deepEqual(selectActiveImage(useEditorStore.getState()).editor.crop, { x: 90, y: -20 });
  state.setActiveImage("b"); assert.deepEqual(selectActiveImage(useEditorStore.getState()).editor, savedB);
});

test("batch ratio edits and Reset preserve shared export targets and settings; single-photo synchronization remains", () => {
  let state = reset([item("a"), item("b")]);
  state.clearExportRatios(); state.toggleExportRatio("1:1"); state.toggleExportRatio("9:16");
  state.setExportFormat("webp"); state.setExportQuality(0.8); state.setCustomExportSide(720, "width"); state.setExportSizePreset("custom");
  state.setSelectedRatio("4:5"); state.setActiveImage("b"); state.resetEditor();
  const current = useEditorStore.getState();
  assert.deepEqual(current.selectedExportRatios, ["9:16", "1:1"]);
  assert.equal(current.exportFormat, "webp"); assert.equal(current.exportQuality, 0.8);
  assert.deepEqual(current.exportSize, { preset: "custom", customSide: 720, customAxis: "width" });
  state = reset([item("single")]); state.setSelectedRatio("4:5");
  assert.deepEqual(useEditorStore.getState().selectedExportRatios, ["4:5"]);
  state.setManualRatio(1.005, 400);
  assert.deepEqual(useEditorStore.getState().selectedExportRatios, ["1:1"]);
});

test("Apply ratio to all copies only ratio/preset configuration, including per-source Free ratios", () => {
  const a = item("a"); const b = { ...item("b"), width: 900, height: 1800 };
  b.editor = { ...b.editor, crop: { x: -120, y: 12 }, focalPoint: { x: 0.8, y: 0.2 }, zoom: 2.2 };
  const state = reset([a, b]); state.setActivePlatformPreset("instagram-story"); state.applyRatioToAll();
  const after = useEditorStore.getState().batchImages[1].editor;
  assert.equal(after.activePlatformPresetId, "instagram-story"); assert.equal(after.selectedRatioId, "platform");
  assert.deepEqual(after.crop, b.editor.crop); assert.deepEqual(after.focalPoint, b.editor.focalPoint); assert.equal(after.zoom, 2.2);
  state.setSelectedRatio("free"); state.applyRatioToAll();
  assert.deepEqual(useEditorStore.getState().batchImages[1].editor.customRatio, { width: 1, height: 2 });
});

test("shared platform output size survives thumbnail switches and changes to the selected platform export target", () => {
  const state = reset([item("a"), item("b")]);
  state.setActivePlatformPreset("instagram-story"); state.setExportSizePreset("preset"); state.toggleExportRatio("platform");
  state.setActiveImage("b"); state.toggleExportRatio("platform");
  assert.equal(useEditorStore.getState().exportSize.platformPresetId, "instagram-story");
  state.setActivePlatformPreset("youtube-thumbnail"); state.toggleExportRatio("platform");
  assert.equal(useEditorStore.getState().exportRatioConfiguration.platformPresetId, "youtube-thumbnail");
  assert.equal(useEditorStore.getState().exportSize.platformPresetId, "instagram-story");
  state.setActiveImage("a");
  assert.equal(useEditorStore.getState().exportSize.platformPresetId, "instagram-story");
});

test("remove and replace release only the affected URL; active removal picks the nearest photo; clear releases the rest", () => {
  const original = URL.revokeObjectURL; const revoked = [];
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const state = reset([item("a"), item("b"), item("c"), item("d")]);
    state.setActiveImage("c"); state.removeImage("b"); assert.equal(useEditorStore.getState().activeImageId, "c");
    assert.deepEqual(revoked, ["blob:b"]);
    state.removeImage("c"); assert.equal(useEditorStore.getState().activeImageId, "d");
    state.replaceImage("d", item("replacement"));
    assert.equal(selectActiveImage(useEditorStore.getState()).name, "replacement.png");
    state.setIsExporting(true); state.removeImage("a"); state.clearBatch();
    assert.equal(useEditorStore.getState().batchImages.length, 2);
    state.setIsExporting(false); state.clearBatch();
    assert.deepEqual(revoked, ["blob:b", "blob:c", "blob:d", "blob:a", "blob:replacement"]);
    assert.equal(useEditorStore.getState().activeImageId, null);
  } finally { URL.revokeObjectURL = original; reset(); }
});

test("metadata preparation validates every file, preserves order, closes bitmaps and skips duplicates", async () => {
  const originalBitmap = globalThis.createImageBitmap;
  const originalImage = globalThis.Image;
  const originalRevoke = URL.revokeObjectURL;
  const revoked = []; let live = 0; let maxLive = 0; let closes = 0;
  globalThis.createImageBitmap = async (file) => {
    if (file.name === "corrupt.png") throw new Error("decode");
    live++; maxLive = Math.max(maxLive, live);
    return { width: 1600, height: 1000, close() { live--; closes++; } };
  };
  globalThis.Image = class { set src(value) { queueMicrotask(() => this.onerror()); } removeAttribute() {} };
  URL.revokeObjectURL = (url) => revoked.push(url);
  try {
    const good = new File(["ok"], "good.jpg", { type: "image/jpeg", lastModified: 1 });
    const sameName = new File(["other"], "good.jpg", { type: "image/jpeg", lastModified: 2 });
    const files = [good, new File(["pdf"], "bad.pdf", { type: "application/pdf" }),
      new File([new Uint8Array(MAX_FILE_SIZE + 1)], "huge.jpg", { type: "image/jpeg" }),
      new File([], "empty.png", { type: "image/png" }), new File(["bad"], "corrupt.png", { type: "image/png" }), good, sameName];
    const preferences = { ...createImageEditorState(), selectedRatioId: "1:1", crop: { x: 120, y: 80 }, focalPoint: { x: 0.1, y: 0.2 }, zoom: 2 };
    const result = await prepareBatchImages(files, [], preferences);
    assert.equal(result.images.length, 2); assert.equal(result.issues.length, 5);
    assert.notEqual(result.images[0].id, result.images[1].id);
    assert.equal(result.images[0].file, good); assert.equal(result.images[1].file, sameName);
    for (const image of result.images) {
      assert.deepEqual(image.editor.crop, { x: 0, y: 0 }); assert.deepEqual(image.editor.focalPoint, { x: 0.5, y: 0.5 });
      assert.equal(image.editor.zoom, 1); assert.equal(image.editor.selectedRatioId, "1:1");
    }
    assert.equal(maxLive, 1); assert.equal(live, 0); assert.equal(closes, 2); assert.equal(revoked.length, 1);
    result.images.forEach((image) => originalRevoke(image.objectUrl));
  } finally { globalThis.createImageBitmap = originalBitmap; globalThis.Image = originalImage; URL.revokeObjectURL = originalRevoke; }
});

test("25-photo and total-byte limits accept the first valid files gracefully; cancellation releases the pending URL", async () => {
  const originalBitmap = globalThis.createImageBitmap; const originalRevoke = URL.revokeObjectURL;
  const revoked = []; URL.revokeObjectURL = (url) => revoked.push(url);
  globalThis.createImageBitmap = async () => ({ width: 800, height: 600, close() {} });
  try {
    const files = Array.from({ length: 30 }, (_, index) => new File([`${index}`], `${index}.png`, { type: "image/png" }));
    const result = await prepareBatchImages(files, []);
    assert.equal(result.images.length, MAX_BATCH_IMAGES); assert.equal(result.issues.length, 5);
    assert.deepEqual(result.images.map((image) => image.name), files.slice(0, 25).map((file) => file.name));
    result.images.forEach((image) => originalRevoke(image.objectUrl));
    const full = { ...item("full"), size: MAX_BATCH_TOTAL_BYTES - 1 };
    const bytes = await prepareBatchImages([files[12]], [full]);
    assert.equal(bytes.images.length, 0); assert.match(bytes.issues[0].reason, /250 MB/);
    let cancelled = false;
    globalThis.createImageBitmap = async () => { cancelled = true; return { width: 1, height: 1, close() {} }; };
    const cancelResult = await prepareBatchImages([files[0]], [], undefined, undefined, () => cancelled);
    assert.equal(cancelResult.images.length, 0); assert.equal(revoked.length, 1);
  } finally { globalThis.createImageBitmap = originalBitmap; URL.revokeObjectURL = originalRevoke; }
});

test("collision-safe folders handle duplicate, sanitized, case-only and suffix-like names", () => {
  assert.deepEqual(createBatchImageFolderNames(["IMG.jpg", "IMG.png", "img.webp", "IMG-2.jpg", "a/b.jpg", "a\\b.jpg", "..jpg", "CON.png"]),
    ["IMG", "IMG-2", "img-3", "IMG-2-2", "a-b", "a-b-2", "image", "image-CON"]);
});

test("batch ZIP uses snapshotted framing, global targets and formats sequentially, and releases every Canvas and bitmap", async () => {
  const originalBitmap = globalThis.createImageBitmap; const originalDocument = globalThis.document;
  const canvases = []; const draws = []; let live = 0; let maxLive = 0; let closes = 0;
  globalThis.createImageBitmap = async (file) => {
    live++; maxLive = Math.max(maxLive, live);
    return { name: file.name, close() { live--; closes++; } };
  };
  globalThis.document = { createElement() {
    const canvas = { width: 0, height: 0, getContext: () => ({ fillRect() {}, drawImage: (...args) => draws.push(args) }),
      toBlob(callback, mime) { queueMicrotask(() => callback(new Blob([`${this.width}x${this.height}`], { type: mime }))); } };
    canvases.push(canvas); return canvas;
  } };
  try {
    const a = item("a", "same.png", { ...createImageEditorState(), focalPoint: { x: 0.15, y: 0.5 }, zoom: 1.2 });
    const b = item("b", "same.png", { ...createImageEditorState(), focalPoint: { x: 0.85, y: 0.5 }, zoom: 2 });
    const state = reset([a, b]); state.clearExportRatios(); state.toggleExportRatio("1:1"); state.toggleExportRatio("4:5");
    state.setCustomExportSide(400, "width"); state.setExportSizePreset("custom");
    for (const format of ["png", "jpeg", "webp"]) {
      state.setExportFormat(format);
      const snapshot = snapshotBatchExport(useEditorStore.getState());
      state.setFocalPoint({ x: 0.5, y: 0.1 }); state.setZoom(3); state.setExportFormat("jpeg");
      assert.equal(snapshot.images[0].editor.zoom, 1.2);
      const progress = [];
      const blob = await exportBatchImages(snapshot, (value) => progress.push(value));
      const zip = await JSZip.loadAsync(blob);
      const extension = format === "jpeg" ? "jpg" : format;
      assert.deepEqual(Object.keys(zip.files).filter((name) => !zip.files[name].dir),
        [`same/same-1x1.${extension}`, `same/same-4x5.${extension}`, `same-2/same-1x1.${extension}`, `same-2/same-4x5.${extension}`]);
      assert.equal(await zip.file(`same/same-1x1.${extension}`).async("string"), "400x400");
      const expected = calculateExportGeometry(a.width, a.height, { width: 1, height: 1 }, a.editor.focalPoint, a.editor.zoom, "fill", snapshot.exportSize);
      assert.equal(draws.at(-4)[1], expected.sourceX); assert.equal(draws.at(-4)[3], expected.sourceWidth);
      assert.notEqual(draws.at(-4)[1], draws.at(-2)[1]);
      assert.equal(progress.at(-1).phase, "zipping"); assert.equal(progress.at(-1).completed, 4);
      assert.equal(progress[0].imageName, "same.png"); assert.equal(progress[0].ratioLabel, "1:1");
      assert.ok(progress.every((value, index) => !index || value.completed >= progress[index - 1].completed));
      state.updateImageEditorState("a", a.editor);
    }
    assert.equal(maxLive, 1); assert.equal(live, 0); assert.equal(closes, 12);
    assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
    assert.equal(useEditorStore.getState().activeImageId, "a");
  } finally { globalThis.createImageBitmap = originalBitmap; globalThis.document = originalDocument; reset(); }
});

test("batch failure names the photo, releases resources, and leaves the batch available to retry", async () => {
  const originalBitmap = globalThis.createImageBitmap; const originalDocument = globalThis.document;
  let closes = 0; const canvases = [];
  globalThis.createImageBitmap = async () => ({ close() { closes++; } });
  globalThis.document = { createElement() {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage() {} }), toBlob(callback) { callback(null); } };
    canvases.push(canvas); return canvas;
  } };
  try {
    reset([item("fail", "broken-photo.png"), item("keep")]);
    const snapshot = snapshotBatchExport(useEditorStore.getState());
    await assert.rejects(exportBatchImages(snapshot), /broken-photo.png.*edits are still saved/);
    assert.equal(useEditorStore.getState().batchImages.length, 2); assert.equal(closes, 1);
    assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
  } finally { globalThis.createImageBitmap = originalBitmap; globalThis.document = originalDocument; reset(); }
});

test("edited tracking ignores selection, layout crop, no-op zoom and safe zones; Reset Image affects only the active photo", () => {
  const state = reset([item("a"), item("b")]);
  state.setActiveImage("b"); state.setCrop({ x: 12, y: 0 }); state.setZoom(1); state.setShowSafeZone(true);
  assert.equal(selectActiveImage(useEditorStore.getState()).isEdited, false);
  state.setFocalPoint({ x: 0.8, y: 0.5 }); state.setZoom(2);
  assert.equal(selectActiveImage(useEditorStore.getState()).isEdited, true);
  state.setActiveImage("a"); state.setSelectedRatio("4:5");
  state.setExportFormat("webp"); state.setCustomExportSide(500, "width"); state.setExportSizePreset("custom");
  const before = useEditorStore.getState(); const other = before.batchImages[1];
  state.resetImage();
  const after = useEditorStore.getState();
  assert.equal(after.batchImages[0].isEdited, false); assert.deepEqual(after.batchImages[0].editor, createImageEditorState());
  assert.equal(after.batchImages[1], other);
  assert.equal(after.exportFormat, "webp"); assert.equal(after.exportSize, before.exportSize);
  assert.equal(after.selectedExportRatios, before.selectedExportRatios);
  state.applyRatioToAll();
  assert.equal(useEditorStore.getState().batchImages[0].isEdited, false, "no-op apply does not mark untouched photos");
});

test("consolidated import summary accounts for every category, including duplicate feedback", () => {
  const issues = [{ name: "a", code: "unsupported", reason: "type" }, { name: "b", code: "size", reason: "size" }, { name: "c", code: "decode", reason: "decode" }];
  assert.equal(summarizeImageImport(8, 5, issues), "8 files selected · 5 added · 1 unsupported · 1 too large · 1 unreadable.");
  assert.equal(summarizeImageImport(1, 0, [{ name: "a", code: "duplicate", reason: "duplicate" }]), "1 file selected · 0 added · 1 duplicate skipped.");
});

test("long Unicode filenames stay extractable and collisions after truncation remain unique", () => {
  const names = ["旅行🌴".repeat(80) + "A.png", "旅行🌴".repeat(80) + "B.png"];
  const folders = createBatchImageFolderNames(names);
  assert.equal(new Set(folders).size, 2); assert.ok(folders.every(name => Buffer.byteLength(name) < 120));
  for (const name of names) {
    const filename = exportFilename(name, "4:5", "png");
    assert.ok(filename.startsWith("旅行🌴")); assert.ok(Buffer.byteLength(filename) < 255);
    assert.ok(!filename.includes("�")); assert.ok(filename.endsWith("-4x5.png"));
  }
});

test("small previews reuse the sequential metadata bitmap, reset canvases, survive preview failure, and release both URLs on cancellation", async () => {
  const previous = { bitmap: globalThis.createImageBitmap, document: globalThis.document, create: URL.createObjectURL, revoke: URL.revokeObjectURL };
  const urls = new Map(); const canvases = []; const draws = []; let live = 0; let maximum = 0; let next = 0;
  let cancel = false; let cancelOnEncode = false; let failPreview = false;
  URL.createObjectURL = blob => { const url = `blob:test-preview-${++next}`; urls.set(url, blob); return url; };
  URL.revokeObjectURL = url => urls.delete(url);
  globalThis.createImageBitmap = async () => { live++; maximum = Math.max(maximum, live); return { width: 4032, height: 3024, close() { live--; } }; };
  globalThis.document = { createElement() {
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args) => draws.push(args) }),
      toBlob(callback) { if (cancelOnEncode) cancel = true; callback(failPreview ? null : new Blob(["small-preview"], { type: "image/webp" })); } };
    canvases.push(canvas); return canvas;
  } };
  try {
    const file = new File(["source"], "large.jpg", { type: "image/jpeg" });
    const normal = await prepareBatchImages([file], []);
    assert.equal(normal.images[0].width, 4032); assert.ok(normal.images[0].thumbnailUrl);
    assert.deepEqual(draws[0].slice(1), [0, 0, 128, 96]); assert.equal(maximum, 1); assert.equal(live, 0);
    assert.equal(urls.size, 2); releaseImageUrls(normal.images[0]); assert.equal(urls.size, 0);
    cancelOnEncode = true;
    const cancelled = await prepareBatchImages([file], [], undefined, undefined, () => cancel);
    assert.equal(cancelled.images.length, 0); assert.equal(urls.size, 0);
    cancelOnEncode = false; cancel = false; failPreview = true;
    const readable = await prepareBatchImages([file], []);
    assert.equal(readable.images.length, 1); assert.equal(readable.images[0].thumbnailUrl, undefined);
    releaseImageUrls(readable.images[0]); assert.equal(urls.size, 0);
    assert.ok(canvases.every(canvas => canvas.width === 0 && canvas.height === 0)); assert.equal(live, 0);
  } finally {
    globalThis.createImageBitmap = previous.bitmap; globalThis.document = previous.document;
    URL.createObjectURL = previous.create; URL.revokeObjectURL = previous.revoke;
  }
});

test("removing and clearing photos releases their small preview URLs alongside originals", () => {
  const previous = URL.revokeObjectURL; const revoked = []; URL.revokeObjectURL = url => revoked.push(url);
  try {
    const state = reset([{ ...item("a"), thumbnailUrl: "blob:small-a" }, { ...item("b"), thumbnailUrl: "blob:small-b" }]);
    state.removeImage("a"); assert.deepEqual(revoked, ["blob:a", "blob:small-a"]);
    state.clearBatch(); assert.deepEqual(revoked, ["blob:a", "blob:small-a", "blob:b", "blob:small-b"]);
  } finally { URL.revokeObjectURL = previous; reset(); }
});

test("batch Free targets resolve the original ratio of each source, including photos edited with another ratio", async () => {
  const originalBitmap = globalThis.createImageBitmap; const originalDocument = globalThis.document;
  globalThis.createImageBitmap = async () => ({ close() {} });
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ drawImage() {} }),
    toBlob(callback, mime) { callback(new Blob([`${this.width}x${this.height}`], { type: mime })); } }) };
  try {
    const state = reset([item("landscape"), { ...item("portrait"), width: 900, height: 1800 }]);
    state.clearExportRatios(); state.toggleExportRatio("free");
    const zip = await JSZip.loadAsync(await exportBatchImages(snapshotBatchExport(useEditorStore.getState())));
    assert.equal(await zip.file("landscape/landscape-free.png").async("string"), "1600x1000");
    assert.equal(await zip.file("portrait/portrait-free.png").async("string"), "900x1800");
  } finally { globalThis.createImageBitmap = originalBitmap; globalThis.document = originalDocument; reset(); }
});
