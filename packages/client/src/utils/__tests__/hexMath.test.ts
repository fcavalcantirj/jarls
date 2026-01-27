import { hexToPixel, pixelToHex, getHexCorners } from '../hexMath';

describe('hexToPixel', () => {
  const hexSize = 30;
  const centerX = 400;
  const centerY = 300;

  it('returns center for origin hex (0,0)', () => {
    const result = hexToPixel({ q: 0, r: 0 }, hexSize, centerX, centerY);
    expect(result.x).toBeCloseTo(400);
    expect(result.y).toBeCloseTo(300);
  });

  it('offsets by canvas center', () => {
    // hex (1,0) at size=30: local x = 30*sqrt(3) ≈ 51.96, y = 0
    const result = hexToPixel({ q: 1, r: 0 }, hexSize, centerX, centerY);
    expect(result.x).toBeCloseTo(400 + 30 * Math.sqrt(3));
    expect(result.y).toBeCloseTo(300);
  });

  it('handles non-zero r coordinate', () => {
    // hex (0,1) at size=30: local x = 30*(sqrt(3)/2) ≈ 25.98, y = 30*1.5 = 45
    const result = hexToPixel({ q: 0, r: 1 }, hexSize, centerX, centerY);
    expect(result.x).toBeCloseTo(400 + 30 * (Math.sqrt(3) / 2));
    expect(result.y).toBeCloseTo(300 + 45);
  });

  it('handles negative coordinates', () => {
    const result = hexToPixel({ q: -1, r: -1 }, hexSize, centerX, centerY);
    const expectedX = 30 * (Math.sqrt(3) * -1 + (Math.sqrt(3) / 2) * -1);
    const expectedY = 30 * (1.5 * -1);
    expect(result.x).toBeCloseTo(400 + expectedX);
    expect(result.y).toBeCloseTo(300 + expectedY);
  });
});

describe('pixelToHex', () => {
  const hexSize = 30;
  const centerX = 400;
  const centerY = 300;

  it('returns (0,0) for canvas center', () => {
    const result = pixelToHex(400, 300, hexSize, centerX, centerY);
    expect(result).toEqual({ q: 0, r: 0 });
  });

  it('round-trips with hexToPixel for origin', () => {
    const pixel = hexToPixel({ q: 0, r: 0 }, hexSize, centerX, centerY);
    const hex = pixelToHex(pixel.x, pixel.y, hexSize, centerX, centerY);
    expect(hex).toEqual({ q: 0, r: 0 });
  });

  it('round-trips with hexToPixel for (1,0)', () => {
    const pixel = hexToPixel({ q: 1, r: 0 }, hexSize, centerX, centerY);
    const hex = pixelToHex(pixel.x, pixel.y, hexSize, centerX, centerY);
    expect(hex).toEqual({ q: 1, r: 0 });
  });

  it('round-trips with hexToPixel for (0,1)', () => {
    const pixel = hexToPixel({ q: 0, r: 1 }, hexSize, centerX, centerY);
    const hex = pixelToHex(pixel.x, pixel.y, hexSize, centerX, centerY);
    expect(hex).toEqual({ q: 0, r: 1 });
  });

  it('round-trips with hexToPixel for (-2,1)', () => {
    const pixel = hexToPixel({ q: -2, r: 1 }, hexSize, centerX, centerY);
    const hex = pixelToHex(pixel.x, pixel.y, hexSize, centerX, centerY);
    expect(hex).toEqual({ q: -2, r: 1 });
  });

  it('round-trips with hexToPixel for (3,-3)', () => {
    const pixel = hexToPixel({ q: 3, r: -3 }, hexSize, centerX, centerY);
    const hex = pixelToHex(pixel.x, pixel.y, hexSize, centerX, centerY);
    expect(hex).toEqual({ q: 3, r: -3 });
  });

  it('snaps to nearest hex when clicked near center of hex', () => {
    // Click slightly off-center of hex (1,0)
    const pixel = hexToPixel({ q: 1, r: 0 }, hexSize, centerX, centerY);
    const hex = pixelToHex(pixel.x + 3, pixel.y - 2, hexSize, centerX, centerY);
    expect(hex.q).toBe(1);
    // Cube rounding may produce -0; both 0 and -0 are valid
    expect(Math.abs(hex.r)).toBe(0);
  });
});

describe('getHexCorners', () => {
  it('returns exactly 6 corners', () => {
    const corners = getHexCorners(100, 100, 30);
    expect(corners).toHaveLength(6);
  });

  it('all corners are at distance size from center', () => {
    const cx = 100;
    const cy = 100;
    const size = 30;
    const corners = getHexCorners(cx, cy, size);

    for (const corner of corners) {
      const dist = Math.sqrt((corner.x - cx) ** 2 + (corner.y - cy) ** 2);
      expect(dist).toBeCloseTo(size);
    }
  });

  it('first corner is at 30 degrees (pointy-top)', () => {
    const cx = 0;
    const cy = 0;
    const size = 30;
    const corners = getHexCorners(cx, cy, size);

    // First corner: angle = 60*0 - 30 = -30 degrees
    const angle = (-30 * Math.PI) / 180;
    expect(corners[0].x).toBeCloseTo(size * Math.cos(angle));
    expect(corners[0].y).toBeCloseTo(size * Math.sin(angle));
  });

  it('corners are equally spaced (60 degrees apart)', () => {
    const corners = getHexCorners(200, 200, 40);

    for (let i = 0; i < 6; i++) {
      const next = (i + 1) % 6;
      const dx = corners[next].x - corners[i].x;
      const dy = corners[next].y - corners[i].y;
      const edgeLength = Math.sqrt(dx * dx + dy * dy);
      // For a regular hex, edge length = size
      expect(edgeLength).toBeCloseTo(40);
    }
  });

  it('offsets corners by center position', () => {
    const cornersAtOrigin = getHexCorners(0, 0, 30);
    const cornersOffset = getHexCorners(100, 200, 30);

    for (let i = 0; i < 6; i++) {
      expect(cornersOffset[i].x).toBeCloseTo(cornersAtOrigin[i].x + 100);
      expect(cornersOffset[i].y).toBeCloseTo(cornersAtOrigin[i].y + 200);
    }
  });
});
