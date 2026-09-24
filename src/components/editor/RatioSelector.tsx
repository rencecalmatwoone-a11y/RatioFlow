import { getActiveRatio, getMatchingRatioPreset, RATIOS } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";
import { RatioIcon } from "./RatioIcon";
import { CustomRatioControl } from "./CustomRatioControl";
import { getPlatformPresetById } from "@/constants/platformPresets";

export function RatioSelector() {
  const selectedRatioId = useEditorStore((state) => state.selectedRatioId);
  const setSelectedRatio = useEditorStore((state) => state.setSelectedRatio);
  const customRatio = useEditorStore((state) => state.customRatio);
  const isManualRatio = useEditorStore((state) => state.isManualRatio);
  const activePlatformPresetId = useEditorStore((state) => state.activePlatformPresetId);
  const activePreset = getPlatformPresetById(activePlatformPresetId);
  const manualMatch = isManualRatio ? getMatchingRatioPreset(customRatio.width / customRatio.height) : undefined;

  return (
    <div aria-label="Aspect ratio" role="group" className="flex w-full flex-col items-center gap-3">
      <div className="max-w-full overflow-x-auto pb-1">
        <div className="mx-auto flex w-max items-center gap-1 rounded-[18px] border border-black/[0.04] bg-[#ececeb] p-1.5 shadow-[0_3px_10px_rgba(0,0,0,0.03)]">
        {RATIOS.map((ratio) => {
          const selected = ratio.id === selectedRatioId || manualMatch?.id === ratio.id || (selectedRatioId === "platform" && !!activePreset && ratio.value === activePreset.width / activePreset.height);

          return (
            <button
              key={ratio.id}
              type="button"
              onClick={() => setSelectedRatio(ratio.id)}
              aria-label={`Set aspect ratio to ${ratio.width} by ${ratio.height}`}
              aria-pressed={selected}
              className={`flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-[13px] text-[9px] font-medium tracking-tight transition-[transform,background-color,box-shadow,color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(0,0,0,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transform-none motion-reduce:transition-none sm:h-[54px] sm:w-[55px] ${selected ? "bg-white text-[#181818] shadow-[0_2px_7px_rgba(0,0,0,0.1)]" : "text-[#777773] hover:bg-white/75 hover:text-[#181818]"}`}
            >
              <RatioIcon ratio={ratio.id} />
              <span aria-hidden="true">{ratio.label}</span>
            </button>
          );
        })}
        <button type="button" onClick={() => setSelectedRatio("custom")} aria-label={`Set custom aspect ratio ${getActiveRatio("custom", customRatio).label}`} aria-pressed={selectedRatioId === "custom" && !manualMatch} className={`flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-[13px] text-[9px] font-medium tracking-tight transition-[transform,background-color,box-shadow,color] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_4px_10px_rgba(0,0,0,0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transform-none motion-reduce:transition-none sm:h-[54px] sm:w-[55px] ${selectedRatioId === "custom" && !manualMatch ? "bg-white text-[#181818] shadow-[0_2px_7px_rgba(0,0,0,0.1)]" : "text-[#777773] hover:bg-white/75 hover:text-[#181818]"}`}>
          <RatioIcon ratio="custom" customRatio={customRatio} />
          <span aria-hidden="true">Custom</span>
        </button>
        </div>
      </div>
      {selectedRatioId === "custom" && !isManualRatio && <CustomRatioControl />}
    </div>
  );
}
