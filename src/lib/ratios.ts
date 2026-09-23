export interface RatioPreset {
  id: string;
  name: string;
  label: string;
  width: number;
  height: number;
  value: number;
}

export const RATIOS = [
  { id: "9:16", name: "Portrait", label: "9:16", width: 9, height: 16, value: 9 / 16 },
  { id: "1:1", name: "Square", label: "1:1", width: 1, height: 1, value: 1 },
  { id: "4:5", name: "Social Portrait", label: "4:5", width: 4, height: 5, value: 4 / 5 },
  { id: "3:2", name: "Photography", label: "3:2", width: 3, height: 2, value: 3 / 2 },
  { id: "16:9", name: "Landscape", label: "16:9", width: 16, height: 9, value: 16 / 9 },
] as const satisfies readonly RatioPreset[];

export type RatioPresetId = (typeof RATIOS)[number]["id"];
export type RatioId = RatioPresetId | "custom";
export type CustomRatio = { width: number; height: number };
export const MIN_RATIO_VALUE = 0.1;
export const MAX_RATIO_VALUE = 100;
export const DEFAULT_CUSTOM_RATIO: CustomRatio = { width: 21, height: 9 };

export const DEFAULT_RATIO = RATIOS[4];

export function getRatioPreset(id: RatioPresetId): (typeof RATIOS)[number] {
  return RATIOS.find((ratio) => ratio.id === id) ?? DEFAULT_RATIO;
}

export function parseRatioSide(value: string): number | null {
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(value.trim())) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= MIN_RATIO_VALUE && parsed <= MAX_RATIO_VALUE ? parsed : null;
}

export function isValidCustomRatio(ratio: CustomRatio): boolean {
  return [ratio.width, ratio.height].every((side) => Number.isFinite(side) && side >= MIN_RATIO_VALUE && side <= MAX_RATIO_VALUE);
}

export function getActiveRatio(selectedRatioId: RatioId, customRatio: CustomRatio) {
  if (selectedRatioId !== "custom") return getRatioPreset(selectedRatioId);
  const valid = isValidCustomRatio(customRatio) ? customRatio : DEFAULT_CUSTOM_RATIO;
  return { id: "custom" as const, name: "Custom", label: `${valid.width}:${valid.height}`, ...valid, value: valid.width / valid.height };
}
