import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Scratch } from './scratch';
import {
  angleBisectorMacro,
  midpointMacro,
  parallelMacro,
  perpBisectorMacro,
  perpendicularMacro,
  reflectLineMacro,
  reflectPointMacro,
} from './macros';
import type { Geo } from '../src/engine/types';

// Each composite tool must give exactly the same object as its ruler-and-compass recipe.

const c = fc.double({ min: -300, max: 300, noNaN: true });

function sameLine(a: Geo, b: Geo) {
  if (a.k !== 'line' || b.k !== 'line') throw new Error('not lines');
  expect(Math.abs(a.dx * b.dy - a.dy * b.dx)).toBeLessThan(1e-6);
  expect(Math.abs(a.dx * (b.py - a.py) - a.dy * (b.px - a.px))).toBeLessThan(1e-5);
}
function samePt(a: Geo, b: Geo) {
  if (a.k !== 'point' || b.k !== 'point') throw new Error('not points');
  expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThan(1e-5);
}
const far = (s: Scratch, a: string, b: string, min = 20) => {
  const p = s.pt(a);
  const q = s.pt(b);
  return Math.hypot(p.x - q.x, p.y - q.y) > min;
};

describe('composite tools = primitive recipes', () => {
  it('perpendicular bisector', () => {
    fc.assert(
      fc.property(c, c, c, c, (ax, ay, bx, by) => {
        fc.pre(Math.hypot(ax - bx, ay - by) > 20);
        const s = new Scratch();
        const A = s.free(ax, ay);
        const B = s.free(bx, by);
        const [tool] = s.tool('perpBisector', [A, B]);
        const m = perpBisectorMacro(s, A, B);
        sameLine(s.get(tool), s.get(m));
      }),
    );
  });

  it('perpendicular through a point', () => {
    fc.assert(
      fc.property(c, c, c, c, c, c, (ax, ay, bx, by, px, py) => {
        const s = new Scratch();
        const A = s.free(ax, ay);
        const B = s.free(bx, by);
        fc.pre(far(s, A, B));
        const l = s.line(A, B);
        const P = s.free(px, py);
        const g = s.get(l);
        fc.pre(g.k === 'line' && Math.abs(g.dx * (py - g.py) - g.dy * (px - g.px)) > 20);
        const [tool] = s.tool('perpendicular', [l, P]);
        const m = perpendicularMacro(s, l, P);
        sameLine(s.get(tool), s.get(m));
      }),
    );
  });

  it('parallel through a point', () => {
    fc.assert(
      fc.property(c, c, c, c, c, c, (ax, ay, bx, by, px, py) => {
        const s = new Scratch();
        const A = s.free(ax, ay);
        const B = s.free(bx, by);
        fc.pre(far(s, A, B));
        const l = s.line(A, B);
        const P = s.free(px, py);
        const g = s.get(l);
        fc.pre(g.k === 'line' && Math.abs(g.dx * (py - g.py) - g.dy * (px - g.px)) > 20);
        const [tool] = s.tool('parallel', [l, P]);
        const m = parallelMacro(s, l, P);
        sameLine(s.get(tool), s.get(m));
      }),
    );
  });

  it('angle bisector (sides drawn)', () => {
    fc.assert(
      fc.property(c, c, c, c, c, c, (ax, ay, vx, vy, bx, by) => {
        const s = new Scratch();
        const A = s.free(ax, ay);
        const V = s.free(vx, vy);
        const B = s.free(bx, by);
        fc.pre(far(s, A, V, 30) && far(s, B, V, 30));
        const u1 = Math.atan2(ay - vy, ax - vx);
        const u2 = Math.atan2(by - vy, bx - vx);
        let d = Math.abs(u1 - u2);
        if (d > Math.PI) d = 2 * Math.PI - d;
        fc.pre(d > 0.2 && d < Math.PI - 0.2);
        s.line(V, A);
        const vb = s.line(V, B);
        const [tool] = s.tool('angleBisector', [A, V, B]);
        const m = angleBisectorMacro(s, A, V, B, vb);
        sameLine(s.get(tool), s.get(m));
      }),
    );
  });

  it('reflections', () => {
    fc.assert(
      fc.property(c, c, c, c, c, c, (ax, ay, bx, by, px, py) => {
        const s = new Scratch();
        const A = s.free(ax, ay);
        const B = s.free(bx, by);
        fc.pre(far(s, A, B));
        const l = s.line(A, B);
        const X = s.free(px, py);
        const g = s.get(l);
        fc.pre(g.k === 'line' && Math.abs(g.dx * (py - g.py) - g.dy * (px - g.px)) > 10);
        const [tool] = s.tool('reflectLine', [X, l]);
        const m = reflectLineMacro(s, X, l);
        samePt(s.get(tool), s.get(m));

        fc.pre(far(s, X, A));
        const [tool2] = s.tool('reflectPoint', [X, A]);
        const m2 = reflectPointMacro(s, X, A);
        samePt(s.get(tool2), s.get(m2));
      }),
    );
  });

  it('midpoint matches the perpendicular-bisector recipe', () => {
    const s = new Scratch();
    const A = s.free(-80, 10);
    const B = s.free(120, 60);
    const [mNoLine] = s.tool('midpoint', [A, B]);
    const ab = s.line(A, B);
    const [mLine] = s.tool('midpoint', [A, B]);
    const m = midpointMacro(s, A, B, ab);
    samePt(s.get(mLine), s.get(m));
    samePt(s.get(mNoLine), s.get(m));
  });
});
