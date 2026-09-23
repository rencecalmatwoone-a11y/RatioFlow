"use client";

import { useRef, type ChangeEvent } from "react";
import { IMAGE_ACCEPT, useImage } from "@/hooks/useImage";
import { getRatioPreset } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";
import { ExportMenu } from "./ExportMenu";
import { ImageViewport } from "./ImageViewport";
import { RatioSelector } from "./RatioSelector";
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
  const setCrop = useEditorStore((state) => state.setCrop);
  const { loadImage, clearImage, error, reportError, isLoading } = useImage();
  const replaceInput = useRef<HTMLInputElement>(null);

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

  return (
    <section aria-label="Image editor" className="mx-auto w-full max-w-[760px]">
      <div className="mb-4 flex items-center justify-between px-1 text-[11px] font-medium tracking-[0.1em] text-[#858585] uppercase sm:mb-5">
        <span>Preview</span>
        <span>{getRatioPreset(selectedRatioId).label} frame</span>
      </div>
      <ImageViewport url={imageUrl} name={imageName} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1 text-xs text-[#858585]">
        <p className="min-w-0 truncate" title={imageName}>{imageName} · {imageWidth} × {imageHeight}</p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => setCrop({ x: 0, y: 0 })} className="text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Reset position</button>
          <input ref={replaceInput} type="file" accept={inputAccept} onChange={handleReplace} className="sr-only" tabIndex={-1} aria-label="Replace image file" />
          <button type="button" onClick={() => replaceInput.current?.click()} disabled={isLoading} aria-label="Replace image" className="text-[#555] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-50">Replace</button>
          <button type="button" onClick={clearImage} aria-label="Remove image" className="text-[#858585] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818]">Remove</button>
        </div>
      </div>
      {error && <p role="alert" className="mt-2 px-1 text-sm text-[#a54747]">{error}</p>}
      <div className="mt-7 flex flex-col items-center gap-5 sm:mt-8">
        <RatioSelector />
        <ZoomControl />
        <ExportMenu />
      </div>
      <p className="mt-7 text-center text-xs text-[#858585]">Processed locally. Your image never leaves your device.</p>
    </section>
  );
}
