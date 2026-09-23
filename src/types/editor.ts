import type { CustomRatio, RatioId, RatioPresetId } from "@/lib/ratios";

export interface AspectRatio {
  width: number;
  height: number;
}

export interface ImagePreset extends AspectRatio {
  id: RatioPresetId;
}

export type CropPosition = {
  x: number;
  y: number;
};

export type FocalPoint = {
  x: number;
  y: number;
};

export type ViewMode = "fit" | "fill";

export type ExportFormat = "png" | "jpeg" | "webp";
export type PlatformId = "instagram" | "tiktok" | "youtube" | "x" | "facebook" | "linkedin";
export type PlatformPreset = AspectRatio & { id: string; platform: PlatformId; name: string; description?: string; category?: string };
/** Fractions of the visible crop viewport, each in the range 0–1. */
export type SafeZoneRegion = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  label?: string;
  severity?: "caution" | "blocked";
};
export type SafeZonePreset = {
  presetId: string;
  zones: readonly SafeZoneRegion[];
  safeFrame?: SafeZoneRegion;
};
export type ExportSizePreset = "original" | "preset" | "1080" | "1440" | "2160" | "custom";
export type ExportSize = { preset: ExportSizePreset; customSide: number; customAxis: "width" | "height" };

export type ExportOptions = {
  format: ExportFormat;
  quality: number;
};

export interface EditorState {
  imageFile: File | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageName: string | null;
  selectedRatioId: RatioId;
  activePlatformPresetId: string | null;
  showSafeZone: boolean;
  customRatio: CustomRatio;
  isManualRatio: boolean;
  manualFrameWidth: number | null;
  selectedExportRatios: RatioPresetId[];
  crop: CropPosition;
  focalPoint: FocalPoint;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  viewMode: ViewMode;
  lastFillCrop: CropPosition;
  lastFillZoom: number;
  exportFormat: ExportFormat;
  exportQuality: number;
  exportSize: ExportSize;
  setImage: (file: File, url: string, width: number, height: number) => void;
  clearImage: () => void;
  setSelectedRatio: (ratioId: RatioPresetId | "custom") => void;
  setActivePlatformPreset: (id: string) => void;
  setShowSafeZone: (show: boolean) => void;
  setCustomRatio: (width: number, height: number) => void;
  setManualRatio: (value: number, frameWidth: number) => void;
  setExportSizePreset: (preset: ExportSizePreset) => void;
  setCustomExportSide: (side: number, axis: "width" | "height") => void;
  toggleExportRatio: (ratioId: RatioPresetId) => void;
  selectAllExportRatios: () => void;
  clearExportRatios: () => void;
  setCrop: (crop: CropPosition) => void;
  setFocalPoint: (point: FocalPoint) => void;
  resetPosition: () => void;
  resetFocalPoint: () => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: ViewMode) => void;
  resetZoom: () => void;
  setExportFormat: (format: ExportFormat) => void;
  setExportQuality: (quality: number) => void;
}
