import { useDropzone } from "react-dropzone";
import { IMAGE_ACCEPT, IMAGE_ERRORS, MAX_IMAGE_SIZE } from "@/hooks/useImage";

interface UploadAreaProps {
  onImage: (file: File) => void;
  onError: (message: string) => void;
  error: string | null;
  isLoading: boolean;
}

export function UploadArea({ onImage, onError, error, isLoading }: UploadAreaProps) {
  const { getRootProps, getInputProps, isDragActive, isDragReject, open } = useDropzone({
    accept: IMAGE_ACCEPT,
    maxSize: MAX_IMAGE_SIZE,
    multiple: false,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: ([file]) => {
      if (file) onImage(file);
    },
    onDropRejected: ([rejection]) => {
      const tooLarge = rejection?.errors.some((item) => item.code === "file-too-large");
      const tooMany = rejection?.errors.some((item) => item.code === "too-many-files");
      onError(tooMany ? "Choose one image at a time." : tooLarge ? IMAGE_ERRORS.size : IMAGE_ERRORS.type);
    },
  });

  return (
    <section
      {...getRootProps({
        "aria-labelledby": "upload-title",
        className: `flex min-h-80 w-full flex-col items-center justify-center rounded-[24px] border bg-white px-6 py-12 text-center shadow-[0_12px_35px_rgba(0,0,0,0.04)] transition-colors duration-150 ${isDragReject ? "border-[#c88b8b] bg-[#fffafa]" : isDragActive ? "border-[#9aa9a2] bg-[#f7faf8]" : "border-[#e8e8e6]"}`,
      })}
    >
      <input {...getInputProps()} />
      <div aria-hidden="true" className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#f4f4f2] text-[#555]">
        <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6">
          <path d="M12 15V4m0 0L8 8m4-4 4 4M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h2 id="upload-title" className="text-xl font-medium tracking-[-0.03em] text-[#181818]">
        {isDragReject ? "Unsupported image format" : isDragActive ? "Drop to open image" : "Drop an image here"}
      </h2>
      <p className="mt-2 text-sm text-[#858585]">or choose an image</p>
      <button type="button" onClick={open} disabled={isLoading} className="mt-7 min-h-11 rounded-full bg-[#1e1e1e] px-6 text-sm font-medium text-white transition-opacity hover:opacity-85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#181818] disabled:opacity-70">
        {isLoading ? "Opening image…" : "Choose Image"}
      </button>
      {error && <p role="alert" className="mt-4 text-sm text-[#a54747]">{error}</p>}
      <p className="mt-7 text-xs text-[#858585]">Processed locally. Your image never leaves your device.</p>
    </section>
  );
}
