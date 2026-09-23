import type { CropPosition, FocalPoint } from "@/types/editor";

export interface CropGeometry {
  mediaWidth: number;
  mediaHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  zoom: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const unit = (value: number) => Number.isFinite(value) ? clamp(value, 0, 1) : 0.5;

export function clampFocalPoint(point: FocalPoint): FocalPoint {
  return { x: unit(point.x), y: unit(point.y) };
}

export function cropToFocalPoint(crop: CropPosition, geometry: CropGeometry): FocalPoint {
  const width = geometry.mediaWidth * geometry.zoom;
  const height = geometry.mediaHeight * geometry.zoom;
  return clampFocalPoint({
    x: width > 0 ? 0.5 - crop.x / width : 0.5,
    y: height > 0 ? 0.5 - crop.y / height : 0.5,
  });
}

export function focalPointToCrop(point: FocalPoint, geometry: CropGeometry): CropPosition {
  const focal = clampFocalPoint(point);
  const width = geometry.mediaWidth * geometry.zoom;
  const height = geometry.mediaHeight * geometry.zoom;
  // Fill first: clamp the requested focus to the offsets that still cover the frame.
  const maxX = Math.max(0, (width - geometry.viewportWidth) / 2);
  const maxY = Math.max(0, (height - geometry.viewportHeight) / 2);
  return {
    x: clamp((0.5 - focal.x) * width, -maxX, maxX),
    y: clamp((0.5 - focal.y) * height, -maxY, maxY),
  };
}
