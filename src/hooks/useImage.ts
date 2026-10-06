import { useCallback, useEffect, useRef, useState } from "react";
import { prepareBatchImages, releaseImageUrls, selectActiveImage, summarizeImageImport, type ImageImportIssue } from "@/lib/batchImages";
import { useEditorStore } from "@/store/editorStore";

export function useImage() {
  const [status, setStatus] = useState<string | null>(null);
  const [issues, setIssues] = useState<ImageImportIssue[]>([]);
  const isLoading = useEditorStore((state) => state.isPreparingImages);
  const requestId = useRef(0);

  const loadImages = useCallback(async (files: readonly File[], replace = false) => {
    const state = useEditorStore.getState();
    if (!files.length || state.isExporting || state.isPreparingImages) return;
    const active = selectActiveImage(state);
    if (replace && !active) return;
    const currentRequest = ++requestId.current;
    state.setIsPreparingImages(true);
    setIssues([]);
    setStatus(`Preparing 1 of ${files.length} images...`);
    try {
      const result = await prepareBatchImages(replace ? files.slice(0, 1) : files,
        replace ? state.batchImages.filter((image) => image.id !== active?.id) : state.batchImages,
        active?.editor, (current, total) => {
          if (currentRequest === requestId.current) setStatus(`Preparing ${current} of ${total} images...`);
        }, () => currentRequest !== requestId.current);
      if (currentRequest !== requestId.current) {
        result.images.forEach(releaseImageUrls);
        return;
      }
      if (replace && active && result.images[0]) state.replaceImage(active.id, result.images[0]);
      else if (!replace) state.addImages(result.images);
      setIssues(result.issues);
      const count = result.images.length;
      setStatus(summarizeImageImport(files.length, count, result.issues, replace));
    } catch {
      if (currentRequest === requestId.current) setStatus("Could not prepare these images. Please try again.");
    } finally {
      if (currentRequest === requestId.current) useEditorStore.getState().setIsPreparingImages(false);
    }
  }, []);

  const clearFeedback = useCallback(() => { setStatus(null); setIssues([]); }, []);
  useEffect(() => () => {
    requestId.current += 1;
    // Export snapshots own Files, so unmounting can release all preview URLs safely.
    const state = useEditorStore.getState();
    state.batchImages.forEach(releaseImageUrls);
    useEditorStore.setState({ batchImages: [], activeImageId: null, isPreparingImages: false });
  }, []);

  return { loadImages, isLoading, status, issues, clearFeedback };
}
