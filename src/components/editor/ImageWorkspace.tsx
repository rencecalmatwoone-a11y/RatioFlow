"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { IMAGE_ACCEPT, useImage } from "@/hooks/useImage";
import { getActiveRatio, getMatchingRatioPreset } from "@/lib/ratios";
import { calculateExportGeometry } from "@/lib/exportImage";
import { getPlatformName, getPlatformPresetById } from "@/constants/platformPresets";
import { getSafeZoneForPreset } from "@/constants/safeZones";
import { useEditorStore } from "@/store/editorStore";
import { ExportMenu } from "./ExportMenu";
import { ImageViewport } from "./ImageViewport";
import { RatioSelector } from "./RatioSelector";
import { PlatformPresetSelector } from "./PlatformPresetSelector";
import { UploadArea } from "./UploadArea";
import { ZoomControl } from "./ZoomControl";

const inputAccept = Object.entries(IMAGE_ACCEPT)
  .flatMap(([mime, extensions]) => [mime, ...extensions])
  .join(",");

export function ImageWorkspace() {
  const imageUrl = useEditorStore((state) => state.imageUrl);
  const imageName = useEditorStore((state) => state.imageName);
  const imageWidth = useEditorStore((state) => state.imageWidth);
  const imageHeight = useEditorStore((state) => state.imageHeight);
  const selectedRatioId = useEditorStore((state) => state.selectedRatioId);
  const customRatio = useEditorStore((state) => state.customRatio);
  const isManualRatio = useEditorStore((state) => state.isManualRatio);
  const activePlatformPresetId = useEditorStore((state) => state.activePlatformPresetId);
  const activePreset = getPlatformPresetById(activePlatformPresetId);
  const currentRatio = getActiveRatio(selectedRatioId, customRatio, activePlatformPresetId);
  const previewRatioLabel = isManualRatio
    ? getMatchingRatioPreset(currentRatio.value)?.label ?? `${currentRatio.value.toFixed(2)}:1`
    : currentRatio.label;
  const safeZone = selectedRatioId === "platform" ? getSafeZoneForPreset(activePlatformPresetId) : undefined;
  const showSafeZone = useEditorStore((state) => state.showSafeZone);
  const setShowSafeZone = useEditorStore((state) => state.setShowSafeZone);
  const resetPosition = useEditorStore((state) => state.resetPosition);
  const resetEditor = useEditorStore((state) => state.resetEditor);
  const exportSize = useEditorStore((state) => state.exportSize);
  const zoom = useEditorStore((state) => state.zoom);
  const viewMode = useEditorStore((state) => state.viewMode);
  const { loadImage, clearImage, error, reportError, isLoading } = useImage();
  const replaceInput = useRef<HTMLInputElement>(null);
  let outputDimensions: { width: number; height: number } | null = null;
  if (imageWidth && imageHeight) {
    try {
      const geometry = calculateExportGeometry(imageWidth, imageHeight, currentRatio, { x: 0.5, y: 0.5 }, zoom, viewMode, exportSize, undefined, activePreset);
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
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadImage(file);
  }

  if (!imageUrl || !imageName || !imageWidth || !imageHeight) {
    return (
      <div className="mx-auto w-full max-w-[760px]">
        <div className="mx-auto mb-10 max-w-[650px] text-center sm:mb-12">
          <p className="mb-4 text-[11px] font-semibold tracking-[0.18em] text-[#6d6d68] uppercase">Your image, your ratio</p>
          <h1 className="text-4xl font-semibold leading-[1.08] tracking-[-0.06em] text-[#181818] sm:text-5xl">Resize images to any aspect ratio. Instantly.</h1>
          <p className="mx-auto mt-5 max-w-[500px] text-sm leading-6 text-[#62625e] sm:text-base">Choose an image, adjust the frame, and download the result. Everything is processed locally in your browser.</p>
        </div>
        <UploadArea onImage={(file) => void loadImage(file)} onError={reportError} error={error} isLoading={isLoading} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <section aria-label="Image editor" className="mx-auto w-full max-w-[760px]">
        <div role="status" className="flex min-h-80 items-center justify-center rounded-[24px] border border-[#e8e8e6] bg-white text-sm text-[#62625e] shadow-[0_12px_35px_rgba(0,0,0,0.04)]">
          Preparing image...
        </div>
      </section>
    );
  }

  return (
    <section aria-label="Image editor" className="mx-auto w-full max-w-[760px]">
      <h1 className="sr-only">Adjust and download your image</h1>
      <div className="mb-4 flex items-center justify-between px-1 text-[11px] font-medium tracking-[0.1em] text-[#858585] uppercase sm:mb-5">
        <span>Preview</span>
        <span>{previewRatioLabel} frame</span>
      </div>
      <ImageViewport url={imageUrl} name={imageName} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-xs text-[#6b6b66]">
        <div className="min-w-0">
          <p className="truncate font-medium text-[#343430]" title={imageName}>{imageName}</p>
          <output id="image-output-info" aria-label="Current output dimensions and aspect ratio" aria-live="off" className="mt-1 block">{outputDimensions ? `${outputDimensions.width} × ${outputDimensions.height}` : "Output unavailable"} <span aria-hidden="true">·</span> {dimensionRatioLabel} <span className="sr-only">aspect ratio</span></output>
          <p className="mt-1 text-[#858580]">Original {imageWidth} × {imageHeight}</p>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <button type="button" onClick={resetPosition} className="min-h-11 text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Reset position</button>
          <button type="button" onClick={resetEditor} className="min-h-11 text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Reset</button>
          <input ref={replaceInput} type="file" accept={inputAccept} onChange={handleReplace} className="sr-only" tabIndex={-1} aria-label="Replace image file" />
          <button type="button" onClick={() => replaceInput.current?.click()} disabled={isLoading} aria-label="Replace image" className="min-h-11 text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">Replace Image</button>
          <button type="button" onClick={clearImage} aria-label="Remove image" className="min-h-11 text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Remove</button>
        </div>
      </div>
      {error && <p role="status" className="mt-2 px-1 text-sm text-[#a54747]">{error}</p>}
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
        <ExportMenu />
      </div>
      <p className="mt-7 text-center text-xs text-[#858585]">Processed locally. Your image never leaves your device.</p>
    </section>
  );
}
