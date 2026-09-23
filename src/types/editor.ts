export type RatioPresetId = "9:16" | "1:1" | "4:5" | "3:2" | "16:9";

export interface AspectRatio {
  width: number;
  height: number;
}

export interface ImagePreset extends AspectRatio {
  id: RatioPresetId;
}

export interface EditorState {
  imageFile: File | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  imageName: string | null;
  setImage: (file: File, url: string, width: number, height: number) => void;
  clearImage: () => void;
}
