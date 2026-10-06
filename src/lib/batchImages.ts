import { DEFAULT_CUSTOM_RATIO, DEFAULT_RATIO, imageRatio } from "./ratios.ts";
import { IMAGE_ACCEPT, MAX_BATCH_IMAGES, MAX_BATCH_TOTAL_BYTES, MAX_FILE_SIZE } from "../constants/batchLimits.ts";
import type { BatchImageItem, EditorState, ImageEditorState } from "../types/editor.ts";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;

export function createImageEditorState(preferences?: ImageEditorState, width?: number, height?: number): ImageEditorState {
  const selectedRatioId = preferences?.selectedRatioId ?? DEFAULT_RATIO.id;
  return {
    selectedRatioId,
    customRatio: selectedRatioId === "free" && width && height
      ? imageRatio(width, height) : { ...(preferences?.customRatio ?? DEFAULT_CUSTOM_RATIO) },
    activePlatformPresetId: preferences?.activePlatformPresetId ?? null,
    showSafeZone: preferences?.showSafeZone ?? false,
    isManualRatio: false,
    manualFrameWidth: null,
    crop: { x: 0, y: 0 },
    focalPoint: { x: 0.5, y: 0.5 },
    zoom: MIN_ZOOM,
    viewMode: "fill",
    lastFillCrop: { x: 0, y: 0 },
    lastFillZoom: MIN_ZOOM,
  };
}

// Stable fallback for selectors while the upload screen is visible.
export const EMPTY_IMAGE_EDITOR = createImageEditorState();

export function selectActiveImage(state: Pick<EditorState, "batchImages" | "activeImageId">): BatchImageItem | undefined {
  return state.batchImages.find((image) => image.id === state.activeImageId);
}

export function selectActiveEditor(state: Pick<EditorState, "batchImages" | "activeImageId">): ImageEditorState {
  return selectActiveImage(state)?.editor ?? EMPTY_IMAGE_EDITOR;
}

export function imageFingerprint(file: File): string {
  return JSON.stringify([file.name, file.size, file.lastModified]);
}

let fallbackId = 0;
export function createImageId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `image-${Date.now()}-${++fallbackId}`;
}

export type ImageImportIssueCode = "unsupported" | "size" | "empty" | "decode" | "duplicate" | "count" | "total";
export type ImageImportIssue = { name: string; reason: string; code: ImageImportIssueCode };
export type ImageImportResult = { images: BatchImageItem[]; issues: ImageImportIssue[] };

export function validateImageFile(file: File): ImageImportIssue | null {
  if (!Object.hasOwn(IMAGE_ACCEPT, file.type)) return { name: file.name, code: "unsupported", reason: "Unsupported file type. Use JPEG, PNG, or WebP." };
  if (file.size > MAX_FILE_SIZE) return { name: file.name, code: "size", reason: `Image is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.` };
  if (file.size === 0) return { name: file.name, code: "empty", reason: "This image file is empty. Choose another file." };
  return null;
}

export function releaseImageUrls(image: Pick<BatchImageItem, "objectUrl" | "thumbnailUrl">): void {
  URL.revokeObjectURL(image.objectUrl);
  if (image.thumbnailUrl) URL.revokeObjectURL(image.thumbnailUrl);
}

async function createThumbnail(image: CanvasImageSource, width: number, height: number): Promise<string | undefined> {
  if (typeof document === "undefined" || !width || !height) return undefined;
  let canvas: HTMLCanvasElement | null = null;
  try {
    canvas = document.createElement("canvas");
    const scale = Math.min(1, 128 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const output = canvas;
    const blob = await new Promise<Blob | null>((resolve) => output.toBlob(resolve, "image/webp", 0.8));
    return blob ? URL.createObjectURL(blob) : undefined;
  } catch {
    // A failed small preview should not reject an otherwise readable original.
    return undefined;
  } finally {
    if (canvas) canvas.width = canvas.height = 0;
  }
}

async function getDimensions(file: File, url: string): Promise<{ width: number; height: number; thumbnailUrl?: string }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try { return { width: bitmap.width, height: bitmap.height, thumbnailUrl: await createThumbnail(bitmap, bitmap.width, bitmap.height) }; }
      finally { bitmap.close(); }
    } catch {
      // Use the browser's image decoder when ImageBitmap cannot read this file.
    }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const release = () => { image.onload = null; image.onerror = null; image.removeAttribute("src"); };
    image.onload = async () => {
      const width = image.naturalWidth; const height = image.naturalHeight;
      const thumbnailUrl = await createThumbnail(image, width, height);
      release();
      resolve({ width, height, thumbnailUrl });
    };
    image.onerror = () => { release(); reject(new Error("Image decoding failed")); };
    image.src = url;
  });
}

export function summarizeImageImport(selected: number, added: number, issues: readonly ImageImportIssue[], replace = false): string {
  const summary = [`${selected} ${selected === 1 ? "file" : "files"} selected`, `${added} ${replace ? "replaced" : "added"}`];
  const labels: Record<ImageImportIssueCode, string> = { unsupported: "unsupported", size: "too large", empty: "empty", decode: "unreadable",
    duplicate: "duplicates skipped", count: "over the image limit", total: "over the size limit" };
  for (const code of Object.keys(labels) as ImageImportIssueCode[]) {
    const count = issues.filter((issue) => issue.code === code).length;
    if (count) summary.push(`${count} ${code === "duplicate" && count === 1 ? "duplicate skipped" : labels[code]}`);
  }
  return `${summary.join(" · ")}.`;
}

/** Decode metadata one file at a time. The caller owns accepted object URLs. */
export async function prepareBatchImages(
  files: readonly File[], existing: readonly BatchImageItem[], preferences?: ImageEditorState,
  onProgress?: (current: number, total: number) => void, isCancelled: () => boolean = () => false,
): Promise<ImageImportResult> {
  const images: BatchImageItem[] = [];
  const issues: ImageImportIssue[] = [];
  const fingerprints = new Set(existing.map((image) => imageFingerprint(image.file)));
  let totalBytes = existing.reduce((sum, image) => sum + image.size, 0);
  for (const [index, file] of files.entries()) {
    if (isCancelled()) break;
    onProgress?.(index + 1, files.length);
    let issue = validateImageFile(file);
    if (!issue && fingerprints.has(imageFingerprint(file))) issue = { name: file.name, code: "duplicate", reason: "Already in this batch." };
    if (!issue && existing.length + images.length >= MAX_BATCH_IMAGES) issue = { name: file.name, code: "count", reason: `RatioFlow currently supports up to ${MAX_BATCH_IMAGES} images per batch.` };
    if (!issue && totalBytes + file.size > MAX_BATCH_TOTAL_BYTES) issue = { name: file.name, code: "total", reason: `This batch would exceed the ${MAX_BATCH_TOTAL_BYTES / (1024 * 1024)} MB total size limit.` };
    if (issue) { issues.push(issue); continue; }
    let url: string | null = null;
    let thumbnailUrl: string | undefined;
    try {
      url = URL.createObjectURL(file);
      const dimensions = await getDimensions(file, url);
      const { width, height } = dimensions;
      thumbnailUrl = dimensions.thumbnailUrl;
      if (isCancelled()) { releaseImageUrls({ objectUrl: url, thumbnailUrl }); break; }
      if (![width, height].every((side) => Number.isSafeInteger(side) && side > 0)) throw new Error("Invalid dimensions");
      images.push({ id: createImageId(), file, objectUrl: url, thumbnailUrl, name: file.name, width, height, size: file.size,
        isEdited: false, editor: createImageEditorState(preferences, width, height) });
      fingerprints.add(imageFingerprint(file));
      totalBytes += file.size;
    } catch {
      if (url) releaseImageUrls({ objectUrl: url, thumbnailUrl });
      issues.push({ name: file.name, code: "decode", reason: "We couldn't read this image. Try another file." });
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return { images, issues };
}
