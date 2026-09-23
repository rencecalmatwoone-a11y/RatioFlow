import { create } from "zustand";
import type { EditorState } from "@/types/editor";

export const useEditorStore = create<EditorState>((set) => ({
  imageFile: null,
  imageUrl: null,
  imageWidth: null,
  imageHeight: null,
  imageName: null,
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
      };
    }),
}));
