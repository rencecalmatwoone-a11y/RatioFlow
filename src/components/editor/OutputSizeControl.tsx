import { useState } from "react";
import { calculateExportGeometry } from "@/lib/exportImage";
import { dimensionsFromSide, MAX_EXPORT_DIMENSION, MIN_OUTPUT_DIMENSION, parseOutputInput, requestedLongestSide } from "@/lib/exportDimensions";
import { getActiveRatio } from "@/lib/ratios";
import { getPlatformPresetById, getPlatformName } from "@/constants/platformPresets";
import { useEditorStore } from "@/store/editorStore";

export function OutputSizeControl({ onValidityChange }: { onValidityChange: (valid: boolean) => void }) {
  const size = useEditorStore((state) => state.exportSize);
  const setPreset = useEditorStore((state) => state.setExportSizePreset);
  const setCustomSide = useEditorStore((state) => state.setCustomExportSide);
  const ratioId = useEditorStore((state) => state.selectedRatioId);
  const customRatio = useEditorStore((state) => state.customRatio);
  const activePlatformPresetId = useEditorStore((state) => state.activePlatformPresetId);
  const imageWidth = useEditorStore((state) => state.imageWidth);
  const imageHeight = useEditorStore((state) => state.imageHeight);
  const zoom = useEditorStore((state) => state.zoom);
  const viewMode = useEditorStore((state) => state.viewMode);
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState("");
  const activePreset = getPlatformPresetById(activePlatformPresetId);
  const ratio = getActiveRatio(ratioId, customRatio, activePlatformPresetId);
  const requested = dimensionsFromSide(ratio, size.customSide, size.customAxis);
  let geometry = null;
  try {
    geometry = imageWidth && imageHeight
      ? calculateExportGeometry(imageWidth, imageHeight, ratio, { x: 0.5, y: 0.5 }, zoom, viewMode, size, undefined, activePreset)
      : null;
  } catch {
    // The export path will reject an image too small for the selected ratio.
  }
  const limit = geometry && (requestedLongestSide(ratio, size, activePreset) ?? 0) > Math.max(geometry.outputWidth, geometry.outputHeight);

  function edit(value: string, axis: "width" | "height") {
    setDraft(value);
    const parsed = parseOutputInput(value);
    if (parsed === null) {
      setError(`Enter a whole number from ${MIN_OUTPUT_DIMENSION} to ${MAX_EXPORT_DIMENSION}px.`);
      onValidityChange(false);
      return;
    }
    setCustomSide(parsed, axis);
    setError("");
    onValidityChange(true);
  }

  return (
    <div className="mt-4 border-t border-[#ececea] pt-3">
      <label htmlFor="export-size" className="mb-2 block text-xs font-medium">Size</label>
      <select id="export-size" value={size.preset} onChange={(event) => { setPreset(event.currentTarget.value as typeof size.preset); setDraft(null); setError(""); onValidityChange(true); }} className="min-h-11 w-full rounded-lg border border-[#dededb] bg-white px-3 text-base focus-visible:outline-2 focus-visible:outline-[#181818] sm:text-sm">
        <option value="original">Original / Maximum</option>
        {activePreset && <option value="preset">{getPlatformName(activePreset.platform)} · {activePreset.name} ({activePreset.width} × {activePreset.height})</option>}
        <option value="1080">1080px</option>
        <option value="1440">1440px</option>
        <option value="2160">2160px</option>
        <option value="custom">Custom</option>
      </select>
      {size.preset === "custom" && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(["width", "height"] as const).map((axis) => (
            <label key={axis} className="text-xs text-[#555]">{axis === "width" ? "Width" : "Height"}
              <input type="text" inputMode="numeric" value={size.customAxis === axis && draft !== null ? draft : String(requested[axis])} onChange={(event) => edit(event.target.value, axis)} onBlur={() => { if (!error) setDraft(null); }} aria-invalid={!!error && size.customAxis === axis} className="mt-1 block min-h-11 w-full rounded-lg border border-[#dededb] px-3 text-base text-[#242424]" />
            </label>
          ))}
          <p className="text-xs text-[#777] sm:col-span-2">Aspect ratio locked</p>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-[#a54747]">{error}</p>}
      {!geometry && !error && <p className="mt-2 text-xs text-[#a54747]">Image is too small for this ratio.</p>}
      {geometry && !error && <p className="mt-2 text-xs text-[#777]">Output: {geometry.outputWidth} × {geometry.outputHeight}{limit ? " · Limited to source resolution or safe Canvas size." : ""}</p>}
    </div>
  );
}
