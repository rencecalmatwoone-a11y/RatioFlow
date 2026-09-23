import type { RatioPresetId } from "@/lib/ratios";

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

export type ViewMode = "fit" | "fill";

export interface EditorState {
  imageFile: File | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageName: string | null;
  selectedRatioId: RatioPresetId;
  crop: CropPosition;
  zoom: number;
  minZoom: number;
  maxZoom: number;
  viewMode: ViewMode;
  lastFillCrop: CropPosition;
  lastFillZoom: number;
  setImage: (file: File, url: string, width: number, height: number) => void;
  clearImage: () => void;
  setSelectedRatio: (ratioId: RatioPresetId) => void;
  setCrop: (crop: CropPosition) => void;
  setZoom: (zoom: number) => void;
  setViewMode: (mode: ViewMode) => void;
  resetZoom: () => void;
}
