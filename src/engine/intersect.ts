import type { Curve, GCircle, GLine, Vec } from './types';
import { REL, tol } from './tolerance';
import { normAngle } from './vec';

// Intersections are computed on the carrier (infinite line / full circle) and
// ordered by the parents' orientation, so a root's index never swaps while the
// figure moves continuously. Tangency returns a double root [T, T] so both
// indices stay defined through the touching moment. Clip (segment/ray/arc) is
// checked separately by `onCurve`.

const TAU = Math.PI * 2;

export function lineLine(a: GLine, b: GLine): Vec[] {
  const den = a.dx * b.dy - a.dy * b.dx; // unit directions → |den| = sin(angle)
  if (Math.abs(den) <= REL * 10) return []; // parallel or identical
  const qx = b.px - a.px;
  const qy = b.py - a.py;
  const t = (qx * b.dy - qy * b.dx) / den;
  return [{ x: a.px + a.dx * t, y: a.py + a.dy * t }];
}

export function lineCircle(l: GLine, c: GCircle): Vec[] {
  const fx = c.cx - l.px;
  const fy = c.cy - l.py;
  const proj = fx * l.dx + fy * l.dy;
  const dd = Math.abs(l.dx * fy - l.dy * fx); // distance center → line
  const eps = tol(c.r, c.cx, c.cy, l.px, l.py);
  if (dd > c.r + eps) return [];
  const h = Math.abs(dd - c.r) <= eps ? 0 : Math.sqrt(Math.max(0, (c.r - dd) * (c.r + dd)));
  const t0 = proj - h;
  const t1 = proj + h;
  return [
    { x: l.px + l.dx * t0, y: l.py + l.dy * t0 },
    { x: l.px + l.dx * t1, y: l.py + l.dy * t1 },
  ];
}

export function circleCircle(a: GCircle, b: GCircle): Vec[] {
  const ex = b.cx - a.cx;
  const ey = b.cy - a.cy;
  const d = Math.hypot(ex, ey);
  const eps = tol(a.r, b.r, a.cx, a.cy, b.cx, b.cy);
  if (d <= eps) return []; // concentric (or identical): no isolated points
  const sum = a.r + b.r;
  const diff = Math.abs(a.r - b.r);
  if (d > sum + eps || d < diff - eps) return [];
  const ux = ex / d;
  const uy = ey / d;
  const along = (a.r * a.r - b.r * b.r + d * d) / (2 * d);
  const tangent = Math.abs(d - sum) <= eps || Math.abs(d - diff) <= eps;
  const h = tangent ? 0 : Math.sqrt(Math.max(0, a.r * a.r - along * along));
  const bx = a.cx + ux * along;
  const by = a.cy + uy * along;
  // i = 0 is on the left of the direction a → b (y-up)
  return [
    { x: bx - uy * h, y: by + ux * h },
    { x: bx + uy * h, y: by - ux * h },
  ];
}

/** All carrier roots of two curves, in stable index order. */
export function roots(a: Curve, b: Curve): Vec[] {
  if (a.k === 'line' && b.k === 'line') return lineLine(a, b);
  if (a.k === 'line' && b.k === 'circle') return lineCircle(a, b);
  if (a.k === 'circle' && b.k === 'line') return lineCircle(b, a);
  if (a.k === 'circle' && b.k === 'circle') return circleCircle(a, b);
  return [];
}

/** Is p (assumed on the carrier) inside the curve's clip? */
export function onCurve(p: Vec, c: Curve): boolean {
  if (c.k === 'line') {
    if (c.t0 === -Infinity && c.t1 === Infinity) return true;
    const t = (p.x - c.px) * c.dx + (p.y - c.py) * c.dy;
    const eps = Math.max(tol(c.px, c.py, p.x, p.y), 1e-7 * c.s);
    return t >= c.t0 - eps && t <= c.t1 + eps;
  }
  if (c.a0 === undefined || c.a1 === undefined) return true;
  const ang = Math.atan2(p.y - c.cy, p.x - c.cx);
  const da = normAngle(ang - c.a0);
  const sweep = c.a1 - c.a0;
  const eps = 1e-9;
  return da <= sweep + eps || da >= TAU - eps;
}

/** Distance from p to the (clipped) curve, used for hit-testing and snapping. */
export function distToCurve(p: Vec, c: Curve): number {
  if (c.k === 'line') {
    let t = (p.x - c.px) * c.dx + (p.y - c.py) * c.dy;
    t = Math.min(Math.max(t, c.t0), c.t1);
    return Math.hypot(p.x - (c.px + c.dx * t), p.y - (c.py + c.dy * t));
  }
  const dx = p.x - c.cx;
  const dy = p.y - c.cy;
  const d = Math.hypot(dx, dy);
  if (c.a0 === undefined || c.a1 === undefined) return Math.abs(d - c.r);
  const q = projectToCurve(p, c);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Closest point on the (clipped) curve. */
export function projectToCurve(p: Vec, c: Curve): Vec {
  if (c.k === 'line') {
    let t = (p.x - c.px) * c.dx + (p.y - c.py) * c.dy;
    t = Math.min(Math.max(t, c.t0), c.t1);
    return { x: c.px + c.dx * t, y: c.py + c.dy * t };
  }
  let ang = Math.atan2(p.y - c.cy, p.x - c.cx);
  if (c.a0 !== undefined && c.a1 !== undefined) ang = clampToArc(ang, c.a0, c.a1);
  return { x: c.cx + c.r * Math.cos(ang), y: c.cy + c.r * Math.sin(ang) };
}

export function clampToArc(ang: number, a0: number, a1: number): number {
  const sweep = a1 - a0;
  const da = normAngle(ang - a0);
  if (da <= sweep) return a0 + da;
  // outside: snap to nearer end
  const toEnd = da - sweep;
  const toStart = TAU - da;
  return toEnd < toStart ? a1 : a0;
}
