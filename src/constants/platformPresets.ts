import { ratioLabel } from "../lib/ratioMath.ts";
import type { PlatformId, PlatformPreset } from "../types/editor.ts";

export const PLATFORMS: readonly { id: PlatformId; name: string }[] = [
  { id: "instagram", name: "Instagram" },
  { id: "tiktok", name: "TikTok" },
  { id: "youtube", name: "YouTube" },
  { id: "x", name: "X" },
  { id: "facebook", name: "Facebook" },
  { id: "linkedin", name: "LinkedIn" },
];

// Dimensions are recommendations. The export engine caps them to source resolution.
export const PLATFORM_PRESETS: readonly PlatformPreset[] = [
  { id: "instagram-square-post", platform: "instagram", name: "Square Post", width: 1080, height: 1080 },
  { id: "instagram-portrait-post", platform: "instagram", name: "Portrait Post", width: 1080, height: 1350 },
  { id: "instagram-landscape-post", platform: "instagram", name: "Landscape Post", width: 1080, height: 566 },
  { id: "instagram-story", platform: "instagram", name: "Story / Reel", width: 1080, height: 1920 },
  { id: "tiktok-vertical", platform: "tiktok", name: "Vertical Video / Image", width: 1080, height: 1920 },
  { id: "youtube-thumbnail", platform: "youtube", name: "Thumbnail", width: 1280, height: 720 },
  { id: "youtube-channel-banner", platform: "youtube", name: "Channel Banner", width: 2560, height: 1440 },
  { id: "youtube-community-post", platform: "youtube", name: "Community Post", width: 1200, height: 1200 },
  { id: "x-post", platform: "x", name: "Post", width: 1200, height: 675 },
  { id: "x-header", platform: "x", name: "Header", width: 1500, height: 500 },
  { id: "x-profile", platform: "x", name: "Profile", width: 400, height: 400 },
  { id: "facebook-post", platform: "facebook", name: "Post", width: 1200, height: 630 },
  { id: "facebook-story", platform: "facebook", name: "Story", width: 1080, height: 1920 },
  { id: "facebook-cover", platform: "facebook", name: "Cover", width: 851, height: 315 },
  { id: "facebook-profile", platform: "facebook", name: "Profile", width: 400, height: 400 },
  { id: "linkedin-post", platform: "linkedin", name: "Post", width: 1200, height: 627 },
  { id: "linkedin-profile-banner", platform: "linkedin", name: "Profile Banner", width: 1584, height: 396 },
  { id: "linkedin-company-banner", platform: "linkedin", name: "Company Banner", width: 4200, height: 700 },
];

export function getPlatformPresetById(id: string | null): PlatformPreset | undefined {
  return PLATFORM_PRESETS.find((preset) => preset.id === id);
}

export function getPresetsByPlatform(platform: PlatformId): readonly PlatformPreset[] {
  return PLATFORM_PRESETS.filter((preset) => preset.platform === platform);
}

export function getPlatformName(platform: PlatformId): string {
  return PLATFORMS.find((item) => item.id === platform)?.name ?? platform;
}

export function getPresetRatio(preset: PlatformPreset) {
  return {
    id: "platform" as const,
    name: preset.name,
    label: ratioLabel(preset),
    width: preset.width,
    height: preset.height,
    value: preset.width / preset.height,
  };
}
