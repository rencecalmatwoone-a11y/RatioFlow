import { useDropzone } from "react-dropzone";
import { IMAGE_ACCEPT, MAX_FILE_SIZE } from "@/constants/batchLimits";

interface UploadAreaProps {
  onImages: (files: File[]) => void;
  status: string | null;
  isLoading: boolean;
}

export function UploadArea({ onImages, status, isLoading }: UploadAreaProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    accept: IMAGE_ACCEPT,
    maxSize: MAX_FILE_SIZE,
    multiple: true,
    disabled: isLoading,
    noClick: true,
    noKeyboard: true,
    onDrop: (accepted, rejected) => onImages([...accepted, ...rejected.map((item) => item.file)]),
  });

  return (
    <section
      {...getRootProps({
        "aria-labelledby": "upload-title",
        className: `flex min-h-80 w-full flex-col items-center justify-center rounded-[24px] border-2 border-dashed bg-white px-6 py-12 text-center shadow-[0_12px_35px_rgba(0,0,0,0.04)] transition-[border-color,background-color,box-shadow] duration-150 ${isDragReject ? "border-[#c88b8b] bg-[#fffafa]" : isDragActive ? "border-[#778f82] bg-[#f7faf8] shadow-[0_16px_40px_rgba(0,0,0,0.08)]" : "border-[#d7d7d2]"}`,
      })}
    >
      <input {...getInputProps()} />
      <div aria-hidden="true" className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f2] text-[#555]">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path d="M12 15V4m0 0L8 8m4-4 4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 id="upload-title" className="text-xl font-medium tracking-[-0.03em] text-[#181818]">
        {isDragReject ? "Use JPEG, PNG, or WebP" : isDragActive ? "Drop to open images" : "Drop images here"}
      </h2>
      <p className="mt-2 text-sm text-[#858585]">or choose one or more images</p>
      <button type="button" onClick={open} disabled={isLoading} className="mt-7 min-h-11 rounded-full bg-[#1e1e1e] px-6 text-sm font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-70">
        {isLoading ? "Opening images…" : "Choose Images"}
      </button>
      <p className="mt-4 text-[11px] font-medium tracking-[0.08em] text-[#73736d]" aria-label="Supported formats: PNG, JPG, and WebP">PNG · JPG · WEBP</p>
      <p role="status" aria-live="polite" className="mt-4 text-sm text-[#62625e] empty:hidden">{status}</p>
      <p className="mt-7 text-xs text-[#858585]">Processed locally. Your images never leave your device.</p>
    </section>
  );
}
