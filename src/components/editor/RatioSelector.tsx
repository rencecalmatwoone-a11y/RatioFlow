import { RatioIcon, type Ratio } from "./RatioIcon";

const ratios: Ratio[] = ["9:16", "1:1", "4:5", "3:2", "16:9"];

export function RatioSelector() {
  return (
    <div aria-label="Aspect ratio" role="group" className="max-w-full overflow-x-auto pb-1">
      <div className="mx-auto flex w-max items-center gap-1 rounded-[18px] border border-black/[0.04] bg-[#ececeb] p-1.5 shadow-[0_3px_10px_rgba(0,0,0,0.03)]">
        {ratios.map((ratio) => {
          const selected = ratio === "16:9";

          return (
            <button
              key={ratio}
              type="button"
              aria-label={`${ratio} aspect ratio`}
              aria-pressed={selected}
              className={`flex h-12 w-12 flex-col items-center justify-center gap-1 rounded-[13px] text-[9px] font-medium tracking-tight transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] sm:h-[54px] sm:w-[55px] ${selected ? "bg-white text-[#181818] shadow-[0_2px_7px_rgba(0,0,0,0.1)]" : "text-[#777773] hover:bg-white/55 hover:text-[#181818]"}`}
            >
              <RatioIcon ratio={ratio} />
              <span aria-hidden="true">{ratio}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
