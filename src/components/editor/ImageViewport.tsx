import { useState } from "react";
import Cropper from "react-easy-crop";
import { getRatioPreset } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";

interface ImageViewportProps {
  url: string;
  name: string;
}

export function ImageViewport({ url, name }: ImageViewportProps) {
  const selectedRatioId = useEditorStore((state) => state.selectedRatioId);
  const crop = useEditorStore((state) => state.crop);
  const setCrop = useEditorStore((state) => state.setCrop);
  const zoom = useEditorStore((state) => state.zoom);
  const minZoom = useEditorStore((state) => state.minZoom);
  const maxZoom = useEditorStore((state) => state.maxZoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const viewMode = useEditorStore((state) => state.viewMode);
  const [isDragging, setIsDragging] = useState(false);
  const ratio = getRatioPreset(selectedRatioId);

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
        onCropChange={setCrop}
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
          if (source === "mouse" || source === "touch") setIsDragging(true);
        }}
        onInteractionEnd={() => setIsDragging(false)}
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
