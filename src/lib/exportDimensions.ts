import type { AspectRatio, ExportSize } from "../types/editor.ts";

export const MIN_OUTPUT_DIMENSION = 16;
export const MAX_EXPORT_DIMENSION = 8192;
export const MAX_EXPORT_PIXELS = 32_000_000;

export function isValidOutputInput(value: number): boolean {
  return Number.isInteger(value) && value >= MIN_OUTPUT_DIMENSION && value <= MAX_EXPORT_DIMENSION;
}

export function parseOutputInput(value: string): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value);
  return isValidOutputInput(parsed) ? parsed : null;
}

export function dimensionsFromSide(ratio: AspectRatio, side: number, axis: "width" | "height") {
  return axis === "width"
    ? { width: side, height: Math.max(1, Math.round(side * ratio.height / ratio.width)) }
    : { width: Math.max(1, Math.round(side * ratio.width / ratio.height)), height: side };
}

export function requestedLongestSide(ratio: AspectRatio, size: ExportSize): number | null {
  if (size.preset === "original") return null;
  if (size.preset !== "custom") return Number(size.preset);
  if (!isValidOutputInput(size.customSide)) throw new Error("Invalid custom output size");
  const dimensions = dimensionsFromSide(ratio, size.customSide, size.customAxis);
  return Math.max(dimensions.width, dimensions.height);
}

/** Uses Math.round for the secondary side; never rounds the longest side above the source crop. */
export function calculateOutputDimensions(
  sourceScale: number,
  ratio: AspectRatio,
  size: ExportSize = { preset: "original", customSide: 1920, customAxis: "width" },
  longestSideOverride?: number,
) {
  if (![sourceScale, ratio.width, ratio.height].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid export dimensions");
  }
  if (sourceScale * Math.min(ratio.width, ratio.height) < 1) {
    throw new Error("Image is too small for this ratio");
  }
  const longest = Math.max(ratio.width, ratio.height);
  const maximum = Math.floor(Math.min(
    sourceScale * longest,
    MAX_EXPORT_DIMENSION,
    Math.sqrt(MAX_EXPORT_PIXELS * longest / Math.min(ratio.width, ratio.height)),
  ));
  const requested = longestSideOverride ?? requestedLongestSide(ratio, size);
  if (requested !== null && (!Number.isFinite(requested) || requested <= 0)) throw new Error("Invalid output size");

  // Keep exact integer preset dimensions for the existing Original export path.
  if (requested === null && Number.isInteger(ratio.width) && Number.isInteger(ratio.height)) {
    const scale = Math.floor(Math.min(
      sourceScale,
      MAX_EXPORT_DIMENSION / longest,
      Math.sqrt(MAX_EXPORT_PIXELS / (ratio.width * ratio.height)),
    ));
    if (scale >= 1) return { width: scale * ratio.width, height: scale * ratio.height, limited: false };
  }

  let outputLongest = Math.floor(Math.min(maximum, requested ?? maximum));
  if (outputLongest < 1) throw new Error("Image is too small for this ratio");
  const sourceShort = Math.floor(sourceScale * Math.min(ratio.width, ratio.height));
  let short = Math.max(1, Math.min(Math.round(outputLongest * Math.min(ratio.width, ratio.height) / longest), sourceShort));
  while (outputLongest * short > MAX_EXPORT_PIXELS) {
    outputLongest -= 1;
    if (outputLongest < 1) throw new Error("Image is too small for this ratio");
    short = Math.max(1, Math.min(Math.round(outputLongest * Math.min(ratio.width, ratio.height) / longest), sourceShort));
  }
  return ratio.width >= ratio.height
    ? { width: outputLongest, height: short, limited: requested !== null && requested > outputLongest }
    : { width: short, height: outputLongest, limited: requested !== null && requested > outputLongest };
}
