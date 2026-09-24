import { useEffect, useRef, useState } from "react";
import { downloadFile } from "@/lib/downloadFile";
import { downloadZip } from "@/lib/downloadZip";
import { exportMultiple } from "@/lib/exportMultiple";
import { exportZipFilename } from "@/lib/fileName";
import { RATIOS, type RatioId } from "@/lib/ratios";
import { getPlatformPresetById } from "@/constants/platformPresets";
import { useEditorStore } from "@/store/editorStore";

export function useImageExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inProgress = useRef(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
  }, []);

  async function runExport(ratioIds: readonly RatioId[], currentOnly: boolean) {
    if (inProgress.current) return;
    const state = useEditorStore.getState();
    if (!state.imageFile || !state.imageWidth || !state.imageHeight || !state.imageName) {
      setError("Choose an image before exporting.");
      return;
    }
    if (ratioIds.length === 0) {
      setError("Select at least one ratio.");
      return;
    }

    inProgress.current = true;
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
    setIsExporting(true);
    setError(null);
    setStatus(ratioIds.length === 1 ? "Exporting..." : `Exporting 1 of ${ratioIds.length}...`);
    const source = {
      file: state.imageFile,
      imageWidth: state.imageWidth,
      imageHeight: state.imageHeight,
      imageName: state.imageName,
      focalPoint: state.focalPoint,
      zoom: state.zoom,
      viewMode: state.viewMode,
      options: { format: state.exportFormat, quality: state.exportQuality },
      exportSize: state.exportSize,
      presetDimensions: getPlatformPresetById(state.activePlatformPresetId),
      platformPresetId: state.activePlatformPresetId ?? undefined,
      customRatio: state.customRatio,
      currentRatio: state.selectedRatioId,
      multiRatio: !currentOnly && ratioIds.length > 1,
    };

    let downloaded = false;
    try {
      let files;
      try {
        files = await exportMultiple(source, ratioIds, (current, total) => {
          setStatus(total === 1 ? "Exporting..." : `Exporting ${current} of ${total}...`);
        });
      } catch {
        setError(currentOnly ? "Could not export this image. Please try again." : "Could not export all selected ratios. Please try again.");
        return;
      }

      if (files.length === 1) {
        try {
          downloadFile(files[0].blob, files[0].name);
          downloaded = true;
          setStatus("Downloaded");
        } catch {
          setError("Could not download this image. Please try again.");
        }
      } else {
        setStatus("Creating ZIP...");
        try {
          await downloadZip(files, exportZipFilename(source.imageName));
          downloaded = true;
          setStatus("Downloaded");
        } catch {
          setError("Could not create the ZIP file. Please try again.");
        }
      }
    } catch {
      setError("Could not export this image. Please try again.");
    } finally {
      inProgress.current = false;
      setIsExporting(false);
      if (downloaded) feedbackTimer.current = setTimeout(() => setStatus(null), 3000);
      else setStatus(null);
    }
  }

  return {
    downloadCurrent: () => runExport([useEditorStore.getState().selectedRatioId], true),
    downloadSelected: () => runExport([...useEditorStore.getState().selectedExportRatios], false),
    downloadAll: () => {
      const current = useEditorStore.getState().selectedRatioId;
      const ratioIds: RatioId[] = RATIOS.map((ratio) => ratio.id);
      if (current === "custom" || current === "platform") ratioIds.push(current);
      return runExport(ratioIds, false);
    },
    isExporting,
    status,
    error,
    clearError: () => setError(null),
  };
}
