export function ExportMenu() {
  return (
    <button type="button" disabled className="inline-flex min-h-11 items-center justify-center gap-3 rounded-full bg-[#1e1e1e] px-5 text-[13px] font-medium text-white opacity-70">
      Export
      <svg aria-hidden="true" viewBox="0 0 16 16" fill="none" className="h-4 w-4">
        <path d="M8 2.5v8m0 0 3-3m-3 3-3-3M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}
