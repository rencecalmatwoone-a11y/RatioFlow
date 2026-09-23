import { useEditorStore } from "@/store/editorStore";

export function ZoomControl() {
  const zoom = useEditorStore((state) => state.zoom);
  const minZoom = useEditorStore((state) => state.minZoom);
  const maxZoom = useEditorStore((state) => state.maxZoom);
  const viewMode = useEditorStore((state) => state.viewMode);
  const setZoom = useEditorStore((state) => state.setZoom);
  const setViewMode = useEditorStore((state) => state.setViewMode);
  const resetZoom = useEditorStore((state) => state.resetZoom);

  return (
    <div aria-label="Zoom controls" role="group" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[12px] font-medium text-[#858585]">
      <div className="flex items-center gap-1 rounded-full border border-[#e6e6e4] bg-white/70 p-1">
        {(["fit", "fill"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => setViewMode(mode)}
            aria-pressed={viewMode === mode}
            className={`min-h-11 rounded-full px-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] ${viewMode === mode ? "bg-[#f0f0ee] text-[#242424]" : "hover:text-[#242424]"}`}
          >
            {mode === "fit" ? "Fit" : "Fill"}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-[17px] font-light leading-none">−</span>
        <input
          aria-label="Zoom image"
          type="range"
          min={minZoom}
          max={maxZoom}
          step={0.01}
          value={zoom}
          onChange={(event) => setZoom(event.currentTarget.valueAsNumber)}
          className="zoom-range w-24 sm:w-28"
        />
        <span aria-hidden="true" className="text-[17px] font-light leading-none">+</span>
        <span className="w-10 text-right tabular-nums">{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={resetZoom} className="min-h-11 text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Reset zoom</button>
      </div>
    </div>
  );
}
