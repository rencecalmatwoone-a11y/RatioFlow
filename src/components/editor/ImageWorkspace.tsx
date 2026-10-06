"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { useImage } from "@/hooks/useImage";
import { IMAGE_INPUT_ACCEPT } from "@/constants/batchLimits";
import { getActiveRatio, getMatchingRatioPreset } from "@/lib/ratios";
import { calculateExportGeometry } from "@/lib/exportImage";
import { getPlatformName, getPlatformPresetById } from "@/constants/platformPresets";
import { getSafeZoneForPreset } from "@/constants/safeZones";
import { useEditorStore, selectActiveEditor, selectActiveImage } from "@/store/editorStore";
import { BatchImageNavigator } from "./BatchImageNavigator";
import { ExportMenu } from "./ExportMenu";
import { ImageViewport } from "./ImageViewport";
import { RatioSelector } from "./RatioSelector";
import { PlatformPresetSelector } from "./PlatformPresetSelector";
import { UploadArea } from "./UploadArea";
import { ZoomControl } from "./ZoomControl";

export function ImageWorkspace() {
  const activeImageId = useEditorStore((state) => state.activeImageId);
  const imageUrl = useEditorStore((state) => selectActiveImage(state)?.objectUrl);
  const imageName = useEditorStore((state) => selectActiveImage(state)?.name);
  const imageWidth = useEditorStore((state) => selectActiveImage(state)?.width);
  const imageHeight = useEditorStore((state) => selectActiveImage(state)?.height);
  const imageCount = useEditorStore((state) => state.batchImages.length);
  const isExporting = useEditorStore((state) => state.isExporting);
  const removeImage = useEditorStore((state) => state.removeImage);
  const selectedRatioId = useEditorStore((state) => selectActiveEditor(state).selectedRatioId);
  const customRatio = useEditorStore((state) => selectActiveEditor(state).customRatio);
  const isManualRatio = useEditorStore((state) => selectActiveEditor(state).isManualRatio);
  const activePlatformPresetId = useEditorStore((state) => selectActiveEditor(state).activePlatformPresetId);
  const activePreset = getPlatformPresetById(activePlatformPresetId);
  const currentRatio = getActiveRatio(selectedRatioId, customRatio, activePlatformPresetId);
  const previewRatioLabel = isManualRatio
    ? getMatchingRatioPreset(currentRatio.value)?.label ?? `${currentRatio.value.toFixed(2)}:1`
    : currentRatio.label;
  const safeZone = selectedRatioId === "platform" ? getSafeZoneForPreset(activePlatformPresetId) : undefined;
  const showSafeZone = useEditorStore((state) => selectActiveEditor(state).showSafeZone);
  const setShowSafeZone = useEditorStore((state) => state.setShowSafeZone);
  const resetPosition = useEditorStore((state) => state.resetPosition);
  const resetEditor = useEditorStore((state) => state.resetEditor);
  const resetImage = useEditorStore((state) => state.resetImage);
  const exportSize = useEditorStore((state) => state.exportSize);
  const exportPresetId = useEditorStore((state) => state.exportSize.platformPresetId ?? null);
  const zoom = useEditorStore((state) => selectActiveEditor(state).zoom);
  const viewMode = useEditorStore((state) => selectActiveEditor(state).viewMode);
  const { loadImages, isLoading, status, issues, clearFeedback } = useImage();
  const replaceInput = useRef<HTMLInputElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const importFeedback = issues.length > 0 && (
    <details className={`mt-2 text-xs ${issues.every((issue) => issue.code === "duplicate") ? "text-[#777]" : "text-[#a54747]"}`}>
      <summary className="min-h-11 cursor-pointer py-3">Review {issues.length} skipped {issues.length === 1 ? "file" : "files"}</summary>
      <ul className="space-y-1 break-words">{issues.map((issue, index) => <li key={index}>{issue.name}: {issue.reason}</li>)}</ul>
    </details>
  );
  let outputDimensions: { width: number; height: number } | null = null;
  if (imageWidth && imageHeight) {
    try {
      const outputPreset = exportSize.preset === "preset" ? getPlatformPresetById(exportPresetId) : activePreset;
      const geometry = calculateExportGeometry(imageWidth, imageHeight, currentRatio, { x: 0.5, y: 0.5 }, zoom, viewMode, exportSize, undefined, outputPreset);
      outputDimensions = { width: geometry.outputWidth, height: geometry.outputHeight };
    } catch {
      // An image that is too small for the selected crop is reported in export options.
    }
  }
  const matchedRatio = getMatchingRatioPreset(currentRatio.value);
  const dimensionRatioLabel = matchedRatio?.label ?? (currentRatio.value >= 1
    ? `${currentRatio.value.toFixed(2)}:1`
    : `1:${(1 / currentRatio.value).toFixed(2)}`);

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes("Files")) event.preventDefault();
    };
    window.addEventListener("dragover", preventFileNavigation);
    window.addEventListener("drop", preventFileNavigation);
    return () => {
      window.removeEventListener("dragover", preventFileNavigation);
      window.removeEventListener("drop", preventFileNavigation);
    };
  }, []);

  function handleReplace(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (files.length) void loadImages(files, true);
  }

  function handleAdd(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void loadImages(files);
  }

  if (!imageUrl || !imageName || !imageWidth || !imageHeight) {
    return (
      <div className="mx-auto w-full max-w-[760px]">
        <div className="mx-auto mb-10 max-w-[650px] text-center sm:mb-12">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-[#6d6d68] uppercase">Your image, your ratio</p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.06em] text-[#181818] sm:text-5xl">Resize images to any aspect ratio. Instantly.</h1>
          <p className="mx-auto mt-5 max-w-[500px] text-sm leading-6 text-[#62625e] sm:text-base">Choose one or more images, adjust the frame, and download the result. Everything is processed locally in your browser.</p>
        </div>
        <UploadArea onImages={(files) => void loadImages(files)} status={status} isLoading={isLoading} />
        {importFeedback}
      </div>
    );
  }

  return (
    <section aria-label="Image editor" className="mx-auto w-full max-w-[760px]">
      <h1 className="sr-only">Adjust and download your image</h1>
      <div className="mb-4 flex items-center justify-between px-1 text-[11px] font-medium tracking-[0.1em] text-[#858585] uppercase sm:mb-5">
        <span>Preview</span>
        <span>{previewRatioLabel} frame</span>
      </div>
      <ImageViewport key={`${activeImageId}:${imageUrl}`} url={imageUrl} name={imageName} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-xs text-[#6b6b66]">
        <div className="min-w-0">
          <p className="truncate font-medium text-[#343430]" title={imageName}>{imageName}</p>
          <output id="image-output-info" aria-label="Current output dimensions and aspect ratio" aria-live="off" className="mt-1 block">{outputDimensions ? `${outputDimensions.width} × ${outputDimensions.height}` : "Output unavailable"} <span aria-hidden="true">·</span> {dimensionRatioLabel} <span className="sr-only">aspect ratio</span></output>
          <p className="mt-1 text-[#858580]">Original {imageWidth} × {imageHeight}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={resetPosition} className="min-h-11 text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Reset position</button>
          <button type="button" onClick={imageCount > 1 ? resetImage : resetEditor} className="min-h-11 text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">{imageCount > 1 ? "Reset Image" : "Reset"}</button>
          <input ref={replaceInput} type="file" accept={IMAGE_INPUT_ACCEPT} onChange={handleReplace} className="sr-only" tabIndex={-1} aria-label="Replace image file" disabled={isLoading || isExporting} />
          <input ref={addInput} type="file" multiple accept={IMAGE_INPUT_ACCEPT} onChange={handleAdd} className="sr-only" tabIndex={-1} aria-label="Add image files" disabled={isLoading || isExporting} />
          <button type="button" onClick={() => replaceInput.current?.click()} disabled={isLoading || isExporting} aria-label="Replace image" className="min-h-11 text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">Replace Image</button>
          {imageCount === 1 && <button type="button" onClick={() => addInput.current?.click()} disabled={isLoading || isExporting} className="min-h-11 text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">+ Add images</button>}
          <button type="button" onClick={() => { if (activeImageId) removeImage(activeImageId); clearFeedback(); }} disabled={isLoading || isExporting} aria-label="Remove image" className="min-h-11 text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">Remove</button>
        </div>
      </div>
      <p role="status" aria-live="polite" className="mt-2 px-1 text-xs text-[#62625e] empty:hidden">{status}</p>
      {importFeedback}
      <div className="mt-7 flex flex-col items-center gap-5 sm:mt-8">
        <div className="flex flex-col items-center gap-1">
          <PlatformPresetSelector />
          {activePreset && <p className="text-center text-[11px] text-[#777]">{getPlatformName(activePreset.platform)} · {activePreset.name} · {activePreset.width} × {activePreset.height}</p>}
          <button
            type="button"
            aria-label="Show platform safe-zone guide"
            aria-pressed={showSafeZone}
            onClick={() => setShowSafeZone(!showSafeZone)}
            disabled={!safeZone}
            className="mt-1 inline-flex min-h-11 items-center gap-2 rounded-full px-2 text-xs text-[#62625e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:cursor-not-allowed disabled:opacity-45"
          >
            Safe zone
            <span aria-hidden="true" className={`relative h-[18px] w-8 rounded-full transition-colors motion-reduce:transition-none ${showSafeZone ? "bg-[#454540]" : "bg-[#d4d4cf]"}`}>
              <span className={`absolute top-[3px] size-3 rounded-full bg-white shadow-sm transition-[left] duration-200 motion-reduce:transition-none ${showSafeZone ? "left-[17px]" : "left-[3px]"}`} />
            </span>
          </button>
          {showSafeZone && safeZone && <p className="max-w-[20rem] px-2 text-center text-[11px] leading-snug text-[#777]">Shaded areas may be covered by platform interface elements.</p>}
          {activePreset && !safeZone && <p className="text-center text-[11px] text-[#858585]">No safe-zone guide for this preset.</p>}
        </div>
        <RatioSelector />
        <ZoomControl />
        <BatchImageNavigator onAddImages={() => addInput.current?.click()} onClear={clearFeedback} />
        <ExportMenu />
      </div>
      <p className="mt-7 text-center text-xs text-[#858585]">Processed locally. Your images never leave your device.</p>
    </section>
  );
}
