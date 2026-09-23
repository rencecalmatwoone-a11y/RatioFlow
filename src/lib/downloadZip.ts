import { downloadFile } from "./downloadFile.ts";
import type { GeneratedExport } from "@/lib/exportMultiple";

export async function downloadZip(files: readonly GeneratedExport[], filename: string): Promise<void> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file.blob);
  const blob = await zip.generateAsync({ type: "blob" });
  downloadFile(blob, filename);
}
