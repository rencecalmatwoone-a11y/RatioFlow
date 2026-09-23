import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { cropToFocalPoint, focalPointToCrop, type CropGeometry } from "@/lib/focalPoint";
import { getActiveRatio } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";
import type { CropPosition } from "@/types/editor";

interface ImageViewportProps {
  url: string;
  name: string;
}

export function ImageViewport({ url, name }: ImageViewportProps) {
  const selectedRatioId = useEditorStore((state) => state.selectedRatioId);
  const customRatio = useEditorStore((state) => state.customRatio);
  const activePlatformPresetId = useEditorStore((state) => state.activePlatformPresetId);
  const crop = useEditorStore((state) => state.crop);
  const setCrop = useEditorStore((state) => state.setCrop);
  const focalPoint = useEditorStore((state) => state.focalPoint);
  const setFocalPoint = useEditorStore((state) => state.setFocalPoint);
  const zoom = useEditorStore((state) => state.zoom);
  const minZoom = useEditorStore((state) => state.minZoom);
  const maxZoom = useEditorStore((state) => state.maxZoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const viewMode = useEditorStore((state) => state.viewMode);
  const [isDragging, setIsDragging] = useState(false);
  const mediaSize = useRef<{ width: number; height: number } | null>(null);
  const cropSize = useRef<{ width: number; height: number } | null>(null);
  const interaction = useRef(false);
  const frame = useRef<number | null>(null);
  const ratio = getActiveRatio(selectedRatioId, customRatio, activePlatformPresetId);

  const applyFocalPoint = useCallback(() => {
    if (interaction.current || !mediaSize.current || !cropSize.current) return;
    const state = useEditorStore.getState();
    if (state.viewMode !== "fill") return;
    const geometry: CropGeometry = {
      mediaWidth: mediaSize.current.width,
      mediaHeight: mediaSize.current.height,
      viewportWidth: cropSize.current.width,
      viewportHeight: cropSize.current.height,
      zoom: state.zoom,
    };
    const next = focalPointToCrop(state.focalPoint, geometry);
    if (Math.abs(next.x - state.crop.x) > 0.01 || Math.abs(next.y - state.crop.y) > 0.01) {
      state.setCrop(next);
    }
  }, []);

  const scheduleFocalPoint = useCallback(() => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      applyFocalPoint();
    });
  }, [applyFocalPoint]);

  useLayoutEffect(() => {
    if (interaction.current) return;
    // Reuse the last measured geometry immediately; the cropper reports new sizes as the frame animates.
    applyFocalPoint();
    scheduleFocalPoint();
  }, [selectedRatioId, customRatio, activePlatformPresetId, zoom, viewMode, focalPoint, applyFocalPoint, scheduleFocalPoint]);

  useEffect(() => () => {
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, []);

  const handleCropChange = (next: CropPosition) => {
    setCrop(next);
    if (!interaction.current || !mediaSize.current || !cropSize.current) return;
    const geometry: CropGeometry = {
      mediaWidth: mediaSize.current.width,
      mediaHeight: mediaSize.current.height,
      viewportWidth: cropSize.current.width,
      viewportHeight: cropSize.current.height,
      zoom: useEditorStore.getState().zoom,
    };
    setFocalPoint(cropToFocalPoint(next, geometry));
  };

  return (
    <div
      className="ratio-viewport relative mx-auto overflow-hidden rounded-[20px] border border-black/[0.07] bg-[#e8e7de] shadow-[0_12px_35px_rgba(0,0,0,0.07),0_2px_8px_rgba(0,0,0,0.03)] sm:rounded-[24px]"
      style={{
        width: `min(100%, ${80 * ratio.value}svh, ${650 * ratio.value}px)`,
        aspectRatio: `${ratio.width} / ${ratio.height}`,
      }}
    >
      <Cropper
        image={url}
        crop={crop}
        onCropChange={handleCropChange}
        zoom={zoom}
        minZoom={minZoom}
        maxZoom={maxZoom}
        onZoomChange={setZoom}
        zoomWithScroll={false}
        aspect={ratio.value}
        objectFit={viewMode === "fill" ? "cover" : "contain"}
        restrictPosition
        showGrid={false}
        keyboardStep={8}
        onTouchRequest={(event) => event.touches.length <= 2}
        onInteractionStart={({ source }) => {
          interaction.current = true;
          if (frame.current !== null) cancelAnimationFrame(frame.current);
          frame.current = null;
          if (source === "mouse" || source === "touch") setIsDragging(true);
        }}
        onInteractionEnd={() => {
          interaction.current = false;
          setIsDragging(false);
          scheduleFocalPoint();
        }}
        setMediaSize={(size) => {
          mediaSize.current = size;
          scheduleFocalPoint();
        }}
        setCropSize={(size) => {
          cropSize.current = size;
          scheduleFocalPoint();
        }}
        style={{
          containerStyle: { cursor: isDragging ? "grabbing" : "grab" },
          cropAreaStyle: { border: 0, boxShadow: "none" },
        }}
        classes={{ cropAreaClassName: "ratio-crop-area" }}
        cropperProps={{ "aria-label": `Reposition ${name}. Use arrow keys to move the image.` }}
        mediaProps={{ draggable: false }}
      />
    </div>
  );
}
