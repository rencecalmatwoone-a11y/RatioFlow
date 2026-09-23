import Image from "next/image";
import { ImageWorkspace } from "@/components/editor/ImageWorkspace";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-[#f8f8f8] text-[#181818]">
      <header className="flex w-full items-center justify-between gap-4 px-5 py-6 sm:px-8 lg:px-12">
        <span className="text-[17px] font-semibold tracking-[-0.055em]">RatioFlow<span className="text-[#a5a5a5]">.</span></span>
        <span className="max-w-32 text-right text-[11px] leading-snug text-[#858585] sm:max-w-none sm:text-xs">Images stay on your device</span>
      </header>
      <main className="flex w-full flex-1 items-center px-4 pt-12 pb-20 sm:px-8 sm:pt-16 sm:pb-24 lg:px-12">
        <ImageWorkspace />
      </main>
      <footer className="flex w-full flex-wrap items-center justify-center gap-x-1.5 gap-y-1 px-5 pb-5 text-center text-sm leading-5 text-[#737373] sm:px-8 lg:px-12">
        <span>Made with care by</span>
        <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
          <span className="inline-flex size-5 shrink-0 overflow-hidden rounded-full bg-[#e5e5e5]">
            <Image
              src="/rence-avatar.png"
              alt=""
              width={20}
              height={20}
              className="size-full translate-y-0.5 scale-[1.2] object-cover grayscale"
            />
          </span>
          Rence Calma Mendoza
        </span>
      </footer>
    </div>
  );
}
