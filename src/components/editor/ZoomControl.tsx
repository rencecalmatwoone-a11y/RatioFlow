export function ZoomControl() {
  return (
    <div aria-label="Zoom controls" role="group" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[12px] font-medium text-[#858585]">
      <div className="flex items-center gap-1 rounded-full border border-[#e6e6e4] bg-white/70 p-1">
        <button type="button" aria-pressed="true" className="min-h-11 rounded-full bg-[#f0f0ee] px-4 text-[#242424] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Fit</button>
        <button type="button" aria-pressed="false" className="min-h-11 rounded-full px-4 transition-colors hover:text-[#242424] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Fill</button>
      </div>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="text-[17px] font-light leading-none">−</span>
        <input aria-label="Zoom level" type="range" min="50" max="150" defaultValue="100" className="zoom-range w-24 sm:w-28" />
        <span aria-hidden="true" className="text-[17px] font-light leading-none">+</span>
        <span className="w-9 text-right tabular-nums">100%</span>
      </div>
    </div>
  );
}
