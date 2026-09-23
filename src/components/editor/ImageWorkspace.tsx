"use client";

import { useEffect, useRef, type ChangeEvent } from "react";
import { IMAGE_ACCEPT, useImage } from "@/hooks/useImage";
import { getActiveRatio, getMatchingRatioPreset } from "@/lib/ratios";
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
  const { loadImage, clearImage, error, reportError, isLoading } = useImage();
  const replaceInput = useRef<HTMLInputElement>(null);

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
      <div className="mb-4 flex items-center justify-between px-1 text-[11px] font-medium tracking-[0.1em] text-[#858585] uppercase sm:mb-5">
        <span>Preview</span>
        <span>{previewRatioLabel} frame</span>
      </div>
      <ImageViewport url={imageUrl} name={imageName} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-xs text-[#858585]">
        <p className="min-w-0 truncate" title={imageName}>{imageName} · {imageWidth} × {imageHeight}</p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={resetPosition} className="min-h-11 text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Reset position</button>
          <input ref={replaceInput} type="file" accept={inputAccept} onChange={handleReplace} className="sr-only" tabIndex={-1} aria-label="Replace image file" />
          <button type="button" onClick={() => replaceInput.current?.click()} disabled={isLoading} aria-label="Replace image" className="min-h-11 text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">Replace</button>
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
