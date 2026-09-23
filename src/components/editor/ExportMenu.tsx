import { useEffect, useRef, useState } from "react";
import { useImageExport } from "@/hooks/useImageExport";
import { useEditorStore } from "@/store/editorStore";
import type { ExportFormat } from "@/types/editor";

const formats: { value: ExportFormat; label: string }[] = [
  { value: "png", label: "PNG" },
  { value: "jpeg", label: "JPEG" },
  { value: "webp", label: "WebP" },
];

export function ExportMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const exportFormat = useEditorStore((state) => state.exportFormat);
  const exportQuality = useEditorStore((state) => state.exportQuality);
  const setExportFormat = useEditorStore((state) => state.setExportFormat);
  const setExportQuality = useEditorStore((state) => state.setExportQuality);
  const { downloadCurrent, isExporting, error, clearError } = useImageExport();

  useEffect(() => {
    if (!isOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [isOpen]);

  return (
    <div ref={container} className="relative">
      <button
        ref={trigger}
        type="button"
        aria-expanded={isOpen}
        aria-controls="export-options"
        onClick={() => {
          if (!isOpen) clearError();
          setIsOpen(!isOpen);
        }}
        className="inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#1e1e1e] px-5 text-[13px] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]"
      >
        Export
        <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
          <path d="M8 2.5v8m0 0 3-3m-3 3-3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {isOpen && (
        <div
          id="export-options"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setIsOpen(false);
              trigger.current?.focus();
            }
          }}
          className="absolute bottom-full left-1/2 z-20 mb-3 w-64 -translate-x-1/2 rounded-2xl border border-[#e6e6e4] bg-white p-4 text-[#242424] shadow-[0_12px_35px_rgba(0,0,0,0.12)]"
        >
          <label htmlFor="export-format" className="mb-2 block text-xs font-medium">Format</label>
          <select
            id="export-format"
            value={exportFormat}
            onChange={(event) => setExportFormat(event.currentTarget.value as ExportFormat)}
            className="min-h-11 w-full rounded-lg border border-[#dededb] bg-white px-3 text-sm focus-visible:outline-2 focus-visible:outline-[#181818]"
          >
            {formats.map((format) => <option key={format.value} value={format.value}>{format.label}</option>)}
          </select>
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
          <button
            type="button"
            onClick={() => void downloadCurrent()}
            disabled={isExporting}
            aria-busy={isExporting}
            className="mt-4 min-h-11 w-full rounded-full bg-[#1e1e1e] px-4 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]"
          >
            {isExporting ? "Exporting..." : "Download Current"}
          </button>
          <p aria-live="polite" className="mt-2 text-xs text-[#a54747] empty:hidden">{error}</p>
        </div>
      )}
    </div>
  );
}
