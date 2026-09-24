import { create } from "zustand";
import { DEFAULT_CUSTOM_RATIO, DEFAULT_RATIO, RATIOS, getMatchingRatioPreset, isValidCustomRatio } from "@/lib/ratios";
import { isValidOutputInput } from "@/lib/exportDimensions";
import { clampFocalPoint } from "@/lib/focalPoint";
import { getPlatformPresetById } from "@/constants/platformPresets";
import type { EditorState } from "@/types/editor";

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const DEFAULT_ZOOM = MIN_ZOOM;
const DEFAULT_VIEW_MODE = "fill";
const CENTER = { x: 0, y: 0 };
const CENTER_FOCAL = { x: 0.5, y: 0.5 };

export const useEditorStore = create<EditorState>((set) => ({
  imageFile: null,
  imageUrl: null,
  imageWidth: null,
  imageHeight: null,
  imageName: null,
  selectedRatioId: DEFAULT_RATIO.id,
  activePlatformPresetId: null,
  showSafeZone: false,
  customRatio: DEFAULT_CUSTOM_RATIO,
  isManualRatio: false,
  manualFrameWidth: null,
  selectedExportRatios: [DEFAULT_RATIO.id],
  crop: { x: 0, y: 0 },
  focalPoint: CENTER_FOCAL,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  viewMode: DEFAULT_VIEW_MODE,
  lastFillCrop: CENTER,
  lastFillZoom: DEFAULT_ZOOM,
  exportFormat: "png",
  exportQuality: 0.9,
  exportSize: { preset: "original", customSide: 1920, customAxis: "width" },
  setExportSizePreset: (preset) => set((state) => ({ exportSize: { ...state.exportSize, preset } })),
  setCustomExportSide: (side, axis) => set((state) => isValidOutputInput(side)
    ? { exportSize: { ...state.exportSize, customSide: side, customAxis: axis } } : state),
  setCustomRatio: (width, height) => set((state) => isValidCustomRatio({ width, height })
    ? { customRatio: { width, height }, selectedRatioId: "custom", activePlatformPresetId: null, isManualRatio: false, manualFrameWidth: null,
      selectedExportRatios: ["custom"],
      exportSize: state.exportSize.preset === "preset" ? { ...state.exportSize, preset: "original" } : state.exportSize } : state),
  setManualRatio: (value, frameWidth) => set((state) => {
    if (!Number.isFinite(value) || value < 0.4 || value > 4 || !Number.isFinite(frameWidth) || frameWidth <= 0) return state;
    const matchedPreset = getMatchingRatioPreset(value);
    const ratioId = matchedPreset?.id ?? "custom";
    return {
      customRatio: matchedPreset
        ? { width: matchedPreset.width, height: matchedPreset.height }
        : { width: Number(value.toFixed(4)), height: 1 },
      selectedRatioId: ratioId,
      isManualRatio: true,
      manualFrameWidth: frameWidth,
      activePlatformPresetId: null,
      selectedExportRatios: [ratioId],
      exportSize: state.exportSize.preset === "preset" ? { ...state.exportSize, preset: "original" } : state.exportSize,
    };
  }),
  setExportFormat: (format) => set({ exportFormat: format }),
  setExportQuality: (quality) => set((state) => ({
    exportQuality: Number.isFinite(quality) ? Math.min(1, Math.max(0, quality)) : state.exportQuality,
  })),
  setSelectedRatio: (ratioId) => set((state) => ({
    selectedRatioId: ratioId,
    selectedExportRatios: [ratioId],
    isManualRatio: false,
    manualFrameWidth: null,
    activePlatformPresetId: null,
    exportSize: state.exportSize.preset === "preset"
      ? { ...state.exportSize, preset: "original" } : state.exportSize,
  })),
  setActivePlatformPreset: (id) => set((state) => getPlatformPresetById(id)
    ? { activePlatformPresetId: id, selectedRatioId: "platform", selectedExportRatios: ["platform"], isManualRatio: false, manualFrameWidth: null, exportSize: { ...state.exportSize, preset: "preset" } }
    : state),
  setShowSafeZone: (show) => set({ showSafeZone: show }),
  toggleExportRatio: (ratioId) => set((state) => ({
    selectedExportRatios: state.selectedExportRatios.includes(ratioId)
      ? state.selectedExportRatios.filter((id) => id !== ratioId)
      : [...RATIOS.filter((ratio) => ratio.id === ratioId || state.selectedExportRatios.includes(ratio.id)).map((ratio) => ratio.id),
        ...(["custom", "platform"] as const).filter((id) => id === ratioId || state.selectedExportRatios.includes(id))],
  })),
  selectAllExportRatios: () => set((state) => ({ selectedExportRatios: [
    ...RATIOS.map((ratio) => ratio.id),
    ...(state.selectedRatioId === "custom" || state.selectedRatioId === "platform" ? [state.selectedRatioId] : []),
  ] })),
  clearExportRatios: () => set({ selectedExportRatios: [] }),
  setCrop: (crop) => set((state) => ({
    crop,
    ...(state.viewMode === "fill" ? { lastFillCrop: crop } : {}),
  })),
  setFocalPoint: (point) => set({ focalPoint: clampFocalPoint(point) }),
  resetFocalPoint: () => set({ focalPoint: CENTER_FOCAL }),
  resetPosition: () => set((state) => ({
    crop: CENTER,
    focalPoint: CENTER_FOCAL,
    ...(state.viewMode === "fill" ? { lastFillCrop: CENTER } : {}),
  })),
  setZoom: (zoom) => set((state) => {
    const nextZoom = Number.isFinite(zoom)
      ? Math.min(state.maxZoom, Math.max(state.minZoom, zoom))
      : state.zoom;
    return {
      zoom: nextZoom,
      ...(state.viewMode === "fill" ? { lastFillZoom: nextZoom } : {}),
    };
  }),
  setViewMode: (mode) => set((state) => {
    if (mode === state.viewMode) return state;
    return mode === "fit"
      ? { viewMode: mode, crop: CENTER, zoom: DEFAULT_ZOOM, lastFillCrop: state.crop, lastFillZoom: state.zoom }
      : { viewMode: mode, crop: state.lastFillCrop, zoom: state.lastFillZoom };
  }),
  resetZoom: () => set((state) => ({
    zoom: DEFAULT_ZOOM,
    ...(state.viewMode === "fill" ? { lastFillZoom: DEFAULT_ZOOM } : {}),
  })),
  setImage: (file, url, width, height) =>
    set((state) => {
      if (state.imageUrl && state.imageUrl !== url) {
        URL.revokeObjectURL(state.imageUrl);
      }
      return {
        imageFile: file,
        imageUrl: url,
        imageWidth: width,
        imageHeight: height,
        imageName: file.name,
        selectedExportRatios: [state.selectedRatioId],
        crop: { x: 0, y: 0 },
        focalPoint: CENTER_FOCAL,
        zoom: DEFAULT_ZOOM,
        viewMode: DEFAULT_VIEW_MODE,
        lastFillCrop: CENTER,
        lastFillZoom: DEFAULT_ZOOM,
      };
    }),
  clearImage: () =>
    set((state) => {
      if (state.imageUrl) {
        URL.revokeObjectURL(state.imageUrl);
      }
      return {
        imageFile: null,
        imageUrl: null,
        imageWidth: null,
        imageHeight: null,
        imageName: null,
        selectedExportRatios: [state.selectedRatioId],
        crop: { x: 0, y: 0 },
        focalPoint: CENTER_FOCAL,
        zoom: DEFAULT_ZOOM,
        viewMode: DEFAULT_VIEW_MODE,
        lastFillCrop: CENTER,
        lastFillZoom: DEFAULT_ZOOM,
      };
    }),
}));
