import type { CustomRatio, RatioId, RatioPresetId } from "@/lib/ratios";

const iconSizes: Record<RatioPresetId, string> = {
  "9:16": "h-[21px] w-[12px]",
  "1:1": "h-[17px] w-[17px]",
  "4:5": "h-[19px] w-[15px]",
  "4:3": "h-[16px] w-[21px]",
  "3:2": "h-[15px] w-[23px]",
  "16:9": "h-[13px] w-[24px]",
};

export function RatioIcon({ ratio, customRatio }: { ratio: RatioId; customRatio?: CustomRatio }) {
  if (ratio === "custom" || ratio === "platform") {
    const value = (customRatio?.width ?? 21) / (customRatio?.height ?? 9);
    const width = value >= 1 ? 24 : Math.max(5, 21 * value);
    const height = value >= 1 ? Math.max(5, 21 / value) : 21;
    return <span aria-hidden="true" className="block shrink-0 rounded-[3px] border-[1.5px] border-current" style={{ width, height }} />;
  }
  return (
    <span aria-hidden="true" className={`block shrink-0 rounded-[3px] border-[1.5px] border-current ${iconSizes[ratio]}`} />
  );
}
