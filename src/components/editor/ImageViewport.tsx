import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import Cropper from "react-easy-crop";
import { cropToFocalPoint, focalPointToCrop, type CropGeometry } from "@/lib/focalPoint";
import { getActiveRatio, getMatchingRatioPreset } from "@/lib/ratios";
import { getSafeZoneForPreset } from "@/constants/safeZones";
import { useEditorStore, selectActiveEditor, selectActiveImage } from "@/store/editorStore";
import type { CropPosition } from "@/types/editor";
import { SafeZoneOverlay } from "./SafeZoneOverlay";

interface ImageViewportProps {
  url: string;
  name: string;
}

export function ImageViewport({ url, name }: ImageViewportProps) {
  const selectedRatioId = useEditorStore((state) => selectActiveEditor(state).selectedRatioId);
  const customRatio = useEditorStore((state) => selectActiveEditor(state).customRatio);
  const manualFrameWidth = useEditorStore((state) => selectActiveEditor(state).manualFrameWidth);
  const setManualRatio = useEditorStore((state) => state.setManualRatio);
  const activePlatformPresetId = useEditorStore((state) => selectActiveEditor(state).activePlatformPresetId);
  const showSafeZone = useEditorStore((state) => selectActiveEditor(state).showSafeZone);
  const crop = useEditorStore((state) => selectActiveEditor(state).crop);
  const setCrop = useEditorStore((state) => state.setCrop);
  const focalPoint = useEditorStore((state) => selectActiveEditor(state).focalPoint);
  const setFocalPoint = useEditorStore((state) => state.setFocalPoint);
  const zoom = useEditorStore((state) => selectActiveEditor(state).zoom);
  const minZoom = useEditorStore((state) => state.minZoom);
  const maxZoom = useEditorStore((state) => state.maxZoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const viewMode = useEditorStore((state) => selectActiveEditor(state).viewMode);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error">("loading");
  const viewport = useRef<HTMLDivElement>(null);
  const resize = useRef<{ pointerId: number; side: "left" | "right"; startX: number; startWidth: number; startHeight: number; workspaceWidth: number; minWidth: number } | null>(null);
  const pendingResize = useRef<{ ratio: number; width: number } | null>(null);
  const resizeFrame = useRef<number | null>(null);
  const mediaSize = useRef<{ width: number; height: number } | null>(null);
  const cropSize = useRef<{ width: number; height: number } | null>(null);
  const interaction = useRef(false);
  const frame = useRef<number | null>(null);
  const ratio = getActiveRatio(selectedRatioId, customRatio, activePlatformPresetId);
  const safeZone = selectedRatioId === "platform" ? getSafeZoneForPreset(activePlatformPresetId) : undefined;
  const matchedPreset = getMatchingRatioPreset(ratio.value);

  const commitResize = useCallback(() => {
    resizeFrame.current = null;
    const next = pendingResize.current;
    pendingResize.current = null;
    if (next) setManualRatio(next.ratio, next.width);
  }, [setManualRatio]);

  const queueResize = useCallback((value: number, width: number) => {
    pendingResize.current = { ratio: value, width };
    if (resizeFrame.current === null) resizeFrame.current = requestAnimationFrame(commitResize);
  }, [commitResize]);

  const stopResize = useCallback((event: PointerEvent<HTMLElement>) => {
    if (resize.current?.pointerId !== event.pointerId) return;
    event.stopPropagation();
    if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
    commitResize();
    resize.current = null;
    setIsResizing(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }, [commitResize]);

  const beginResize = (side: "left" | "right", event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !viewport.current) return;
    event.preventDefault();
    event.stopPropagation();
    const bounds = viewport.current.getBoundingClientRect();
    const workspaceWidth = viewport.current.parentElement?.clientWidth ?? bounds.width;
    resize.current = {
      pointerId: event.pointerId, side, startX: event.clientX,
      startWidth: bounds.width, startHeight: bounds.height,
      workspaceWidth, minWidth: Math.min(120, workspaceWidth * 0.45),
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsResizing(true);
  };

  const moveResize = (event: PointerEvent<HTMLDivElement>) => {
    const drag = resize.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    event.preventDefault();
    event.stopPropagation();
    const direction = drag.side === "left" ? -1 : 1;
    const desiredWidth = drag.startWidth + 2 * direction * (event.clientX - drag.startX);
    const minRatio = Math.max(0.4, drag.minWidth / drag.startHeight);
    const nextRatio = Math.max(minRatio, Math.min(4, desiredWidth / drag.startHeight));
    queueResize(nextRatio, Math.min(drag.workspaceWidth, nextRatio * drag.startHeight));
  };

  const keyboardResize = (side: "left" | "right", event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const direction = side === "left" ? -1 : 1;
    const delta = (event.key === "ArrowRight" ? 1 : -1) * direction * (event.shiftKey ? 0.1 : 0.02);
    const nextRatio = Math.max(0.4, Math.min(4, ratio.value + delta));
    const bounds = viewport.current?.getBoundingClientRect();
    const workspaceWidth = viewport.current?.parentElement?.clientWidth ?? bounds?.width ?? 760;
    const height = bounds?.height ?? 650;
    setManualRatio(nextRatio, Math.min(workspaceWidth, nextRatio * height));
  };

  const applyFocalPoint = useCallback(() => {
    if (interaction.current || !mediaSize.current || !cropSize.current) return;
    const state = useEditorStore.getState();
    const active = selectActiveImage(state);
    if (active?.objectUrl !== url || active.editor.viewMode !== "fill") return;
    const editor = active.editor;
    const geometry: CropGeometry = {
      mediaWidth: mediaSize.current.width,
      mediaHeight: mediaSize.current.height,
      viewportWidth: cropSize.current.width,
      viewportHeight: cropSize.current.height,
      zoom: editor.zoom,
    };
    const next = focalPointToCrop(editor.focalPoint, geometry);
    if (Math.abs(next.x - editor.crop.x) > 0.01 || Math.abs(next.y - editor.crop.y) > 0.01) {
      state.setCrop(next);
    }
  }, [url]);

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
    if (resizeFrame.current !== null) cancelAnimationFrame(resizeFrame.current);
  }, []);

  const handleCropChange = (next: CropPosition) => {
    if (selectActiveImage(useEditorStore.getState())?.objectUrl !== url) return;
    setCrop(next);
    if (!interaction.current || !mediaSize.current || !cropSize.current) return;
    const geometry: CropGeometry = {
      mediaWidth: mediaSize.current.width,
      mediaHeight: mediaSize.current.height,
      viewportWidth: cropSize.current.width,
      viewportHeight: cropSize.current.height,
      zoom: selectActiveEditor(useEditorStore.getState()).zoom,
    };
    setFocalPoint(cropToFocalPoint(next, geometry));
  };

  return (
    <div
      ref={viewport}
      aria-busy={previewState === "loading"}
      className={`ratio-viewport relative mx-auto overflow-hidden rounded-[20px] border border-black/[0.07] bg-[#e8e7de] shadow-[0_12px_35px_rgba(0,0,0,0.07),0_2px_8px_rgba(0,0,0,0.03)] sm:rounded-[24px] ${isResizing ? "ratio-viewport--resizing" : ""}`}
      style={{
        width: manualFrameWidth === null
          ? `min(100%, ${80 * ratio.value}svh, ${650 * ratio.value}px)`
          : `min(100%, ${manualFrameWidth}px, ${80 * ratio.value}svh, ${650 * ratio.value}px)`,
        aspectRatio: `${ratio.width} / ${ratio.height}`,
      }}
    >
      <div className="ratio-canvas">
        <Cropper
          image={url}
          crop={crop}
          onCropChange={handleCropChange}
          zoom={zoom}
          minZoom={minZoom}
          maxZoom={maxZoom}
          onZoomChange={setZoom}
          onMediaLoaded={() => setPreviewState("ready")}
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
            mediaStyle: { visibility: previewState === "ready" ? "visible" : "hidden" },
          }}
          classes={{ cropAreaClassName: "ratio-crop-area" }}
          cropperProps={{ "aria-label": `Reposition ${name}. Use arrow keys to move the image.` }}
          mediaProps={{ draggable: false, onError: () => setPreviewState("error") }}
        />
        {previewState !== "ready" && <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#e8e7de] px-6 text-center text-xs text-[#777]">{previewState === "loading" ? "Loading preview…" : "Preview unavailable. Replace this image to continue."}</div>}
        {safeZone && <SafeZoneOverlay key={safeZone.presetId} guide={safeZone} visible={showSafeZone} />}
      </div>
      {(["left", "right"] as const).map((side) => (
        <div
          key={side}
          role="slider"
          tabIndex={0}
          aria-label={`Resize image from ${side} edge`}
          aria-orientation="horizontal"
          aria-valuemin={Math.min(0.4, ratio.value)}
          aria-valuemax={Math.max(4, ratio.value)}
          aria-valuenow={Number(ratio.value.toFixed(3))}
          aria-valuetext={matchedPreset?.label ?? `${ratio.value.toFixed(2)}:1`}
          aria-describedby="resize-handle-help"
          className={`ratio-resize-handle ratio-resize-handle--${side} ${isResizing && resize.current?.side === side ? "ratio-resize-handle--active" : ""}`}
          onPointerDown={(event) => beginResize(side, event)}
          onPointerMove={moveResize}
          onPointerUp={stopResize}
          onPointerCancel={stopResize}
          onLostPointerCapture={stopResize}
          onKeyDown={(event) => keyboardResize(side, event)}
        >
          <span className="ratio-resize-grip" aria-hidden="true" />
        </div>
      ))}
      <span id="resize-handle-help" className="sr-only">Drag this edge, or use left and right arrow keys to resize the image frame. Hold Shift for larger keyboard steps.</span>
      {isResizing && (
        <div className="ratio-drag-label" aria-hidden="true">{matchedPreset?.label ?? `${ratio.value.toFixed(2)}:1`}</div>
      )}
    </div>
  );
}
