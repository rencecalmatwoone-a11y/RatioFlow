import { EXPORT_FORMATS } from "./fileName.ts";
export { exportFilename, EXPORT_FORMATS } from "./fileName.ts";
import type { AspectRatio, ExportOptions, FocalPoint, ViewMode } from "@/types/editor";
import type { ExportSize } from "@/types/editor";
import { calculateOutputDimensions } from "./exportDimensions.ts";

export { MAX_EXPORT_DIMENSION, MAX_EXPORT_PIXELS } from "./exportDimensions.ts";

export type ExportGeometry = {
  sourceX: number;
  sourceY: number;
  sourceWidth: number;
  sourceHeight: number;
  outputWidth: number;
  outputHeight: number;
  destinationX: number;
  destinationY: number;
  destinationWidth: number;
  destinationHeight: number;
};

export type ImageExportInput = {
  file: File;
  imageWidth: number;
  imageHeight: number;
  ratio: AspectRatio;
  focalPoint: FocalPoint;
  zoom: number;
  viewMode: ViewMode;
  options: ExportOptions;
  exportSize?: ExportSize;
  presetDimensions?: AspectRatio;
  longestSideOverride?: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** Geometry is expressed in original-image pixels, independent of preview size. */
export function calculateExportGeometry(
  imageWidth: number,
  imageHeight: number,
  ratio: AspectRatio,
  focalPoint: FocalPoint,
  zoom: number,
  viewMode: ViewMode,
  exportSize?: ExportSize,
  longestSideOverride?: number,
  presetDimensions?: AspectRatio,
): ExportGeometry {
  if (![imageWidth, imageHeight, ratio.width, ratio.height, zoom].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Invalid export dimensions");
  }

  const baseScale = Math.min(imageWidth / ratio.width, imageHeight / ratio.height);
  const sourceScale = viewMode === "fill" ? baseScale / zoom : baseScale;
  const sourceWidth = viewMode === "fill" ? sourceScale * ratio.width : imageWidth;
  const sourceHeight = viewMode === "fill" ? sourceScale * ratio.height : imageHeight;
  const { width: outputWidth, height: outputHeight } = calculateOutputDimensions(sourceScale, ratio, exportSize, longestSideOverride, presetDimensions);
  const sourceX = viewMode === "fill"
    ? clamp((Number.isFinite(focalPoint.x) ? focalPoint.x : 0.5) * imageWidth - sourceWidth / 2, 0, imageWidth - sourceWidth)
    : 0;
  const sourceY = viewMode === "fill"
    ? clamp((Number.isFinite(focalPoint.y) ? focalPoint.y : 0.5) * imageHeight - sourceHeight / 2, 0, imageHeight - sourceHeight)
    : 0;

  if (viewMode === "fill") {
    return {
      sourceX, sourceY, sourceWidth, sourceHeight, outputWidth, outputHeight,
      destinationX: 0, destinationY: 0,
      destinationWidth: outputWidth, destinationHeight: outputHeight,
    };
  }

  const fittedScale = Math.min(outputWidth / imageWidth, outputHeight / imageHeight);
  const destinationWidth = imageWidth * fittedScale;
  const destinationHeight = imageHeight * fittedScale;
  return {
    sourceX, sourceY, sourceWidth, sourceHeight, outputWidth, outputHeight,
    destinationX: (outputWidth - destinationWidth) / 2,
    destinationY: (outputHeight - destinationHeight) / 2,
    destinationWidth, destinationHeight,
  };
}

async function decodeOriginal(file: File): Promise<{ image: CanvasImageSource; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { image: bitmap, close: () => bitmap.close() };
    } catch {
      // HTMLImageElement supports browsers where ImageBitmap decoding is unavailable.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Image decoding failed"));
      element.src = url;
    });
    return { image, close: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

export async function exportImage(input: ImageExportInput): Promise<Blob> {
  const geometry = calculateExportGeometry(
    input.imageWidth, input.imageHeight, input.ratio, input.focalPoint, input.zoom, input.viewMode, input.exportSize, input.longestSideOverride, input.presetDimensions,
  );
  const { mime } = EXPORT_FORMATS[input.options.format];
  const decoded = await decodeOriginal(input.file);
  let canvas: HTMLCanvasElement | null = null;

  try {
    canvas = document.createElement("canvas");
    canvas.width = geometry.outputWidth;
    canvas.height = geometry.outputHeight;
    if (canvas.width !== geometry.outputWidth || canvas.height !== geometry.outputHeight) {
      throw new Error("Canvas dimensions are unsupported");
    }
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas context unavailable");
    if (input.options.format === "jpeg") {
      context.fillStyle = "#FFFFFF";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.imageSmoothingQuality = "high";
    context.drawImage(
      decoded.image,
      geometry.sourceX, geometry.sourceY, geometry.sourceWidth, geometry.sourceHeight,
      geometry.destinationX, geometry.destinationY, geometry.destinationWidth, geometry.destinationHeight,
    );
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas!.toBlob((result) => result ? resolve(result) : reject(new Error("Image encoding failed")),
        mime, input.options.format === "png" ? undefined : input.options.quality);
    });
    if (blob.type.toLowerCase() !== mime) throw new Error(`${input.options.format.toUpperCase()} encoding is unsupported`);
    return blob;
  } finally {
    if (canvas) {
      canvas.width = 0;
      canvas.height = 0;
    }
    decoded.close();
  }
}
