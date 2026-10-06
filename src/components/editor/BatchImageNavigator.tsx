"use client";

import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { selectActiveEditor, useEditorStore } from "@/store/editorStore";
import { MAX_BATCH_IMAGES } from "@/constants/batchLimits";
import { getActiveRatio } from "@/lib/ratios";
import { getPlatformPresetById } from "@/constants/platformPresets";

const controlClass = "min-h-11 rounded-md px-2 text-xs text-[#62625e] hover:bg-[#ececea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-40";

const BatchImageThumbnail = memo(function BatchImageThumbnail({ id, active, disabled }: { id: string; active: boolean; disabled: boolean }) {
  const metadata = useEditorStore(useShallow((state) => {
    const image = state.batchImages.find((item) => item.id === id);
    return { name: image?.name, thumbnailUrl: image?.thumbnailUrl, isEdited: image?.isEdited };
  }));
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const select = useEditorStore((state) => state.setActiveImage);
  const remove = useEditorStore((state) => state.removeImage);
  if (!metadata.name) return null;
  return (
    <li className="w-16 shrink-0">
      <button type="button" data-image-id={id} aria-label={`Edit ${metadata.name}${metadata.isEdited ? ", edited" : ""}`} aria-current={active ? "true" : undefined}
        onClick={() => select(id)}
        className={`relative block h-16 w-16 overflow-hidden rounded-lg border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] ${active ? "border-[#454540] bg-white" : "border-transparent hover:border-[#ccc]"}`}>
        {/* Small local previews keep the rail from decoding full originals. */}
        {!metadata.thumbnailUrl || failedUrl === metadata.thumbnailUrl
          ? <span aria-hidden="true" className="flex h-full items-center justify-center rounded bg-[#e8e8e5] text-[10px] text-[#777]">Preview</span>
          : <img src={metadata.thumbnailUrl} alt="" width={56} height={56} loading="lazy" draggable={false} onError={() => setFailedUrl(metadata.thumbnailUrl ?? null)} className="h-full w-full rounded object-cover" />}
        {metadata.isEdited && <span aria-hidden="true" className="absolute right-1 bottom-1 size-2 rounded-full bg-[#454540] ring-2 ring-white" />}
      </button>
      <p className="mt-1 truncate text-center text-[10px] text-[#777]" title={metadata.name}>{metadata.name}</p>
      <button type="button" aria-label={`Remove ${metadata.name} from batch`} disabled={disabled}
        onClick={() => {
          remove(id);
          // Keep focus in the queue after the focused remove control disappears.
          const next = useEditorStore.getState().activeImageId;
          requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`button[data-image-id="${next}"]`)?.focus({ preventScroll: true }));
        }} className="min-h-11 w-full rounded text-[10px] text-[#858580] hover:text-[#a54747] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-40">Remove</button>
    </li>
  );
});

export function BatchImageNavigator({ onAddImages, onClear }: { onAddImages: () => void; onClear: () => void }) {
  const ids = useEditorStore(useShallow((state) => state.batchImages.map((image) => image.id)));
  const activeId = useEditorStore((state) => state.activeImageId);
  const editedCount = useEditorStore((state) => state.batchImages.filter((image) => image.isEdited).length);
  const ratioSettings = useEditorStore(useShallow((state) => {
    const editor = selectActiveEditor(state);
    return { id: editor.selectedRatioId, custom: editor.customRatio, preset: editor.activePlatformPresetId };
  }));
  const select = useEditorStore((state) => state.setActiveImage);
  const clear = useEditorStore((state) => state.clearBatch);
  const applyRatio = useEditorStore((state) => state.applyRatioToAll);
  const disabled = useEditorStore((state) => state.isExporting || state.isPreparingImages);
  const [confirmClear, setConfirmClear] = useState(false);
  const [appliedStatus, setAppliedStatus] = useState("");
  const rail = useRef<HTMLUListElement>(null);
  const clearTrigger = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const activeIndex = ids.indexOf(activeId ?? "");
  const currentRatio = ratioSettings.id ? getActiveRatio(ratioSettings.id, ratioSettings.custom, ratioSettings.preset) : null;
  const ratioLabel = ratioSettings.id === "platform"
    ? getPlatformPresetById(ratioSettings.preset)?.name ?? currentRatio?.label
    : ratioSettings.id === "free" ? "original ratios" : currentRatio?.label;

  useEffect(() => {
    const element = rail.current;
    if (!element) return;
    function reveal() {
      const item = element?.querySelector<HTMLButtonElement>(`button[data-image-id="${activeId}"]`)?.closest("li");
      if (!item || !element) return;
      const left = item.getBoundingClientRect().left - element.getBoundingClientRect().left + element.scrollLeft;
      const right = left + item.offsetWidth;
      const current = element.scrollLeft;
      const target = left < current ? left : right > current + element.clientWidth ? right - element.clientWidth : current;
      element.scrollTo({ left: target, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    }
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeId, ids.length]);

  useEffect(() => { if (confirmClear) confirmButton.current?.focus(); }, [confirmClear]);

  function navigate(direction: number, focus = false) {
    const id = ids[Math.max(0, Math.min(ids.length - 1, activeIndex + direction))];
    if (!id) return;
    select(id);
    if (focus) rail.current?.querySelector<HTMLButtonElement>(`button[data-image-id="${id}"]`)?.focus({ preventScroll: true });
  }

  function handleKeys(event: KeyboardEvent<HTMLUListElement>) {
    // Only thumbnail-selection buttons own arrow navigation. Sliders, inputs, and crop keys stay local.
    if (!(event.target instanceof HTMLButtonElement) || !event.target.dataset.imageId) return;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    navigate(event.key === "ArrowLeft" ? -1 : 1, true);
  }

  if (ids.length < 2) return null;
  return (
    <section aria-label="Batch images" className="mt-6 w-full min-w-0 border-t border-[#e2e2df] pt-3">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-1">
          <button type="button" aria-label="Previous image" disabled={activeIndex <= 0} onClick={() => navigate(-1)} className={controlClass}>←</button>
          <span role="status" aria-live="polite" className="text-xs tabular-nums text-[#62625e]">{activeIndex + 1} of {ids.length}</span>
          <button type="button" aria-label="Next image" disabled={activeIndex >= ids.length - 1} onClick={() => navigate(1)} className={controlClass}>→</button>
        </div>
        <button type="button" disabled={disabled || ids.length >= MAX_BATCH_IMAGES} onClick={onAddImages} className={controlClass}>+ Add images</button>
      </div>
      <p className="px-2 text-[11px] text-[#858580]">{editedCount} / {ids.length} edited{ids.length >= 18 && ` · ${ids.length} / ${MAX_BATCH_IMAGES} images${ids.length === MAX_BATCH_IMAGES ? " · Batch full" : ""}`}</p>
      <ul ref={rail} onKeyDown={handleKeys} className="relative flex w-full gap-2 overflow-x-auto overscroll-x-contain px-1 pt-2 pb-1">
        {ids.map((id) => <BatchImageThumbnail key={id} id={id} active={id === activeId} disabled={disabled} />)}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={() => { applyRatio(); setAppliedStatus(`Applied ${ratioLabel} to all ${ids.length} images. Framing was kept.`); }} disabled={disabled} className={controlClass}>Apply {ratioLabel} to all {ids.length} images</button>
        <button ref={clearTrigger} type="button" onClick={() => setConfirmClear(true)} disabled={disabled} className={controlClass}>Clear batch</button>
      </div>
      <p className="px-2 text-[11px] text-[#858580]">Keeps each image’s position and zoom.</p>
      <p role="status" aria-live="polite" className="px-2 text-[11px] text-[#62625e] empty:hidden">{appliedStatus}</p>
      {confirmClear && (
        <div role="alertdialog" aria-labelledby="clear-batch-title" aria-describedby="clear-batch-description"
          onKeyDown={(event) => { if (event.key === "Escape") { setConfirmClear(false); clearTrigger.current?.focus(); } }}
          className="mt-2 rounded-lg border border-[#dededb] bg-white p-3 text-xs text-[#62625e]">
          <p id="clear-batch-title" className="font-medium text-[#343430]">Clear all {ids.length} images?</p>
          <p id="clear-batch-description" className="mt-1">This removes their edits from this session.</p>
          <div className="mt-1 flex gap-2">
            <button ref={confirmButton} type="button" disabled={disabled} className={controlClass} onClick={() => { clear(); onClear(); setConfirmClear(false); }}>Clear all images</button>
            <button type="button" className={controlClass} onClick={() => { setConfirmClear(false); clearTrigger.current?.focus(); }}>Keep images</button>
          </div>
        </div>
      )}
    </section>
  );
}
