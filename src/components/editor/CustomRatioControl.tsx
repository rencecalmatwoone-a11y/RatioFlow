import { useState } from "react";
import { parseRatioSide } from "@/lib/ratios";
import { useEditorStore } from "@/store/editorStore";

export function CustomRatioControl() {
  const customRatio = useEditorStore((state) => state.customRatio);
  const setCustomRatio = useEditorStore((state) => state.setCustomRatio);
  const [width, setWidth] = useState(String(customRatio.width));
  const [height, setHeight] = useState(String(customRatio.height));
  const [error, setError] = useState("");

  function apply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedWidth = parseRatioSide(width);
    const parsedHeight = parseRatioSide(height);
    if (parsedWidth === null || parsedHeight === null) {
      setError("Enter numbers from 0.1 to 100 for both sides.");
      return;
    }
    setCustomRatio(parsedWidth, parsedHeight);
    setWidth(String(parsedWidth));
    setHeight(String(parsedHeight));
    setError("");
  }

  return (
    <form onSubmit={apply} className="w-[min(100%,19rem)] rounded-2xl border border-[#dededb] bg-white p-4 shadow-sm">
      <p className="mb-3 text-xs font-medium text-[#242424]">Custom ratio</p>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-xs text-[#555]">Width ratio
          <input type="text" inputMode="decimal" value={width} onChange={(event) => { setWidth(event.target.value); setError(""); }} aria-invalid={!!error} className="mt-1 block min-h-11 w-full rounded-lg border border-[#dededb] px-3 text-base text-[#242424]" />
        </label>
        <label className="min-w-0 text-xs text-[#555]">Height ratio
          <input type="text" inputMode="decimal" value={height} onChange={(event) => { setHeight(event.target.value); setError(""); }} aria-invalid={!!error} className="mt-1 block min-h-11 w-full rounded-lg border border-[#dededb] px-3 text-base text-[#242424]" />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-[#777]">{customRatio.width}:{customRatio.height}</span>
        <button type="submit" className="min-h-11 rounded-full bg-[#1e1e1e] px-5 text-xs font-medium text-white">Apply</button>
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[#a54747]">{error}</p>}
    </form>
  );
}
