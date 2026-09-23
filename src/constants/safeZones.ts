import type { SafeZonePreset } from "@/types/editor";

// Approximate editor guides only. Platform interfaces and placements can change.
// Coordinates are fractions of the visible preset viewport, never CSS pixels.
const SAFE_ZONES: readonly SafeZonePreset[] = [
  {
    presetId: "instagram-story",
    zones: [
      { id: "top-ui", x: 0, y: 0, width: 1, height: 0.13, label: "Profile / controls", severity: "caution" },
      { id: "bottom-ui", x: 0, y: 0.79, width: 1, height: 0.21, label: "Reply / controls", severity: "caution" },
      { id: "side-ui", x: 0.82, y: 0.38, width: 0.18, height: 0.41, severity: "caution" },
    ],
  },
  {
    presetId: "tiktok-vertical",
    zones: [
      { id: "top-ui", x: 0, y: 0, width: 1, height: 0.12, label: "Top UI", severity: "caution" },
      { id: "bottom-ui", x: 0, y: 0.73, width: 1, height: 0.27, label: "Caption / controls", severity: "caution" },
      { id: "side-ui", x: 0.81, y: 0.32, width: 0.19, height: 0.41, severity: "caution" },
    ],
  },
  {
    presetId: "youtube-thumbnail",
    zones: [
      { id: "duration-badge", x: 0.76, y: 0.81, width: 0.24, height: 0.19, label: "Time badge", severity: "caution" },
    ],
  },
  {
    presetId: "youtube-channel-banner",
    zones: [],
    safeFrame: { id: "banner-safe-frame", x: 0.21, y: 0.36, width: 0.58, height: 0.28, label: "Keep key content here" },
  },
  {
    presetId: "facebook-story",
    zones: [
      { id: "top-ui", x: 0, y: 0, width: 1, height: 0.13, label: "Profile / controls", severity: "caution" },
      { id: "bottom-ui", x: 0, y: 0.8, width: 1, height: 0.2, label: "Reply / controls", severity: "caution" },
    ],
  },
];

const safeZonesByPreset = new Map(SAFE_ZONES.map((guide) => [guide.presetId, guide]));

export function getSafeZoneForPreset(presetId: string | null): SafeZonePreset | undefined {
  return presetId ? safeZonesByPreset.get(presetId) : undefined;
}
