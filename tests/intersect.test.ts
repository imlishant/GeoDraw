import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { circleCircle, lineCircle, lineLine, onCurve, roots } from '../src/engine/intersect';
import type { GCircle, GLine } from '../src/engine/types';

const line = (px: number, py: number, ang: number, clip?: [number, number]): GLine => ({
  k: 'line',
  px,
  py,
  dx: Math.cos(ang),
  dy: Math.sin(ang),
  s: 1,
  t0: clip ? clip[0] : -Infinity,
  t1: clip ? clip[1] : Infinity,
});
const circle = (cx: number, cy: number, r: number): GCircle => ({ k: 'circle', cx, cy, r });

const coord = fc.double({ min: -500, max: 500, noNaN: true });
const radius = fc.double({ min: 1, max: 400, noNaN: true });
const angle = fc.double({ min: 0, max: Math.PI * 2, noNaN: true });

const distToLine = (l: GLine, x: number, y: number) => Math.abs(l.dx * (y - l.py) - l.dy * (x - l.px));

describe('intersections', () => {
  it('line ∩ line lies on both lines', () => {
    fc.assert(
      fc.property(coord, coord, angle, coord, coord, angle, (ax, ay, a1, bx, by, a2) => {
        const l1 = line(ax, ay, a1);
        const l2 = line(bx, by, a2);
        for (const p of lineLine(l1, l2)) {
          const scale = Math.max(1, Math.abs(p.x), Math.abs(p.y));
          expect(distToLine(l1, p.x, p.y)).toBeLessThan(1e-9 * scale * 1e3);
          expect(distToLine(l2, p.x, p.y)).toBeLessThan(1e-9 * scale * 1e3);
        }
      }),
    );
  });

  it('line ∩ circle points lie on both', () => {
    fc.assert(
      fc.property(coord, coord, angle, coord, coord, radius, (px, py, a, cx, cy, r) => {
        const l = line(px, py, a);
        const c = circle(cx, cy, r);
        for (const p of lineCircle(l, c)) {
          expect(distToLine(l, p.x, p.y)).toBeLessThan(1e-7);
          expect(Math.abs(Math.hypot(p.x - cx, p.y - cy) - r)).toBeLessThan(1e-6);
        }
      }),
    );
  });

  it('circle ∩ circle points lie on both', () => {
    fc.assert(
      fc.property(coord, coord, radius, coord, coord, radius, (ax, ay, ar, bx, by, br) => {
        const a = circle(ax, ay, ar);
        const b = circle(bx, by, br);
        for (const p of circleCircle(a, b)) {
          expect(Math.abs(Math.hypot(p.x - ax, p.y - ay) - ar)).toBeLessThan(1e-6);
          expect(Math.abs(Math.hypot(p.x - bx, p.y - by) - br)).toBeLessThan(1e-6);
        }
      }),
    );
  });

  it('tangency gives a double root at the touch point', () => {
    const rs = circleCircle(circle(0, 0, 50), circle(100, 0, 50));
    expect(rs).toHaveLength(2);
    expect(rs[0].x).toBeCloseTo(50, 9);
    expect(rs[1].x).toBeCloseTo(50, 9);
    const lr = lineCircle(line(-100, 50, 0), circle(0, 0, 50));
    expect(lr[0].y).toBeCloseTo(50, 9);
    expect(lr[1].x).toBeCloseTo(lr[0].x, 9);
  });

  it('parallel lines and concentric circles do not intersect', () => {
    expect(lineLine(line(0, 0, 0.3), line(0, 10, 0.3))).toHaveLength(0);
    expect(circleCircle(circle(0, 0, 10), circle(0, 0, 20))).toHaveLength(0);
    expect(circleCircle(circle(0, 0, 10), circle(0, 0, 10))).toHaveLength(0);
  });

  it('root order is stable while a circle moves continuously (no swaps)', () => {
    const fixed = circle(0, 0, 100);
    let prev = roots(fixed, circle(120, 0, 80));
    for (let k = 1; k <= 200; k++) {
      const t = (k / 200) * Math.PI; // move the second circle around a half turn
      const cur = roots(fixed, circle(120 * Math.cos(t), 120 * Math.sin(t), 80));
      for (let i = 0; i < 2; i++) {
        const jump = Math.hypot(cur[i].x - prev[i].x, cur[i].y - prev[i].y);
        expect(jump).toBeLessThan(5); // small step → small move; a swap would jump ~100+
      }
      prev = cur;
    }
  });

  it('clips: segments, rays and arcs', () => {
    const seg = line(0, 0, 0, [0, 100]);
    expect(onCurve({ x: 50, y: 0 }, seg)).toBe(true);
    expect(onCurve({ x: 150, y: 0 }, seg)).toBe(false);
    expect(onCurve({ x: -1, y: 0 }, seg)).toBe(false);
    const arc: GCircle = { k: 'circle', cx: 0, cy: 0, r: 10, a0: 0, a1: Math.PI };
    expect(onCurve({ x: 0, y: 10 }, arc)).toBe(true);
    expect(onCurve({ x: 0, y: -10 }, arc)).toBe(false);
    const wrap: GCircle = { k: 'circle', cx: 0, cy: 0, r: 10, a0: (3 * Math.PI) / 2, a1: (5 * Math.PI) / 2 };
    expect(onCurve({ x: 10, y: 0 }, wrap)).toBe(true);
    expect(onCurve({ x: -10, y: 0 }, wrap)).toBe(false);
  });
});
