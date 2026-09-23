import { exportImage, type ImageExportInput } from "./exportImage.ts";
import { exportFilename } from "./fileName.ts";
import { getRatioPreset, type RatioPresetId } from "./ratios.ts";

export type GeneratedExport = { name: string; blob: Blob };

export async function exportMultiple(
  input: Omit<ImageExportInput, "ratio"> & { imageName: string },
  ratioIds: readonly RatioPresetId[],
  onProgress?: (current: number, total: number) => void,
): Promise<GeneratedExport[]> {
  const files: GeneratedExport[] = [];
  const { imageName, ...source } = input;

  for (const [index, ratioId] of ratioIds.entries()) {
    onProgress?.(index + 1, ratioIds.length);
    // Give the browser a chance to paint progress before decoding and drawing.
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    const blob = await exportImage({ ...source, ratio: getRatioPreset(ratioId) });
    files.push({ name: exportFilename(imageName, ratioId, source.options.format), blob });
  }

  return files;
}
