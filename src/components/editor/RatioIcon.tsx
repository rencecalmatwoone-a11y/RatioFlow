type Ratio = "9:16" | "1:1" | "4:5" | "3:2" | "16:9";

const iconSizes: Record<Ratio, string> = {
  "9:16": "h-[21px] w-[12px]",
  "1:1": "h-[17px] w-[17px]",
  "4:5": "h-[19px] w-[15px]",
  "3:2": "h-[15px] w-[23px]",
  "16:9": "h-[13px] w-[24px]",
};

export function RatioIcon({ ratio }: { ratio: Ratio }) {
  return (
    <span aria-hidden="true" className={`block shrink-0 rounded-[3px] border-[1.5px] border-current ${iconSizes[ratio]}`} />
  );
}

export type { Ratio };
