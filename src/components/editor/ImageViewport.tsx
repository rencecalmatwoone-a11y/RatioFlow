interface ImageViewportProps {
  url: string;
  name: string;
}

export function ImageViewport({ url, name }: ImageViewportProps) {
  return (
    <div className="aspect-video w-full overflow-hidden rounded-[20px] border border-black/[0.07] bg-[#e8e7de] shadow-[0_12px_35px_rgba(0,0,0,0.07),0_2px_8px_rgba(0,0,0,0.03)] sm:rounded-[24px]">
      {/* A browser object URL is already local and needs no image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={name} className="h-full w-full object-cover" />
    </div>
  );
}
