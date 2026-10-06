import { useEffect, useRef, useState } from "react";
import { useImageExport } from "@/hooks/useImageExport";
import { getPlatformName, getPlatformPresetById } from "@/constants/platformPresets";
import { getActiveRatio, RATIOS, type RatioId } from "@/lib/ratios";
import { useEditorStore, selectActiveEditor } from "@/store/editorStore";
import type { ExportFormat } from "@/types/editor";
import { ExportSelect, type ExportSelectOption } from "./ExportSelect";
import { OutputSizeControl } from "./OutputSizeControl";

const formats: ExportSelectOption<ExportFormat>[] = [
  { value: "png", label: "PNG", detail: "Lossless" },
  { value: "jpeg", label: "JPEG", detail: "Smaller file" },
  { value: "webp", label: "WebP", detail: "Modern compression" },
];

export function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sizeValid, setSizeValid] = useState(true);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const exportFormat = useEditorStore((state) => state.exportFormat);
  const exportQuality = useEditorStore((state) => state.exportQuality);
  const exportSize = useEditorStore((state) => state.exportSize);
  const imageCount = useEditorStore((state) => state.batchImages.length);
  const isPreparingImages = useEditorStore((state) => state.isPreparingImages);
  const ratioConfiguration = useEditorStore((state) => state.exportRatioConfiguration);
  const setExportFormat = useEditorStore((state) => state.setExportFormat);
  const setExportQuality = useEditorStore((state) => state.setExportQuality);
  const selectedExportRatios = useEditorStore((state) => state.selectedExportRatios);
  const selectedRatioId = useEditorStore((state) => selectActiveEditor(state).selectedRatioId);
  const customRatio = useEditorStore((state) => selectActiveEditor(state).customRatio);
  const activePlatformPresetId = useEditorStore((state) => selectActiveEditor(state).activePlatformPresetId);
  const toggleExportRatio = useEditorStore((state) => state.toggleExportRatio);
  const selectAllExportRatios = useEditorStore((state) => state.selectAllExportRatios);
  const clearExportRatios = useEditorStore((state) => state.clearExportRatios);
  const { downloadCurrent, downloadSelected, downloadAll, downloadBatch, isExporting, exportScope, phase, progress, announcement, status, error, clearError } = useImageExport();
  const busy = isExporting || isPreparingImages;
  const activeRatio = getActiveRatio(selectedRatioId, customRatio, activePlatformPresetId);
  const activePlatformPreset = getPlatformPresetById(activePlatformPresetId);
  const outputPreset = getPlatformPresetById(exportSize.platformPresetId ?? ratioConfiguration.platformPresetId);
  const sizeLabel = exportSize.preset === "original" ? "Original / Maximum"
    : exportSize.preset === "custom" ? `${exportSize.customSide}px ${exportSize.customAxis}${selectedExportRatios.length > 1 ? " reference · longest side per ratio" : ""}`
    : exportSize.preset === "preset" && outputPreset ? `${outputPreset.width} × ${outputPreset.height}${selectedExportRatios.length > 1 ? " reference" : ""}`
    : `${exportSize.preset}px longest side`;
  const batchCount = imageCount * selectedExportRatios.length;
  const batchVisible = exportScope === "batch";
  const dynamicIds = (["free", "custom", "platform"] as const).filter((id) => selectedRatioId === id || selectedExportRatios.includes(id));
  const exportRatios: { id: RatioId; label: string; dynamic?: boolean }[] = [
    ...RATIOS,
    ...dynamicIds.map((id) => {
      const shared = selectedExportRatios.includes(id);
      const preset = shared ? getPlatformPresetById(ratioConfiguration.platformPresetId) : activePlatformPreset;
      const ratio = shared ? getActiveRatio(id, ratioConfiguration.customRatio, ratioConfiguration.platformPresetId) : activeRatio;
      return { id, label: id === "platform" && preset
        ? `${getPlatformName(preset.platform)} · ${preset.name} (${ratio.label})`
        : id === "free" ? "Free · original image ratio" : `Custom · ${ratio.label}`, dynamic: true };
    }),
  ];

  useEffect(() => {
    if (!mounted || isOpen) return;
    const timeout = window.setTimeout(() => setMounted(false), 180);
    return () => window.clearTimeout(timeout);
  }, [mounted, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  return (
    <div
      ref={container}
      className="relative flex w-full flex-col items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="flex w-full max-w-[350px] items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col items-center">
          <button
            type="button"
            onClick={() => { clearError(); void downloadCurrent(); }}
            disabled={busy || !sizeValid}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1e1e1e] px-5 text-sm font-medium text-white shadow-[0_5px_16px_rgba(0,0,0,0.12)] transition-[background-color,transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:bg-[#383838] hover:shadow-[0_7px_18px_rgba(0,0,0,0.16)] active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:cursor-wait disabled:opacity-60 motion-reduce:transform-none motion-reduce:transition-none"
          >
            <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
              <path d="M8 2.5v8m0 0 3-3m-3 3-3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {isExporting && exportScope !== "batch" ? "Preparing image..." : "Download Image"}
          </button>
          <p role="status" aria-live="polite" className="mt-2 text-center text-xs text-[#62625e] empty:hidden">{!batchVisible && status}</p>
          <p role="alert" className="mt-2 text-center text-xs text-[#a54747] empty:hidden">{!batchVisible && error}</p>
        </div>
        <button
          ref={trigger}
          type="button"
          aria-label="Download options"
          aria-expanded={isOpen}
          aria-controls="export-options"
          onClick={() => {
            if (!batchVisible) clearError();
            setSizeValid(true);
            if (!isOpen) setMounted(true);
            setIsOpen(!isOpen);
          }}
          className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#d7d7d2] bg-white px-4 text-xs font-medium text-[#42423e] transition-colors duration-150 hover:bg-[#efefed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]"
        >
          Options
        </button>
      </div>
      {imageCount > 1 && (
        <div data-export-phase={batchVisible ? phase : "idle"} className="mt-3 flex w-full max-w-[350px] flex-col items-center">
          <button type="button" onClick={() => { clearError(); void downloadBatch(); }}
            disabled={busy || !sizeValid || selectedExportRatios.length === 0}
            className="min-h-12 w-full rounded-full border border-[#d7d7d2] bg-white px-5 text-sm font-medium text-[#343430] hover:bg-[#efefed] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">
            {isExporting && batchVisible ? phase === "zipping" ? "Creating ZIP..." : phase === "preparing" ? "Preparing batch..." : "Exporting batch..." : "Download Batch"}
          </button>
          <p className="mt-2 text-center text-[11px] text-[#777]">{imageCount} images · {selectedExportRatios.length} {selectedExportRatios.length === 1 ? "ratio" : "ratios"} · {imageCount * selectedExportRatios.length} files will be exported</p>
          <p className="mt-1 text-center text-[11px] text-[#858580]">Choose batch ratios in Options.</p>
          <p className="mt-1 text-center text-[11px] text-[#777]">{exportFormat === "webp" ? "WebP" : exportFormat.toUpperCase()}{exportFormat !== "png" ? ` · Quality ${Math.round(exportQuality * 100)}%` : " · Lossless"} · {sizeLabel}</p>
          {batchCount >= 100 && <p className="mt-1 text-center text-[11px] text-[#777]">{batchCount} files may take longer to prepare.</p>}
          {!selectedExportRatios.length && <p className="mt-1 text-xs text-[#777]">Select at least one ratio in Options.</p>}
          {!sizeValid && <p className="mt-1 text-xs text-[#777]">Enter a valid output size in Options.</p>}
          {isPreparingImages && <p className="mt-1 text-xs text-[#777]">Finish adding images before downloading.</p>}
          {batchVisible && progress && (phase === "exporting" || phase === "zipping") && (
            <div className="mt-3 w-full">
              <div role="progressbar" aria-label="Batch export progress" aria-live="off" aria-valuemin={0} aria-valuemax={progress.total} aria-valuenow={progress.completed} className="h-1.5 overflow-hidden rounded-full bg-[#e5e5e2]">
                <div className="h-full bg-[#62625e]" style={{ width: `${progress.completed / progress.total * 100}%` }} />
              </div>
            </div>
          )}
          <p aria-live="off" className="mt-2 w-full break-words text-center text-xs text-[#62625e] empty:hidden">{batchVisible && status}</p>
          <p role="status" aria-live="polite" className="sr-only">{batchVisible && announcement}</p>
          <p role="alert" className="mt-2 w-full break-words text-center text-xs text-[#a54747] empty:hidden">{batchVisible && error}</p>
          {batchVisible && phase === "error" && error && <button type="button" disabled={busy || !sizeValid || !selectedExportRatios.length} onClick={() => void downloadBatch()} className="mt-1 min-h-11 rounded-md px-4 text-xs text-[#555] underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">Retry batch</button>}
        </div>
      )}
      {mounted && (
        <div
          id="export-options"
          aria-hidden={!isOpen}
          inert={!isOpen}
          className={`order-first mb-3 w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-[#e6e6e4] bg-white p-5 text-[#242424] shadow-[0_12px_35px_rgba(0,0,0,0.12)] sm:absolute sm:bottom-full sm:left-1/2 sm:z-20 sm:mb-3 sm:-translate-x-1/2 sm:p-6 ${isOpen ? "export-panel-enter" : "export-panel-exit"}`}
        >
          <fieldset disabled={busy} className="grid gap-5 sm:grid-cols-2 sm:gap-7">
            <legend className="sr-only">Download settings and active image actions</legend>
            <div className="min-w-0">
              <ExportSelect
                id="export-format"
                label="Format"
                value={exportFormat}
                onChange={setExportFormat}
                options={formats}
              />
              {exportFormat !== "png" && (
                <div className="mt-4">
                  <label htmlFor="export-quality" className="flex justify-between text-xs font-medium">
                    <span>Quality</span><span>{Math.round(exportQuality * 100)}%</span>
                  </label>
                  <input
                    id="export-quality"
                    type="range"
                    min="40"
                    max="100"
                    step="1"
                    value={Math.round(exportQuality * 100)}
                    onChange={(event) => setExportQuality(event.currentTarget.valueAsNumber / 100)}
                    className="mt-2 w-full accent-[#242424]"
                  />
                </div>
              )}
              <OutputSizeControl onValidityChange={setSizeValid} />
            </div>
            <div className="min-w-0 sm:border-l sm:border-[#ececea] sm:pl-7">
              <fieldset>
                <legend className="sr-only">Export ratios</legend>
                <div className="flex items-center justify-between gap-2">
                  <span aria-hidden="true" className="text-xs font-medium">Export ratios</span>
                  <div className="flex items-center gap-3 text-xs">
                    <button type="button" onClick={selectAllExportRatios} className="min-h-11 rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Select all</button>
                    <button type="button" onClick={clearExportRatios} className="min-h-11 rounded-sm underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Clear</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  {exportRatios.map((ratio) => (
                    <label key={ratio.id} title={ratio.dynamic ? ratio.label : undefined} className={`flex min-h-10 cursor-pointer items-center gap-2 px-1 text-sm ${ratio.dynamic ? "col-span-2 mt-1 border-t border-[#ececea] pt-1" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedExportRatios.includes(ratio.id)}
                        onChange={() => toggleExportRatio(ratio.id)}
                        className="size-4 accent-[#242424] transition-[box-shadow] duration-150 hover:shadow-[0_0_0_4px_rgba(30,30,30,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                      />
                      <span className="min-w-0 truncate">{ratio.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="mt-3 space-y-2">
                {imageCount > 1 && <p className="text-xs text-[#777]">These actions download the active image.</p>}
                <button
                  type="button"
                  onClick={() => void downloadCurrent()}
                  disabled={busy || !sizeValid}
                  className="min-h-11 w-full rounded-full bg-[#1e1e1e] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#383838] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                >
                  {isExporting ? "Exporting..." : "Download Current"}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadSelected()}
                  disabled={busy || !sizeValid || selectedExportRatios.length === 0}
                  className="min-h-11 w-full rounded-full border border-[#dededb] px-4 text-sm font-medium transition-colors duration-150 hover:bg-[#f5f5f3] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                >
                  Download Selected
                </button>
                <button
                  type="button"
                  onClick={() => void downloadAll()}
                  disabled={busy || !sizeValid}
                  className="min-h-11 w-full rounded-full border border-[#dededb] px-4 text-sm font-medium transition-colors duration-150 hover:bg-[#f5f5f3] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                >
                  {imageCount > 1 ? "Download All Ratios" : "Download All"}
                </button>
              </div>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}
