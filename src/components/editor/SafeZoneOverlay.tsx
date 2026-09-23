import type { CSSProperties } from "react";
import type { SafeZonePreset, SafeZoneRegion } from "@/types/editor";

type SafeZoneOverlayProps = {
  guide: SafeZonePreset;
  visible: boolean;
};

function regionStyle(region: Pick<SafeZoneRegion, "x" | "y" | "width" | "height">): CSSProperties {
  return {
    left: `${region.x * 100}%`,
    top: `${region.y * 100}%`,
    width: `${region.width * 100}%`,
    height: `${region.height * 100}%`,
  };
}

export function SafeZoneOverlay({ guide, visible }: SafeZoneOverlayProps) {
  const frame = guide.safeFrame;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 z-10 overflow-hidden transition-opacity duration-200 motion-reduce:transition-none ${visible ? "opacity-100" : "opacity-0"}`}
    >
      {frame && (
        <>
          <div className="absolute bg-[#302c25]/20" style={regionStyle({ x: 0, y: 0, width: 1, height: frame.y })} />
          <div className="absolute bg-[#302c25]/20" style={regionStyle({ x: 0, y: frame.y + frame.height, width: 1, height: 1 - frame.y - frame.height })} />
          <div className="absolute bg-[#302c25]/20" style={regionStyle({ x: 0, y: frame.y, width: frame.x, height: frame.height })} />
          <div className="absolute bg-[#302c25]/20" style={regionStyle({ x: frame.x + frame.width, y: frame.y, width: 1 - frame.x - frame.width, height: frame.height })} />
          <div
            className="absolute border border-dashed border-white/90 shadow-[inset_0_0_0_1px_rgba(32,32,32,0.4),0_0_0_1px_rgba(32,32,32,0.3)]"
            style={regionStyle(frame)}
          >
            {frame.label && <span className="absolute top-1 left-1 hidden rounded-sm bg-[#282824]/75 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white min-[380px]:inline">{frame.label}</span>}
          </div>
        </>
      )}
      {guide.zones.map((region) => (
        <div
          key={region.id}
          className={`absolute border border-dashed border-white/70 shadow-[inset_0_0_0_1px_rgba(35,35,32,0.35)] ${region.severity === "blocked" ? "bg-[#302c25]/25" : "bg-[#302c25]/15"}`}
          style={regionStyle(region)}
        >
          {region.label && <span className="absolute top-1 left-1 hidden max-w-[calc(100%-0.5rem)] truncate rounded-sm bg-[#282824]/75 px-1.5 py-0.5 text-[10px] leading-tight font-medium text-white min-[380px]:inline">{region.label}</span>}
        </div>
      ))}
    </div>
  );
}
