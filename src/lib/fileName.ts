import type { RatioId } from "@/lib/ratios";
import type { ExportFormat } from "@/types/editor";

export const EXPORT_FORMATS: Record<ExportFormat, { mime: string; extension: string }> = {
  png: { mime: "image/png", extension: "png" },
  jpeg: { mime: "image/jpeg", extension: "jpg" },
  webp: { mime: "image/webp", extension: "webp" },
};

export function exportBaseName(imageName: string): string {
  let base = imageName
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .trim()
    .replace(/[. ]+$/, "") || "image";
  // Bound UTF-8 bytes as well as characters; common ZIP extractors limit path components to 255 bytes.
  let bytes = 0;
  const encoder = new TextEncoder();
  base = Array.from(base).filter((character) => {
    bytes += encoder.encode(character).length;
    return bytes <= 100;
  }).join("").replace(/[. ]+$/, "") || "image";
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(base) ? `image-${base}` : base;
}

/** Case-insensitive uniqueness also keeps ZIP extraction safe on Windows/macOS. */
export function uniqueExportName(name: string, used: Set<string>, isFile = false): string {
  const dot = isFile ? name.lastIndexOf(".") : -1;
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const extension = dot > 0 ? name.slice(dot) : "";
  let result = name;
  let suffix = 2;
  while (used.has(result.toLowerCase())) result = `${stem}-${suffix++}${extension}`;
  used.add(result.toLowerCase());
  return result;
}

export function createBatchImageFolderNames(imageNames: readonly string[]): string[] {
  const used = new Set<string>();
  return imageNames.map((name) => {
    return uniqueExportName(exportBaseName(name), used);
  });
}

export function exportFilename(imageName: string, ratioId: RatioId, format: ExportFormat, customLabel?: string, platformPresetId?: string): string {
  const label = ratioId === "platform" ? (platformPresetId ?? "platform") : ratioId === "custom" ? (customLabel ?? "custom") : ratioId;
  const safeLabel = label.toLowerCase().replace(/:/g, "x").replace(/[^a-z0-9.-]+/g, "-").slice(0, 80).replace(/^[.-]+|[.-]+$/g, "") || "image";
  return `${exportBaseName(imageName)}-${safeLabel}.${EXPORT_FORMATS[format].extension}`;
}

export function exportZipFilename(imageName: string): string {
  return `${exportBaseName(imageName)}-ratioflow.zip`;
}
