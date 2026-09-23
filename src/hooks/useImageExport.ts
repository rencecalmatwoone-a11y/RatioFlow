import { useRef, useState } from "react";
import { downloadFile } from "@/lib/downloadFile";
import { exportFilename, exportImage } from "@/lib/exportImage";
import { getRatioPreset } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";

export function useImageExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inProgress = useRef(false);

  async function downloadCurrent() {
    if (inProgress.current) return;
    const state = useEditorStore.getState();
    if (!state.imageFile || !state.imageWidth || !state.imageHeight || !state.imageName) {
      setError("Choose an image before exporting.");
      return;
    }

    inProgress.current = true;
    setIsExporting(true);
    setError(null);
    try {
      const blob = await exportImage({
        file: state.imageFile,
        imageWidth: state.imageWidth,
        imageHeight: state.imageHeight,
        ratio: getRatioPreset(state.selectedRatioId),
        focalPoint: state.focalPoint,
        zoom: state.zoom,
        viewMode: state.viewMode,
        options: { format: state.exportFormat, quality: state.exportQuality },
      });
      downloadFile(blob, exportFilename(state.imageName, state.selectedRatioId, state.exportFormat));
    } catch {
      setError("Could not export this image. Please try again.");
    } finally {
      inProgress.current = false;
      setIsExporting(false);
    }
  }

  return { downloadCurrent, isExporting, error, clearError: () => setError(null) };
}
