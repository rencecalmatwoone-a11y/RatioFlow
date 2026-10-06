import { create } from "zustand";
import { DEFAULT_CUSTOM_RATIO, DEFAULT_RATIO, RATIOS, getMatchingRatioPreset, imageRatio, isValidCustomRatio } from "../lib/ratios.ts";
import { isValidOutputInput } from "../lib/exportDimensions.ts";
import { clampFocalPoint } from "../lib/focalPoint.ts";
import { createImageEditorState, MAX_ZOOM, MIN_ZOOM, releaseImageUrls, selectActiveImage, selectActiveEditor } from "../lib/batchImages.ts";
import { getPlatformPresetById } from "../constants/platformPresets.ts";
import type { EditorState, ImageEditorState } from "../types/editor.ts";

export { selectActiveImage, selectActiveEditor } from "../lib/batchImages.ts";

function editorChanged(editor: ImageEditorState, patch: Partial<ImageEditorState>): boolean {
  return (Object.keys(patch) as (keyof ImageEditorState)[]).some((key) => {
    const value = patch[key];
    const previous = editor[key];
    if (typeof value === "object" && value !== null && typeof previous === "object" && previous !== null) {
      return Object.keys(value).some((axis) => value[axis as keyof typeof value] !== previous[axis as keyof typeof previous]);
    }
    return value !== previous;
  });
}

function updateEditor(state: EditorState, id: string | null, patch: Partial<ImageEditorState>, intentional = false): Partial<EditorState> {
  let changed = false;
  const batchImages = state.batchImages.map((image) => {
    if (image.id !== id || !editorChanged(image.editor, patch)) return image;
    changed = true;
    return { ...image, editor: { ...image.editor, ...patch }, isEdited: image.isEdited || intentional };
  });
  return changed ? { batchImages } : state;
}

function ratioUpdate(state: EditorState, patch: Partial<ImageEditorState>): Partial<EditorState> {
  const editor = { ...selectActiveEditor(state), ...patch };
  return {
    ...updateEditor(state, state.activeImageId, patch, true),
    // Preserve single-photo synchronization. A shoot has explicit shared export targets.
    ...(state.batchImages.length <= 1 ? {
      selectedExportRatios: [editor.selectedRatioId],
      exportRatioConfiguration: { customRatio: { ...editor.customRatio }, platformPresetId: editor.activePlatformPresetId },
      exportSize: editor.selectedRatioId === "platform" ? { ...state.exportSize, preset: "preset", platformPresetId: editor.activePlatformPresetId }
        : state.exportSize.preset === "preset" ? { ...state.exportSize, preset: "original", platformPresetId: null } : state.exportSize,
    } : {}),
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  batchImages: [], activeImageId: null,
  minZoom: MIN_ZOOM, maxZoom: MAX_ZOOM,
  isPreparingImages: false, isExporting: false,
  selectedExportRatios: [DEFAULT_RATIO.id],
  exportRatioConfiguration: { customRatio: { ...DEFAULT_CUSTOM_RATIO }, platformPresetId: null },
  exportFormat: "png", exportQuality: 0.9,
  exportSize: { preset: "original", customSide: 1920, customAxis: "width" },
  setIsPreparingImages: (isPreparingImages) => set({ isPreparingImages }),
  setIsExporting: (isExporting) => set({ isExporting }),
  addImages: (images) => set((state) => {
    if (state.isExporting) { images.forEach(releaseImageUrls); return state; }
    const first = state.batchImages.length === 0 ? images[0]?.editor : undefined;
    return { batchImages: [...state.batchImages, ...images], activeImageId: state.activeImageId ?? images[0]?.id ?? null,
      ...(first ? { selectedExportRatios: [first.selectedRatioId],
        exportRatioConfiguration: { customRatio: { ...first.customRatio }, platformPresetId: first.activePlatformPresetId },
        exportSize: state.exportSize.preset === "preset" && !first.activePlatformPresetId
          ? { ...state.exportSize, preset: "original", platformPresetId: null } : state.exportSize } : {}) };
  }),
  replaceImage: (id, image) => set((state) => {
    const previous = state.batchImages.find((item) => item.id === id);
    if (state.isExporting || !previous) { releaseImageUrls(image); return state; }
    releaseImageUrls(previous);
    return { batchImages: state.batchImages.map((item) => item.id === id ? { ...image, id } : item) };
  }),
  removeImage: (id) => set((state) => {
    if (state.isExporting || state.isPreparingImages) return state;
    const index = state.batchImages.findIndex((image) => image.id === id);
    if (index < 0) return state;
    releaseImageUrls(state.batchImages[index]);
    const batchImages = state.batchImages.filter((image) => image.id !== id);
    return { batchImages, activeImageId: state.activeImageId === id
      ? batchImages[Math.min(index, batchImages.length - 1)]?.id ?? null : state.activeImageId };
  }),
  clearBatch: () => set((state) => {
    if (state.isExporting || state.isPreparingImages) return state;
    state.batchImages.forEach(releaseImageUrls);
    return { batchImages: [], activeImageId: null };
  }),
  setActiveImage: (id) => set((state) => state.batchImages.some((image) => image.id === id) ? { activeImageId: id } : state),
  updateImageEditorState: (id, patch) => set((state) => updateEditor(state, id, patch, true)),
  applyRatioToAll: () => set((state) => {
    const active = selectActiveImage(state);
    if (!active) return state;
    const { selectedRatioId, customRatio, activePlatformPresetId } = active.editor;
    return { batchImages: state.batchImages.map((image) => {
      const patch = { selectedRatioId, activePlatformPresetId, customRatio: selectedRatioId === "free"
        ? imageRatio(image.width, image.height) : { ...customRatio }, isManualRatio: false, manualFrameWidth: null };
      return editorChanged(image.editor, patch) ? { ...image, isEdited: true, editor: { ...image.editor, ...patch } } : image;
    }) };
  }),
  setExportSizePreset: (preset) => set((state) => {
    const platformPresetId = selectActiveEditor(state).activePlatformPresetId
      ?? state.exportSize.platformPresetId ?? state.exportRatioConfiguration.platformPresetId;
    if (preset === "preset" && !getPlatformPresetById(platformPresetId)) return state;
    return { exportSize: { ...state.exportSize, preset, ...(preset === "preset" ? { platformPresetId } : {}) } };
  }),
  setCustomExportSide: (side, axis) => set((state) => isValidOutputInput(side)
    ? { exportSize: { ...state.exportSize, customSide: side, customAxis: axis } } : state),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setExportQuality: (quality) => set((state) => ({ exportQuality: Number.isFinite(quality) ? Math.min(1, Math.max(0, quality)) : state.exportQuality })),
  setSelectedRatio: (selectedRatioId) => set((state) => {
    const image = selectActiveImage(state);
    return ratioUpdate(state, { selectedRatioId, activePlatformPresetId: null, isManualRatio: false, manualFrameWidth: null,
      ...(selectedRatioId === "free" && image ? { customRatio: imageRatio(image.width, image.height) } : {}) });
  }),
  setActivePlatformPreset: (id) => set((state) => getPlatformPresetById(id)
    ? ratioUpdate(state, { activePlatformPresetId: id, selectedRatioId: "platform", isManualRatio: false, manualFrameWidth: null }) : state),
  setCustomRatio: (width, height) => set((state) => isValidCustomRatio({ width, height })
    ? ratioUpdate(state, { customRatio: { width, height }, selectedRatioId: "custom", activePlatformPresetId: null, isManualRatio: false, manualFrameWidth: null }) : state),
  setManualRatio: (value, frameWidth) => set((state) => {
    if (!Number.isFinite(value) || value < 0.4 || value > 4 || !Number.isFinite(frameWidth) || frameWidth <= 0) return state;
    const matched = getMatchingRatioPreset(value);
    return ratioUpdate(state, { selectedRatioId: matched?.id ?? "custom", customRatio: matched
      ? { width: matched.width, height: matched.height } : { width: Number(value.toFixed(4)), height: 1 },
      activePlatformPresetId: null, isManualRatio: true, manualFrameWidth: frameWidth });
  }),
  setShowSafeZone: (showSafeZone) => set((state) => updateEditor(state, state.activeImageId, { showSafeZone })),
  toggleExportRatio: (ratioId) => set((state) => {
    const editor = selectActiveEditor(state);
    return { selectedExportRatios: state.selectedExportRatios.includes(ratioId)
      ? state.selectedExportRatios.filter((id) => id !== ratioId)
      : [...RATIOS.filter((ratio) => ratio.id === ratioId || state.selectedExportRatios.includes(ratio.id)).map((ratio) => ratio.id),
        ...(["free", "custom", "platform"] as const).filter((id) => id === ratioId || state.selectedExportRatios.includes(id))],
      exportRatioConfiguration: { ...state.exportRatioConfiguration,
        ...(ratioId === "custom" && !state.selectedExportRatios.includes(ratioId) ? { customRatio: { ...editor.customRatio } } : {}),
        ...(ratioId === "platform" && !state.selectedExportRatios.includes(ratioId) ? { platformPresetId: editor.activePlatformPresetId } : {}) } };
  }),
  selectAllExportRatios: () => set((state) => {
    const editor = selectActiveEditor(state);
    return { selectedExportRatios: [...RATIOS.map((ratio) => ratio.id),
      ...(editor.selectedRatioId === "free" || editor.selectedRatioId === "custom" || editor.selectedRatioId === "platform" ? [editor.selectedRatioId] : [])],
      exportRatioConfiguration: { customRatio: { ...editor.customRatio }, platformPresetId: editor.activePlatformPresetId } };
  }),
  clearExportRatios: () => set({ selectedExportRatios: [] }),
  setCrop: (crop) => set((state) => updateEditor(state, state.activeImageId, { crop,
    ...(selectActiveEditor(state).viewMode === "fill" ? { lastFillCrop: crop } : {}) })),
  setFocalPoint: (point) => set((state) => updateEditor(state, state.activeImageId, { focalPoint: clampFocalPoint(point) }, true)),
  resetFocalPoint: () => set((state) => updateEditor(state, state.activeImageId, { focalPoint: { x: 0.5, y: 0.5 } })),
  resetPosition: () => set((state) => updateEditor(state, state.activeImageId, { crop: { x: 0, y: 0 }, focalPoint: { x: 0.5, y: 0.5 }, lastFillCrop: { x: 0, y: 0 } })),
  setZoom: (value) => set((state) => {
    const editor = selectActiveEditor(state);
    const zoom = Number.isFinite(value) ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value)) : editor.zoom;
    return updateEditor(state, state.activeImageId, { zoom, ...(editor.viewMode === "fill" ? { lastFillZoom: zoom } : {}) }, true);
  }),
  setViewMode: (viewMode) => set((state) => {
    const editor = selectActiveEditor(state);
    if (viewMode === editor.viewMode) return state;
    return updateEditor(state, state.activeImageId, viewMode === "fit"
      ? { viewMode, crop: { x: 0, y: 0 }, zoom: MIN_ZOOM, lastFillCrop: editor.crop, lastFillZoom: editor.zoom }
      : { viewMode, crop: editor.lastFillCrop, zoom: editor.lastFillZoom }, true);
  }),
  resetZoom: () => set((state) => updateEditor(state, state.activeImageId, { zoom: MIN_ZOOM,
    ...(selectActiveEditor(state).viewMode === "fill" ? { lastFillZoom: MIN_ZOOM } : {}) })),
  resetEditor: () => set((state) => ({ ...ratioUpdate(state, createImageEditorState()),
    batchImages: state.batchImages.map((image) => image.id === state.activeImageId ? { ...image, editor: createImageEditorState(), isEdited: false } : image),
    ...(state.batchImages.length <= 1 ? { exportFormat: "png", exportQuality: 0.9,
      exportSize: { preset: "original", customSide: 1920, customAxis: "width" } } : {}) })),
  resetImage: () => set((state) => ({ batchImages: state.batchImages.map((image) => image.id === state.activeImageId
    ? { ...image, editor: createImageEditorState(), isEdited: false } : image) })),
}));
