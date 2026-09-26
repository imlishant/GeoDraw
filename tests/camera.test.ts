import { describe, expect, it } from 'vitest';
import { clampPan, MAX_ZOOM, MIN_ZOOM, toScreen, toWorld, zoomAt } from '../src/render/camera';

const vp = { w: 800, h: 600 };

describe('camera', () => {
  it('round-trips screen ↔ world (y-up world)', () => {
    const c = { cx: 12, cy: -40, zoom: 2.5 };
    const w = toWorld(c, vp, 123, 456);
    const s = toScreen(c, vp, w.x, w.y);
    expect(s.x).toBeCloseTo(123, 9);
    expect(s.y).toBeCloseTo(456, 9);
    expect(toWorld(c, vp, 400, 0).y).toBeGreaterThan(c.cy); // up on screen = +y
  });

  it('zoom is bounded and anchored under the cursor', () => {
    let c = { cx: 0, cy: 0, zoom: 1 };
    const before = toWorld(c, vp, 600, 150);
    c = zoomAt(c, vp, 600, 150, 1.1);
    const after = toWorld(c, vp, 600, 150);
    expect(after.x).toBeCloseTo(before.x, 9);
    expect(after.y).toBeCloseTo(before.y, 9);
    for (let i = 0; i < 200; i++) c = zoomAt(c, vp, 400, 300, 1.5);
    expect(c.zoom).toBe(MAX_ZOOM);
    for (let i = 0; i < 200; i++) c = zoomAt(c, vp, 400, 300, 0.5);
    expect(c.zoom).toBe(MIN_ZOOM);
  });

  it('pan is limited to about two screens around the construction', () => {
    const box = { minX: -100, minY: -100, maxX: 100, maxY: 100 };
    const c = clampPan({ cx: 1e6, cy: -1e6, zoom: 1 }, vp, box);
    expect(c.cx).toBe(100 + 1600);
    expect(c.cy).toBe(-100 - 1200);
  });
});
