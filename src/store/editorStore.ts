import { create } from "zustand";
import { DEFAULT_RATIO } from "@/lib/ratios";
import type { EditorState } from "@/types/editor";

export const useEditorStore = create<EditorState>((set) => ({
  imageFile: null,
  imageUrl: null,
  imageWidth: null,
  imageHeight: null,
  imageName: null,
  selectedRatioId: DEFAULT_RATIO.id,
  crop: { x: 0, y: 0 },
  setSelectedRatio: (ratioId) => set({ selectedRatioId: ratioId }),
  setCrop: (crop) => set({ crop }),
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
      };
    }),
}));
