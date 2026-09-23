import type { AspectRatio } from "../types/editor.ts";

function gcd(a: number, b: number): number {
  while (b !== 0) [a, b] = [b, a % b];
  return a;
}

export function ratioLabel({ width, height }: AspectRatio): string {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    return `${width}:${height}`;
  }
  const divisor = gcd(width, height);
  const a = width / divisor;
  const b = height / divisor;
  return a > 100 || b > 100 ? `${Number((width / height).toFixed(2))}:1` : `${a}:${b}`;
}
