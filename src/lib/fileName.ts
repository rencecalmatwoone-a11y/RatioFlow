import type { RatioId } from "@/lib/ratios";
import type { ExportFormat } from "@/types/editor";

export const EXPORT_FORMATS: Record<ExportFormat, { mime: string; extension: string }> = {
  png: { mime: "image/png", extension: "png" },
  jpeg: { mime: "image/jpeg", extension: "jpg" },
  webp: { mime: "image/webp", extension: "webp" },
};

function exportBaseName(imageName: string): string {
  return imageName
    .replace(/\.[^.]+$/, "")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
    .trim()
    .replace(/[. ]+$/, "") || "image";
}

export function exportFilename(imageName: string, ratioId: RatioId, format: ExportFormat, customLabel?: string): string {
  const label = ratioId === "custom" ? (customLabel ?? "custom") : ratioId;
  return `${exportBaseName(imageName)}-${label.replace(":", "x")}.${EXPORT_FORMATS[format].extension}`;
}

export function exportZipFilename(imageName: string): string {
  return `${exportBaseName(imageName)}-ratioflow.zip`;
}
