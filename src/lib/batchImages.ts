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

export function validateImageFile(file: File): string | null {
  if (!Object.hasOwn(IMAGE_ACCEPT, file.type)) return "Unsupported file type. Use JPEG, PNG, or WebP.";
  if (file.size > MAX_FILE_SIZE) return `Image is too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)} MB.`;
  if (file.size === 0) return "This image file is empty. Choose another file.";
  return null;
}

async function getDimensions(file: File, url: string): Promise<{ width: number; height: number }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try { return { width: bitmap.width, height: bitmap.height }; }
      finally { bitmap.close(); }
    } catch {
      // Use the browser's image decoder when ImageBitmap cannot read this file.
    }
  }
  return new Promise((resolve, reject) => {
    const image = new Image();
    const release = () => { image.onload = null; image.onerror = null; image.removeAttribute("src"); };
    image.onload = () => {
      const dimensions = { width: image.naturalWidth, height: image.naturalHeight };
      release();
      resolve(dimensions);
    };
    image.onerror = () => { release(); reject(new Error("Image decoding failed")); };
    image.src = url;
  });
}

export type ImageImportIssue = { name: string; reason: string };
export type ImageImportResult = { images: BatchImageItem[]; issues: ImageImportIssue[] };

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
    let reason = validateImageFile(file);
    if (!reason && fingerprints.has(imageFingerprint(file))) reason = "Already in this batch.";
    if (!reason && existing.length + images.length >= MAX_BATCH_IMAGES) reason = `RatioFlow currently supports up to ${MAX_BATCH_IMAGES} images per batch.`;
    if (!reason && totalBytes + file.size > MAX_BATCH_TOTAL_BYTES) reason = `This batch would exceed the ${MAX_BATCH_TOTAL_BYTES / (1024 * 1024)} MB total size limit.`;
    if (reason) { issues.push({ name: file.name, reason }); continue; }
    let url: string | null = null;
    try {
      url = URL.createObjectURL(file);
      const { width, height } = await getDimensions(file, url);
      if (isCancelled()) { URL.revokeObjectURL(url); break; }
      if (![width, height].every((side) => Number.isSafeInteger(side) && side > 0)) throw new Error("Invalid dimensions");
      images.push({ id: createImageId(), file, objectUrl: url, name: file.name, width, height, size: file.size,
        editor: createImageEditorState(preferences, width, height) });
      fingerprints.add(imageFingerprint(file));
      totalBytes += file.size;
    } catch {
      if (url) URL.revokeObjectURL(url);
      issues.push({ name: file.name, reason: "We couldn't read this image. Try another file." });
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
  }
  return { images, issues };
}
