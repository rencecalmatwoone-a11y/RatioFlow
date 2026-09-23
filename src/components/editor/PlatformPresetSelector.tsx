import { useEffect, useRef, useState } from "react";
import { getPlatformName, getPlatformPresetById, getPresetsByPlatform, PLATFORMS } from "@/constants/platformPresets";
import { ratioLabel } from "@/lib/ratioMath";
import { useEditorStore } from "@/store/editorStore";
import type { PlatformId } from "@/types/editor";

export function PlatformPresetSelector() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<PlatformId>("instagram");
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const activeId = useEditorStore((state) => state.activePlatformPresetId);
  const selectPreset = useEditorStore((state) => state.setActivePlatformPreset);
  const active = getPlatformPresetById(activeId);

  useEffect(() => {
    if (!mounted || open) return;
    const timeout = window.setTimeout(() => setMounted(false), 160);
    return () => window.clearTimeout(timeout);
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  return (
    <div
      ref={container}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls="platform-presets"
        onClick={() => {
          if (!open && active) setPlatform(active.platform);
          if (!open) setMounted(true);
          setOpen(!open);
        }}
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#dededb] bg-white px-4 text-[13px] font-medium text-[#30302f] shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]"
      >
        <span>Presets</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 10 10"
          className="h-3 w-3 shrink-0 -translate-y-[1px] text-[#898984]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2.2 6.2 5 3.4l2.8 2.8" />
        </svg>
      </button>
      {mounted && (
        <div
          id="platform-presets"
          aria-label="Platform presets"
          aria-hidden={!open}
          inert={!open}
          className={`absolute bottom-full left-1/2 z-30 mb-3 max-h-[min(75vh,32rem)] w-[min(22rem,calc(100vw-2rem))] -translate-x-1/2 overflow-y-auto rounded-2xl border border-[#e6e6e4] bg-white p-3 text-[#242424] shadow-[0_12px_35px_rgba(0,0,0,0.12)] ${open ? "preset-panel-enter" : "preset-panel-exit"}`}
        >
          <p className="px-1 pb-2 text-xs font-medium">Platform presets</p>
          <div role="group" aria-label="Choose platform" className="grid grid-cols-3 gap-1 rounded-xl bg-[#f2f2f0] p-1">
            {PLATFORMS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={platform === item.id}
                onClick={() => setPlatform(item.id)}
                className={`min-h-11 rounded-lg px-1 text-xs font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] ${platform === item.id ? "bg-white text-[#181818] shadow-sm" : "text-[#686864] hover:bg-white/60"}`}
              >{item.name}</button>
            ))}
          </div>
          <div role="group" aria-label={`${getPlatformName(platform)} presets`} className="mt-2 flex flex-col gap-1">
            {getPresetsByPlatform(platform).map((preset) => (
              <button
                key={preset.id}
                type="button"
                aria-pressed={activeId === preset.id}
                onClick={() => { selectPreset(preset.id); setOpen(false); trigger.current?.focus(); }}
                className={`flex min-h-14 w-full items-center gap-3 rounded-xl px-3 py-2 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] ${activeId === preset.id ? "bg-[#eeeeeb]" : "hover:bg-[#f7f7f5]"}`}
              >
                <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center">
                  <span className="block max-h-7 max-w-7 rounded-[2px] border-[1.5px] border-current" style={{ aspectRatio: `${preset.width} / ${preset.height}`, width: preset.width >= preset.height ? 28 : Math.max(7, 28 * preset.width / preset.height), height: preset.height > preset.width ? 28 : Math.max(7, 28 * preset.height / preset.width) }} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{preset.name}</span>
                  <span className="block text-[11px] text-[#777]">{preset.width} × {preset.height} · {ratioLabel(preset)}</span>
                </span>
                {activeId === preset.id && <span aria-hidden="true" className="text-sm">✓</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
