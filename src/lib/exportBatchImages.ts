import { exportMultiple } from "./exportMultiple.ts";
import { createBatchImageFolderNames, uniqueExportName } from "./fileName.ts";
import { getPlatformPresetById } from "../constants/platformPresets.ts";
import { requestedLongestSide } from "./exportDimensions.ts";
import { getActiveRatio } from "./ratios.ts";
import type { BatchImageItem, EditorState, ExportOptions, ExportRatioConfiguration, ExportSize } from "../types/editor.ts";
import type { RatioId } from "./ratios.ts";

export type BatchExportSnapshot = {
  images: BatchImageItem[];
  ratioIds: RatioId[];
  options: ExportOptions;
  exportSize: ExportSize;
  ratioConfiguration: ExportRatioConfiguration;
};

export type BatchExportProgress = {
  phase: "exporting" | "zip";
  completed: number;
  total: number;
  imageIndex: number;
  imageCount: number;
};

export function snapshotBatchExport(state: EditorState): BatchExportSnapshot {
  return {
    images: state.batchImages.map((image) => ({ ...image, editor: { ...image.editor,
      customRatio: { ...image.editor.customRatio }, crop: { ...image.editor.crop },
      focalPoint: { ...image.editor.focalPoint }, lastFillCrop: { ...image.editor.lastFillCrop } } })),
    ratioIds: [...state.selectedExportRatios],
    options: { format: state.exportFormat, quality: state.exportQuality },
    exportSize: { ...state.exportSize },
    ratioConfiguration: { customRatio: { ...state.exportRatioConfiguration.customRatio },
      platformPresetId: state.exportRatioConfiguration.platformPresetId },
  };
}

/** Orchestration only: every output still uses the shared original-image export engine. */
export async function exportBatchImages(snapshot: BatchExportSnapshot, onProgress?: (progress: BatchExportProgress) => void): Promise<Blob> {
  if (!snapshot.images.length || !snapshot.ratioIds.length) throw new Error("Select images and at least one export ratio.");
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const folders = createBatchImageFolderNames(snapshot.images.map((image) => image.name));
  const total = snapshot.images.length * snapshot.ratioIds.length;
  let completed = 0;
  for (const [imageIndex, image] of snapshot.images.entries()) {
    const usedNames = new Set<string>();
    const progress = { completed, total, imageIndex: imageIndex + 1, imageCount: snapshot.images.length };
    for (const ratioId of snapshot.ratioIds) {
      onProgress?.({ ...progress, phase: "exporting", completed });
      try {
        const presetDimensions = getPlatformPresetById(snapshot.exportSize.platformPresetId ?? snapshot.ratioConfiguration.platformPresetId);
        // Preserve the existing multi-ratio sizing rule for each photo's editor ratio.
        const longestSideOverride = snapshot.ratioIds.length > 1 && (snapshot.exportSize.preset === "custom" || snapshot.exportSize.preset === "preset")
          ? requestedLongestSide(getActiveRatio(image.editor.selectedRatioId, image.editor.customRatio, image.editor.activePlatformPresetId), snapshot.exportSize, presetDimensions) ?? undefined
          : undefined;
        const [file] = await exportMultiple({
          file: image.file, imageWidth: image.width, imageHeight: image.height, imageName: image.name,
          focalPoint: image.editor.focalPoint, zoom: image.editor.zoom, viewMode: image.editor.viewMode,
          options: snapshot.options, exportSize: snapshot.exportSize,
          customRatio: snapshot.ratioConfiguration.customRatio,
          platformPresetId: snapshot.ratioConfiguration.platformPresetId ?? undefined,
          presetDimensions, longestSideOverride,
          currentRatio: image.editor.selectedRatioId, multiRatio: snapshot.ratioIds.length > 1,
        }, [ratioId]);
        const name = uniqueExportName(file.name, usedNames, true);
        zip.file(`${folders[imageIndex]}/${name}`, file.blob);
      } catch {
        throw new Error(`Batch export stopped because "${image.name}" couldn't be processed. Remove it or retry.`);
      }
      completed += 1;
      onProgress?.({ ...progress, phase: "exporting", completed });
    }
  }
  onProgress?.({ phase: "zip", completed, total, imageIndex: snapshot.images.length, imageCount: snapshot.images.length });
  try {
    return await zip.generateAsync({ type: "blob", compression: "STORE" });
  } catch {
    throw new Error("Could not create the batch ZIP. Please try again.");
  }
}
