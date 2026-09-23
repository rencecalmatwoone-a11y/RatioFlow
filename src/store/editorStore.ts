import { create } from "zustand";
import { DEFAULT_RATIO } from "@/lib/ratios";
import { clampFocalPoint } from "@/lib/focalPoint";
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
  crop: { x: 0, y: 0 },
  focalPoint: CENTER_FOCAL,
  zoom: DEFAULT_ZOOM,
  minZoom: MIN_ZOOM,
  maxZoom: MAX_ZOOM,
  viewMode: DEFAULT_VIEW_MODE,
  lastFillCrop: CENTER,
  lastFillZoom: DEFAULT_ZOOM,
  setSelectedRatio: (ratioId) => set({ selectedRatioId: ratioId }),
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
        crop: { x: 0, y: 0 },
        focalPoint: CENTER_FOCAL,
        zoom: DEFAULT_ZOOM,
        viewMode: DEFAULT_VIEW_MODE,
        lastFillCrop: CENTER,
        lastFillZoom: DEFAULT_ZOOM,
      };
    }),
}));
