import { exportImage, type ImageExportInput } from "./exportImage.ts";
import { exportFilename } from "./fileName.ts";
import { DEFAULT_CUSTOM_RATIO, getActiveRatio, type CustomRatio, type RatioId } from "./ratios.ts";
import { requestedLongestSide } from "./exportDimensions.ts";

export type GeneratedExport = { name: string; blob: Blob };

export async function exportMultiple(
  input: Omit<ImageExportInput, "ratio"> & { imageName: string; customRatio?: CustomRatio; multiRatio?: boolean; currentRatio?: RatioId; platformPresetId?: string },
  ratioIds: readonly RatioId[],
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedExport[]> {
  const files: GeneratedExport[] = [];
  const { imageName, customRatio = DEFAULT_CUSTOM_RATIO, multiRatio, currentRatio, platformPresetId, ...source } = input;
  const longestSideOverride = multiRatio && (source.exportSize?.preset === "custom" || source.exportSize?.preset === "preset")
    ? requestedLongestSide(getActiveRatio(currentRatio ?? ratioIds[0], customRatio, platformPresetId ?? null), source.exportSize, source.presetDimensions) ?? undefined
    : undefined;

  for (const [index, ratioId] of ratioIds.entries()) {
    onProgress?.(index + 1, ratioIds.length);
    // Give the browser a chance to paint progress before decoding and drawing.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const ratio = getActiveRatio(ratioId, customRatio, platformPresetId ?? null);
    const blob = await exportImage({ ...source, ratio, longestSideOverride });
    files.push({ name: exportFilename(imageName, ratioId, source.options.format, ratio.label, platformPresetId), blob });
  }

  return files;
}
