import { useEffect, useRef, useState } from "react";
import { downloadFile } from "@/lib/downloadFile";
import { downloadZip } from "@/lib/downloadZip";
import { exportMultiple } from "@/lib/exportMultiple";
import { exportBatchImages, snapshotBatchExport, type BatchExportProgress } from "@/lib/exportBatchImages";
import { exportZipFilename } from "@/lib/fileName";
import { getActiveRatio, RATIOS, type RatioId } from "@/lib/ratios";
import { requestedLongestSide } from "@/lib/exportDimensions";
import { getPlatformPresetById } from "@/constants/platformPresets";
import { selectActiveImage, useEditorStore } from "@/store/editorStore";

type ExportScope = "current" | "selected" | "all" | "batch";
export type ExportPhase = "idle" | "preparing" | "exporting" | "zipping" | "success" | "error";

export function useImageExport() {
  const isExporting = useEditorStore((state) => state.isExporting);
  const [exportScope, setExportScope] = useState<ExportScope | null>(null);
  const [phase, setPhase] = useState<ExportPhase>("idle");
  const [progress, setProgress] = useState<BatchExportProgress | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
    };
  }, []);

  async function runExport(scope: ExportScope) {
    const state = useEditorStore.getState();
    if (state.isExporting || state.isPreparingImages) return;
    const image = selectActiveImage(state);
    if (!image) { setError("Choose an image before exporting."); return; }
    const editor = image.editor;
    const ratioIds: RatioId[] = scope === "current" ? [editor.selectedRatioId]
      : scope === "all" ? [...RATIOS.map((ratio) => ratio.id),
        ...(["free", "custom", "platform"].includes(editor.selectedRatioId) ? [editor.selectedRatioId] : [])]
      : [...state.selectedExportRatios];
    if (!ratioIds.length) { setError("Select at least one ratio."); return; }

    state.setIsExporting(true);
    if (feedbackTimer.current !== null) clearTimeout(feedbackTimer.current);
    setExportScope(scope);
    setPhase("preparing");
    setProgress(null);
    setAnnouncement(scope === "batch" ? "Preparing batch." : "Preparing image.");
    setError(null);
    setStatus(scope === "batch" ? "Preparing batch..." : "Exporting...");
    let downloaded = false;
    let fileCount = ratioIds.length;
    try {
      if (scope === "batch") {
        const snapshot = snapshotBatchExport(state);
        fileCount = snapshot.images.length * snapshot.ratioIds.length;
        let announcedBucket = -1;
        const blob = await exportBatchImages(snapshot, (progress) => {
          if (!mounted.current) return;
          setPhase(progress.phase);
          setProgress(progress);
          const message = progress.phase === "zipping" ? `Creating ZIP · ${progress.completed} of ${progress.total} files.`
            : `Exporting ${progress.completed} of ${progress.total} · Image ${progress.imageIndex} of ${progress.imageCount} · ${progress.imageName} · ${progress.ratioLabel}`;
          setStatus(message);
          const bucket = Math.floor(progress.completed / progress.total * 10);
          // Announce phase changes and completed 10% steps, rather than every render or percentage point.
          if (progress.phase === "zipping" || bucket > announcedBucket) {
            announcedBucket = bucket;
            setAnnouncement(message);
          }
        });
        downloadFile(blob, "ratioflow-batch-export.zip");
      } else {
        if (mounted.current) setPhase("exporting");
        const config = scope === "selected"
          ? state.exportRatioConfiguration : { customRatio: editor.customRatio, platformPresetId: editor.activePlatformPresetId };
        const presetDimensions = getPlatformPresetById(state.exportSize.preset === "preset"
          ? state.exportSize.platformPresetId ?? state.exportRatioConfiguration.platformPresetId : config.platformPresetId);
        const longestSideOverride = scope !== "current" && ratioIds.length > 1 && (state.exportSize.preset === "custom" || state.exportSize.preset === "preset")
          ? requestedLongestSide(getActiveRatio(editor.selectedRatioId, editor.customRatio, editor.activePlatformPresetId), state.exportSize, presetDimensions) ?? undefined
          : undefined;
        const files = await exportMultiple({
          file: image.file, imageWidth: image.width, imageHeight: image.height, imageName: image.name,
          focalPoint: { ...editor.focalPoint }, zoom: editor.zoom, viewMode: editor.viewMode,
          options: { format: state.exportFormat, quality: state.exportQuality }, exportSize: { ...state.exportSize },
          presetDimensions, longestSideOverride, platformPresetId: config.platformPresetId ?? undefined,
          customRatio: { ...config.customRatio }, currentRatio: editor.selectedRatioId, multiRatio: scope !== "current" && ratioIds.length > 1,
        }, ratioIds, (current, total) => {
          if (mounted.current) setStatus(total === 1 ? "Exporting..." : `Exporting ${current} of ${total}...`);
        });
        if (files.length === 1) downloadFile(files[0].blob, files[0].name);
        else {
          if (mounted.current) { setStatus("Creating ZIP..."); setPhase("zipping"); }
          await downloadZip(files, exportZipFilename(image.name));
        }
      }
      downloaded = true;
      if (mounted.current) {
        const message = scope === "batch" ? `${fileCount} files downloaded.` : "Downloaded";
        setPhase("success"); setStatus(message); setAnnouncement(message);
      }
    } catch (failure) {
      if (mounted.current) {
        setPhase("error");
        const message = scope === "batch" && failure instanceof Error
          ? failure.message : "Could not export this image. Please try again.";
        setError(message); setAnnouncement("");
      }
    } finally {
      useEditorStore.getState().setIsExporting(false);
      if (mounted.current) {
        if (!downloaded) setStatus(null);
        else if (scope !== "batch") feedbackTimer.current = setTimeout(() => { setStatus(null); setPhase("idle"); }, 3000);
      }
    }
  }

  return {
    downloadCurrent: () => runExport("current"), downloadSelected: () => runExport("selected"),
    downloadAll: () => runExport("all"), downloadBatch: () => runExport("batch"),
    isExporting, exportScope, phase, progress, announcement, status, error, clearError: () => setError(null),
  };
}
