import { useEffect, useRef, useState } from "react";

export type ExportSelectOption<T extends string> = {
  value: T;
  label: string;
  detail?: string;
  selectedLabel?: string;
};

interface ExportSelectProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: readonly ExportSelectOption<T>[];
  onChange: (value: T) => void;
}

export function ExportSelect<T extends string>({ id, label, value, options, onChange }: ExportSelectProps<T>) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!mounted || open) return;
    const timeout = window.setTimeout(() => setMounted(false), 150);
    return () => window.clearTimeout(timeout);
  }, [mounted, open]);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function focusOption(index: number) {
    const items = root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    items?.[Math.max(0, Math.min(index, items.length - 1))]?.focus();
  }

  function show() {
    setMounted(true);
    setOpen(true);
    window.requestAnimationFrame(() => focusOption(Math.max(0, options.findIndex((option) => option.value === value))));
  }

  return (
    <div
      ref={root}
      className="relative"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
        if (!open) return;
        const current = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? []);
        const index = current.findIndex((item) => item === document.activeElement);
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          focusOption((index < 0 ? options.findIndex((option) => option.value === value) : index) + (event.key === "ArrowDown" ? 1 : -1));
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          focusOption(event.key === "Home" ? 0 : options.length - 1);
        }
      }}
    >
      <span id={`${id}-label`} className="mb-2 block text-xs font-medium">{label}</span>
      <button
        ref={trigger}
        id={id}
        type="button"
        aria-labelledby={`${id}-label ${id}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        onClick={() => open ? setOpen(false) : show()}
        onKeyDown={(event) => {
          if (!open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            show();
          }
        }}
        className={`flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border bg-[#fafaf9] px-3 text-left text-sm text-[#242424] transition-[border-color,background-color,box-shadow] duration-150 hover:border-[#bcbcb7] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] motion-reduce:transition-none ${open ? "border-[#a8a8a3] bg-white shadow-[0_0_0_3px_rgba(30,30,30,0.06)]" : "border-[#dededb]"}`}
      >
        <span className="min-w-0 truncate">{selected?.selectedLabel ?? selected?.label ?? value}</span>
        <svg aria-hidden="true" viewBox="0 0 12 12" fill="none" className={`size-3 shrink-0 text-[#777] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}>
          <path d="m2.5 4.5 3.5 3 3.5-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {mounted && (
        <div
          id={`${id}-options`}
          role="listbox"
          aria-labelledby={`${id}-label`}
          aria-hidden={!open}
          inert={!open}
          className={`absolute top-full left-0 z-30 mt-1.5 w-full rounded-xl border border-[#e6e6e4] bg-white p-1.5 shadow-[0_10px_28px_rgba(0,0,0,0.12)] ${open ? "export-options-enter" : "export-options-exit"}`}
        >
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              onClick={() => { onChange(option.value); setOpen(false); trigger.current?.focus(); }}
              className={`flex min-h-10 w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150 hover:bg-[#f3f3f1] focus-visible:bg-[#f3f3f1] focus-visible:outline-2 focus-visible:outline-[#181818] motion-reduce:transition-none ${option.value === value ? "bg-[#f1f1ef] font-medium" : ""}`}
            >
              <span className="min-w-0">
                <span className="block truncate">{option.label}</span>
                {option.detail && <span className="block truncate text-[11px] font-normal text-[#777]">{option.detail}</span>}
              </span>
              {option.value === value && <span aria-hidden="true" className="shrink-0 text-[#333]">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
