/**
 * Client-side hex coordinate utilities for canvas rendering.
 *
 * Wraps @jarls/shared hex functions with canvas-specific positioning
 * (center offsets) and provides reverse pixel-to-hex conversion.
 */
import { hexToPixel as sharedHexToPixel } from '@jarls/shared';
import type { AxialCoord } from '@jarls/shared';

/**
 * Convert hex coordinates to canvas pixel coordinates, centered on (centerX, centerY).
 */
export function hexToPixel(
  hex: AxialCoord,
  hexSize: number,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  const local = sharedHexToPixel(hex, hexSize);
  return {
    x: local.x + centerX,
    y: local.y + centerY,
  };
}

/**
 * Convert canvas pixel coordinates back to the nearest hex (axial coordinates).
 *
 * Uses the standard pointy-top hex inverse transform:
 *   q = (√3/3 * px - 1/3 * py) / size
 *   r = (2/3 * py) / size
 *
 * Then rounds to the nearest valid hex using cube rounding.
 */
export function pixelToHex(
  x: number,
  y: number,
  hexSize: number,
  centerX: number,
  centerY: number
): AxialCoord {
  // Translate to local coordinates (origin at board center)
  const px = x - centerX;
  const py = y - centerY;

  // Inverse of pointy-top hex-to-pixel transform
  const q = ((Math.sqrt(3) / 3) * px - (1 / 3) * py) / hexSize;
  const r = ((2 / 3) * py) / hexSize;

  // Cube round to snap to nearest hex
  return cubeRoundToAxial(q, r);
}

/**
 * Round fractional axial coordinates to the nearest hex.
 *
 * Converts to cube coordinates (q, r, s where s = -q - r),
 * rounds each component, then fixes the component with the
 * largest rounding error to maintain q + r + s = 0.
 */
function cubeRoundToAxial(q: number, r: number): AxialCoord {
  const s = -q - r;

  let rq = Math.round(q);
  let rr = Math.round(r);
  const rs = Math.round(s);

  const dq = Math.abs(rq - q);
  const dr = Math.abs(rr - r);
  const ds = Math.abs(rs - s);

  if (dq > dr && dq > ds) {
    rq = -rr - rs;
  } else if (dr > ds) {
    rr = -rq - rs;
  }
  // else: rs would be recalculated, but we only need q and r

  return { q: rq, r: rr };
}

/**
 * Get the 6 corner points of a hex for canvas drawing.
 *
 * Returns corners in order starting from the rightmost point,
 * going counter-clockwise (pointy-top orientation).
 */
export function getHexCorners(
  centerX: number,
  centerY: number,
  size: number
): { x: number; y: number }[] {
  const corners: { x: number; y: number }[] = [];
  for (let i = 0; i < 6; i++) {
    // Pointy-top: first corner at 30°
    const angleDeg = 60 * i - 30;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: centerX + size * Math.cos(angleRad),
      y: centerY + size * Math.sin(angleRad),
    });
  }
  return corners;
}
