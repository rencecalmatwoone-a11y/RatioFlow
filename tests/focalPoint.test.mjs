import assert from "node:assert/strict";
import test from "node:test";
import { clampFocalPoint, cropToFocalPoint, focalPointToCrop } from "../src/lib/focalPoint.ts";

const ratios = [9 / 16, 1, 4 / 5, 3 / 2, 16 / 9];
const images = [
  [4000, 3000], [3000, 4000], [6000, 1000], [1000, 6000],
];

test("focal coordinates stay normalized", () => {
  assert.deepEqual(clampFocalPoint({ x: -2, y: 4 }), { x: 0, y: 1 });
  assert.deepEqual(clampFocalPoint({ x: NaN, y: Infinity }), { x: 0.5, y: 0.5 });
});

test("drag offsets map to source-image focus", () => {
  const geometry = { mediaWidth: 1000, mediaHeight: 800, viewportWidth: 500, viewportHeight: 400, zoom: 1.5 };
  const crop = focalPointToCrop({ x: 0.72, y: 0.31 }, geometry);
  const focal = cropToFocalPoint(crop, geometry);
  assert.ok(Math.abs(focal.x - 0.72) < 1e-10);
  assert.ok(Math.abs(focal.y - 0.31) < 1e-10);
});

test("every ratio and source shape keeps Fill covered at multiple preview sizes and zooms", () => {
  for (const [sourceWidth, sourceHeight] of images) {
    for (const ratio of ratios) {
      for (const viewportWidth of [340, 720]) {
        const viewportHeight = viewportWidth / ratio;
        const scale = Math.max(viewportWidth / sourceWidth, viewportHeight / sourceHeight);
        for (const zoom of [1, 1.7, 3]) {
          const geometry = {
            mediaWidth: sourceWidth * scale,
            mediaHeight: sourceHeight * scale,
            viewportWidth,
            viewportHeight,
            zoom,
          };
          for (const focal of [{ x: 0.5, y: 0.5 }, { x: 0.02, y: 0.3 }, { x: 0.98, y: 0.8 }]) {
            const crop = focalPointToCrop(focal, geometry);
            assert.ok(Math.abs(crop.x) <= (geometry.mediaWidth * geometry.zoom - viewportWidth) / 2 + 1e-8);
            assert.ok(Math.abs(crop.y) <= (geometry.mediaHeight * geometry.zoom - viewportHeight) / 2 + 1e-8);
            const effective = cropToFocalPoint(crop, geometry);
            assert.ok(effective.x >= 0 && effective.x <= 1 && effective.y >= 0 && effective.y <= 1);
          }
        }
      }
    }
  }
});
