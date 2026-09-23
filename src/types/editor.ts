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
export type ExportSizePreset = "original" | "1080" | "1440" | "2160" | "custom";
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
  customRatio: CustomRatio;
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
  setSelectedRatio: (ratioId: RatioId) => void;
  setCustomRatio: (width: number, height: number) => void;
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
