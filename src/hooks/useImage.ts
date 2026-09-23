import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/store/editorStore";

export const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
export const IMAGE_ACCEPT = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
};

export const IMAGE_ERRORS = {
  type: "Unsupported file type. Use JPEG, PNG, or WebP.",
  size: "Image is too large. Maximum size is 20 MB.",
  empty: "This image file is empty. Choose another file.",
  decode: "We couldn't read this image. Try another file.",
};

function decodeWithImage(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => reject(new Error("Image decoding failed"));
    image.src = url;
  });
}

async function getDimensions(file: File, url: string) {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return { width: bitmap.width, height: bitmap.height };
      } finally {
        bitmap.close();
      }
    } catch {
      // Some browsers cannot decode every supported image through ImageBitmap.
    }
  }
  return decodeWithImage(url);
}

export function useImage() {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const requestId = useRef(0);
  const pendingUrl = useRef<string | null>(null);
  const setImage = useEditorStore((state) => state.setImage);
  const clearStoredImage = useEditorStore((state) => state.clearImage);

  const clearImage = useCallback(() => {
    requestId.current += 1;
    if (pendingUrl.current) {
      URL.revokeObjectURL(pendingUrl.current);
      pendingUrl.current = null;
    }
    clearStoredImage();
    setError(null);
    setIsLoading(false);
  }, [clearStoredImage]);

  const reportError = useCallback((message: string) => {
    requestId.current += 1;
    if (pendingUrl.current) {
      URL.revokeObjectURL(pendingUrl.current);
      pendingUrl.current = null;
    }
    setIsLoading(false);
    setError(message);
  }, []);

  const loadImage = useCallback(async (file: File) => {
    const currentRequest = ++requestId.current;
    if (pendingUrl.current) {
      URL.revokeObjectURL(pendingUrl.current);
      pendingUrl.current = null;
    }
    setError(null);
    setIsLoading(false);

    if (!Object.hasOwn(IMAGE_ACCEPT, file.type)) {
      setError(IMAGE_ERRORS.type);
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError(IMAGE_ERRORS.size);
      return;
    }
    if (file.size === 0) {
      setError(IMAGE_ERRORS.empty);
      return;
    }

    let url: string;
    try {
      url = URL.createObjectURL(file);
    } catch {
      setError(IMAGE_ERRORS.decode);
      return;
    }
    pendingUrl.current = url;
    setIsLoading(true);
    try {
      const { width, height } = await getDimensions(file, url);
      if (currentRequest !== requestId.current) return;
      if (![width, height].every((side) => Number.isSafeInteger(side) && side > 0)) {
        throw new Error("Image has invalid dimensions");
      }
      setImage(file, url, width, height);
      pendingUrl.current = null;
      setError(null);
    } catch {
      if (currentRequest === requestId.current) setError(IMAGE_ERRORS.decode);
    } finally {
      if (pendingUrl.current === url) {
        URL.revokeObjectURL(url);
        pendingUrl.current = null;
      }
      if (currentRequest === requestId.current) setIsLoading(false);
    }
  }, [setImage]);

  useEffect(() => () => {
    requestId.current += 1;
    if (pendingUrl.current) URL.revokeObjectURL(pendingUrl.current);
    pendingUrl.current = null;
    clearStoredImage();
  }, [clearStoredImage]);

  return { loadImage, clearImage, error, reportError, isLoading };
}
