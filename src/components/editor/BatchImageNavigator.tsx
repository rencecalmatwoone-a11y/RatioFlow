"use client";

import { memo, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { useEditorStore } from "@/store/editorStore";

const controlClass = "min-h-11 rounded-md px-2 text-xs text-[#62625e] hover:bg-[#ececea] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-40";

const BatchImageThumbnail = memo(function BatchImageThumbnail({ id, active, disabled }: { id: string; active: boolean; disabled: boolean }) {
  const metadata = useEditorStore(useShallow((state) => {
    const image = state.batchImages.find((item) => item.id === id);
    return { name: image?.name, objectUrl: image?.objectUrl };
  }));
  const select = useEditorStore((state) => state.setActiveImage);
  const remove = useEditorStore((state) => state.removeImage);
  if (!metadata.name || !metadata.objectUrl) return null;
  return (
    <li className="w-[72px] shrink-0">
      <button type="button" data-image-id={id} aria-label={`Edit ${metadata.name}`} aria-current={active ? "true" : undefined}
        onClick={() => select(id)}
        className={`block h-[64px] w-[72px] overflow-hidden rounded-lg border-2 p-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] ${active ? "border-[#454540] bg-white" : "border-transparent hover:border-[#ccc]"}`}>
        {/* Local source URLs keep thumbnails lightweight and private. */}
        <img src={metadata.objectUrl} alt="" width={64} height={56} loading="lazy" draggable={false} className="h-full w-full rounded object-cover" />
      </button>
      <p className="mt-1 truncate text-center text-[10px] text-[#777]" title={metadata.name}>{metadata.name}</p>
      <button type="button" aria-label={`Remove ${metadata.name} from batch`} disabled={disabled}
        onClick={() => remove(id)} className="min-h-11 w-full rounded text-[10px] text-[#858580] hover:text-[#a54747] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-40">Remove</button>
    </li>
  );
});

export function BatchImageNavigator({ onAddImages, onClear }: { onAddImages: () => void; onClear: () => void }) {
  const ids = useEditorStore(useShallow((state) => state.batchImages.map((image) => image.id)));
  const activeId = useEditorStore((state) => state.activeImageId);
  const select = useEditorStore((state) => state.setActiveImage);
  const clear = useEditorStore((state) => state.clearBatch);
  const applyRatio = useEditorStore((state) => state.applyRatioToAll);
  const disabled = useEditorStore((state) => state.isExporting || state.isPreparingImages);
  const [confirmClear, setConfirmClear] = useState(false);
  const rail = useRef<HTMLUListElement>(null);
  const clearTrigger = useRef<HTMLButtonElement>(null);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const activeIndex = ids.indexOf(activeId ?? "");

  useEffect(() => {
    const thumbnail = rail.current?.querySelector<HTMLButtonElement>(`button[data-image-id="${activeId}"]`);
    if (!thumbnail || !rail.current) return;
    const item = thumbnail.closest("li");
    if (!item) return;
    const left = item.getBoundingClientRect().left - rail.current.getBoundingClientRect().left + rail.current.scrollLeft;
    const right = left + item.offsetWidth;
    const current = rail.current.scrollLeft;
    const target = left < current ? left : right > current + rail.current.clientWidth ? right - rail.current.clientWidth : current;
    rail.current.scrollTo({ left: target, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  }, [activeId]);

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
          <span role="status" aria-live="polite" className="text-xs tabular-nums text-[#62625e]">Image {activeIndex + 1} / {ids.length}</span>
          <button type="button" aria-label="Next image" disabled={activeIndex >= ids.length - 1} onClick={() => navigate(1)} className={controlClass}>→</button>
        </div>
        <button type="button" disabled={disabled} onClick={onAddImages} className={controlClass}>+ Add images</button>
      </div>
      <ul ref={rail} onKeyDown={handleKeys} className="relative flex w-full gap-2 overflow-x-auto overscroll-x-contain px-1 pt-2 pb-1">
        {ids.map((id) => <BatchImageThumbnail key={id} id={id} active={id === activeId} disabled={disabled} />)}
      </ul>
      <div className="flex flex-wrap justify-between gap-2">
        <button type="button" onClick={applyRatio} disabled={disabled} className={controlClass}>Apply ratio to all</button>
        <button ref={clearTrigger} type="button" onClick={() => setConfirmClear(true)} disabled={disabled} className={controlClass}>Clear batch</button>
      </div>
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
