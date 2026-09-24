import { useEffect, useRef, useState } from "react";
import { useImageExport } from "@/hooks/useImageExport";
import { getPlatformName, getPlatformPresetById } from "@/constants/platformPresets";
import { getActiveRatio, RATIOS, type RatioId } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";
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
  const setExportFormat = useEditorStore((state) => state.setExportFormat);
  const setExportQuality = useEditorStore((state) => state.setExportQuality);
  const selectedExportRatios = useEditorStore((state) => state.selectedExportRatios);
  const selectedRatioId = useEditorStore((state) => state.selectedRatioId);
  const customRatio = useEditorStore((state) => state.customRatio);
  const activePlatformPresetId = useEditorStore((state) => state.activePlatformPresetId);
  const toggleExportRatio = useEditorStore((state) => state.toggleExportRatio);
  const selectAllExportRatios = useEditorStore((state) => state.selectAllExportRatios);
  const clearExportRatios = useEditorStore((state) => state.clearExportRatios);
  const { downloadCurrent, downloadSelected, downloadAll, isExporting, status, error, clearError } = useImageExport();
  const activeRatio = getActiveRatio(selectedRatioId, customRatio, activePlatformPresetId);
  const activePlatformPreset = getPlatformPresetById(activePlatformPresetId);
  const exportRatios: { id: RatioId; label: string; dynamic?: boolean }[] = [
    ...RATIOS,
    ...(selectedRatioId === "custom" || selectedRatioId === "platform" ? [{
      id: selectedRatioId,
      label: selectedRatioId === "platform" && activePlatformPreset
        ? `${getPlatformName(activePlatformPreset.platform)} · ${activePlatformPreset.name} (${activeRatio.label})`
        : `Custom · ${activeRatio.label}`,
      dynamic: true,
    }] : []),
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
      className="relative flex flex-col items-center"
      onKeyDown={(event) => {
        if (event.key === "Escape" && isOpen) {
          setIsOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={isOpen}
        aria-controls="export-options"
        onClick={() => {
          if (!isOpen) { clearError(); setSizeValid(true); }
          if (!isOpen) setMounted(true);
          setIsOpen(!isOpen);
        }}
        className="inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#1e1e1e] px-5 text-[13px] font-medium text-white transition-colors duration-150 hover:bg-[#383838] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
      >
        Export
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
          <path d="M8 2.5v8m0 0 3-3m-3 3-3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {mounted && (
        <div
          id="export-options"
          aria-hidden={!isOpen}
          inert={!isOpen}
          className={`order-first mb-3 w-[min(40rem,calc(100vw-2rem))] rounded-2xl border border-[#e6e6e4] bg-white p-5 text-[#242424] shadow-[0_12px_35px_rgba(0,0,0,0.12)] sm:absolute sm:bottom-full sm:left-1/2 sm:z-20 sm:mb-3 sm:-translate-x-1/2 sm:p-6 ${isOpen ? "export-panel-enter" : "export-panel-exit"}`}
        >
          <div className="grid gap-5 sm:grid-cols-2 sm:gap-7">
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
                <button
                  type="button"
                  onClick={() => void downloadCurrent()}
                  disabled={isExporting || !sizeValid}
                  className="min-h-11 w-full rounded-full bg-[#1e1e1e] px-4 text-sm font-medium text-white transition-colors duration-150 hover:bg-[#383838] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                >
                  {isExporting ? "Exporting..." : "Download Current"}
                </button>
                <button
                  type="button"
                  onClick={() => void downloadSelected()}
                  disabled={isExporting || !sizeValid || selectedExportRatios.length === 0}
                  className="min-h-11 w-full rounded-full border border-[#dededb] px-4 text-sm font-medium transition-colors duration-150 hover:bg-[#f5f5f3] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                >
                  Download Selected
                </button>
                <button
                  type="button"
                  onClick={() => void downloadAll()}
                  disabled={isExporting || !sizeValid}
                  className="min-h-11 w-full rounded-full border border-[#dededb] px-4 text-sm font-medium transition-colors duration-150 hover:bg-[#f5f5f3] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none"
                >
                  Download All
                </button>
              </div>
              <p aria-live="polite" className="mt-2 text-xs text-[#62625e] empty:hidden">{status}</p>
              <p aria-live="polite" className="mt-2 text-xs text-[#a54747] empty:hidden">{error}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
