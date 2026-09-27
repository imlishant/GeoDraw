import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { Scratch } from './scratch';
import { build } from '../src/engine/build';
import { evaluateDoc } from '../src/engine/evaluate';
import { UNIT, measureValue } from '../src/engine/measure';
import type { GCircle, Geo, GLine, Id, Vec } from '../src/engine/types';

// Every tool, checked against the geometry it promises, over random inputs
// (same code path the UI uses: engine/build.ts via Scratch.tool).

const RUNS = { numRuns: 300 };
// integers/100: well spread, without doubles' pile-up on 0 and the range ends
const coord = fc.integer({ min: -30000, max: 30000 }).map((n) => n / 100);
const pt = fc.record({ x: coord, y: coord });
const EPS = 1e-6;

const d = (a: Vec, b: Vec) => Math.hypot(a.x - b.x, a.y - b.y);
const L = (g: Geo | undefined): GLine => {
  if (!g || g.k !== 'line') throw new Error(`expected a line, got ${g?.k}`);
  return g;
};
const C = (g: Geo | undefined): GCircle => {
  if (!g || g.k !== 'circle') throw new Error(`expected a circle, got ${g?.k}`);
  return g;
};
const P = (g: Geo | undefined): Vec => {
  if (!g || g.k !== 'point') throw new Error(`expected a point, got ${g?.k}`);
  return g;
};
/** distance from p to the infinite carrier of l */
const toLine = (l: GLine, p: Vec) => Math.abs(l.dx * (p.y - l.py) - l.dy * (p.x - l.px));
const parallel = (a: GLine, b: GLine) => Math.abs(a.dx * b.dy - a.dy * b.dx) < 1e-9;
const perpendicular = (a: GLine, b: GLine) => Math.abs(a.dx * b.dx + a.dy * b.dy) < 1e-9;
const far = (...ps: Vec[]) => ps.every((a, i) => ps.every((b, j) => i === j || d(a, b) > 5));

function scene(...ps: Vec[]) {
  const s = new Scratch();
  const ids = ps.map((p) => s.free(p.x, p.y));
  return { s, ids, g: (id: Id) => s.values.get(id) ?? undefined };
}

describe('lines', () => {
  it('Line / Segment / Ray / Vector pass through both points with the right extent', () => {
    fc.assert(
      fc.property(pt, pt, (a, b) => {
        fc.pre(far(a, b));
        const { s, ids, g } = scene(a, b);
        const [line] = s.tool('line', ids);
        const [seg] = s.tool('segment', ids);
        const [ray] = s.tool('ray', ids);
        const [vec] = s.tool('vector', ids);
        for (const id of [line, seg, ray, vec]) {
          const l = L(g(id));
          expect(toLine(l, a)).toBeLessThan(EPS);
          expect(toLine(l, b)).toBeLessThan(EPS);
        }
        expect(L(g(line)).t0).toBe(-Infinity);
        expect(L(g(seg)).t0).toBe(0);
        expect(L(g(seg)).t1).toBeCloseTo(d(a, b), 9);
        expect(L(g(ray)).t0).toBe(0);
        expect(L(g(ray)).t1).toBe(Infinity);
        expect(s.doc.objects[vec].style?.arrow).toBe(true);
      }),
      RUNS,
    );
  });

  it('Perpendicular bisector: every point on it is equidistant from A and B', () => {
    fc.assert(
      fc.property(pt, pt, fc.double({ min: -500, max: 500, noNaN: true }), (a, b, t) => {
        fc.pre(far(a, b));
        const { s, ids, g } = scene(a, b);
        const l = L(g(s.tool('perpBisector', ids)[0]));
        const q = { x: l.px + l.dx * t, y: l.py + l.dy * t };
        expect(Math.abs(d(q, a) - d(q, b))).toBeLessThan(1e-6 * Math.max(1, d(q, a)));
      }),
      RUNS,
    );
  });

  it('Perpendicular and Parallel pass through P, at the right angle, in either input order', () => {
    fc.assert(
      fc.property(pt, pt, pt, fc.boolean(), (a, b, p, swap) => {
        fc.pre(far(a, b));
        const { s, ids, g } = scene(a, b, p);
        const base = s.tool('line', [ids[0], ids[1]])[0];
        const inputs = swap ? [ids[2], base] : [base, ids[2]];
        const perp = L(g(s.tool('perpendicular', inputs)[0]));
        const par = L(g(s.tool('parallel', inputs)[0]));
        expect(toLine(perp, p)).toBeLessThan(EPS);
        expect(toLine(par, p)).toBeLessThan(EPS);
        expect(perpendicular(perp, L(g(base)))).toBe(true);
        expect(parallel(par, L(g(base)))).toBe(true);
      }),
      RUNS,
    );
  });

  it('Perpendicular/Parallel work on derived lines and segments too', () => {
    const { s, ids, g } = scene({ x: -50, y: 0 }, { x: 60, y: 20 }, { x: 10, y: 90 });
    const seg = s.tool('segment', [ids[0], ids[1]])[0];
    const pb = s.tool('perpBisector', [ids[0], ids[1]])[0];
    const p1 = L(g(s.tool('perpendicular', [seg, ids[2]])[0]));
    const p2 = L(g(s.tool('parallel', [pb, ids[2]])[0]));
    expect(perpendicular(p1, L(g(seg)))).toBe(true);
    expect(parallel(p2, L(g(pb)))).toBe(true);
    expect(p1.t0).toBe(-Infinity); // result is a full line even from a segment
  });

  it('Angle bisector: through V, equidistant from both sides, inside the angle', () => {
    fc.assert(
      fc.property(pt, pt, pt, (a, v, b) => {
        fc.pre(far(a, v, b));
        const u1 = Math.atan2(a.y - v.y, a.x - v.x);
        const u2 = Math.atan2(b.y - v.y, b.x - v.x);
        let ang = Math.abs(u1 - u2);
        if (ang > Math.PI) ang = 2 * Math.PI - ang;
        fc.pre(ang > 0.05 && ang < Math.PI - 0.05);
        const { s, ids, g } = scene(a, v, b);
        const bis = L(g(s.tool('angleBisector', ids)[0]));
        const sideA = L(g(s.line(ids[1], ids[0])));
        const sideB = L(g(s.line(ids[1], ids[2])));
        expect(toLine(bis, v)).toBeLessThan(EPS);
        const q = { x: v.x + bis.dx * 50, y: v.y + bis.dy * 50 };
        expect(Math.abs(toLine(sideA, q) - toLine(sideB, q))).toBeLessThan(1e-6);
        // internal: the bisector direction splits the angle (dot with both sides > cos(angle))
        const da = { x: (a.x - v.x) / d(a, v), y: (a.y - v.y) / d(a, v) };
        const db = { x: (b.x - v.x) / d(b, v), y: (b.y - v.y) / d(b, v) };
        expect(bis.dx * da.x + bis.dy * da.y).toBeCloseTo(bis.dx * db.x + bis.dy * db.y, 6);
        expect(bis.dx * da.x + bis.dy * da.y).toBeGreaterThan(0);
      }),
      RUNS,
    );
  });

  it('Angle bisector of a straight angle is the perpendicular at the vertex', () => {
    const { s, ids, g } = scene({ x: -100, y: 0 }, { x: 0, y: 0 }, { x: 100, y: 0 });
    const bis = L(g(s.tool('angleBisector', ids)[0]));
    expect(Math.abs(bis.dx)).toBeLessThan(1e-9);
  });

  it('Tangents: through P and touching the circle; 2 outside, 1 on it, none inside', () => {
    fc.assert(
      fc.property(pt, pt, fc.double({ min: 10, max: 200, noNaN: true }), (o, p, r) => {
        const dist = d(o, p);
        fc.pre(dist > r + 1);
        const { s, ids, g } = scene(o, { x: o.x + r, y: o.y }, p);
        const c = s.tool('circle', [ids[0], ids[1]])[0];
        const ts = s.tool('tangents', [ids[2], c]);
        expect(ts).toHaveLength(2);
        for (const t of ts) {
          const l = L(g(t));
          expect(toLine(l, p)).toBeLessThan(EPS);
          expect(Math.abs(toLine(l, o) - r)).toBeLessThan(1e-6 * Math.max(1, r));
        }
      }),
      RUNS,
    );
    const { s, ids } = scene({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 20, y: 10 });
    const c = s.tool('circle', [ids[0], ids[1]])[0];
    expect(() => s.tool('tangents', [ids[2], c])).toThrow(/inside/);
    expect(s.tool('tangents', [c, ids[1]])).toHaveLength(1); // on the circle, circle picked first
  });
});

describe('circles', () => {
  it('Circle, Compass (points or a circle as radius) and Circle-with-radius', () => {
    fc.assert(
      fc.property(pt, pt, pt, pt, (c, p, a, b) => {
        fc.pre(far(c, p) && far(a, b));
        const { s, ids, g } = scene(c, p, a, b);
        const k = C(g(s.tool('circle', [ids[0], ids[1]])[0]));
        expect(k.cx).toBe(c.x);
        expect(k.r).toBeCloseTo(d(c, p), 9);
        const comp = C(g(s.tool('compass', [ids[2], ids[3], ids[0]])[0]));
        expect(comp.r).toBeCloseTo(d(a, b), 9);
        expect(comp.cx).toBe(c.x);
        const kid = s.doc.order.find((id) => s.doc.objects[id].kind === 'circle')!;
        const fromCircle = C(g(s.tool('compass', [kid, ids[3]])[0]));
        expect(fromCircle.r).toBeCloseTo(k.r, 9);
        expect(fromCircle.cx).toBe(b.x);
      }),
      RUNS,
    );
    const { s, ids, g } = scene({ x: 5, y: 5 });
    expect(C(g(s.tool('circleRadius', ids, 1.5)[0])).r).toBeCloseTo(1.5 * UNIT, 9);
    expect(() => s.tool('circleRadius', ids, 0)).toThrow(/positive/);
  });

  it('Semicircle: on diameter AB, from A sweeping half a turn', () => {
    fc.assert(
      fc.property(pt, pt, (a, b) => {
        fc.pre(far(a, b));
        const { s, ids, g } = scene(a, b);
        const k = C(g(s.tool('semicircle', ids)[0]));
        expect(k.r).toBeCloseTo(d(a, b) / 2, 9);
        expect(k.a1! - k.a0!).toBeCloseTo(Math.PI, 12);
        expect(k.cx + k.r * Math.cos(k.a0!)).toBeCloseTo(a.x, 6);
        expect(k.cx + k.r * Math.cos(k.a1!)).toBeCloseTo(b.x, 6);
      }),
      RUNS,
    );
  });

  it('Sector: around C, radius |CA|, from A to the ray CB', () => {
    fc.assert(
      fc.property(pt, pt, pt, (c, a, b) => {
        fc.pre(far(c, a, b));
        const { s, ids, g } = scene(c, a, b);
        const k = C(g(s.tool('sector', ids)[0]));
        expect(k.r).toBeCloseTo(d(c, a), 9);
        const end = { x: k.cx + k.r * Math.cos(k.a1!), y: k.cy + k.r * Math.sin(k.a1!) };
        const ray = Math.atan2(b.y - c.y, b.x - c.x);
        expect(Math.cos(Math.atan2(end.y - c.y, end.x - c.x) - ray)).toBeCloseTo(1, 9);
        expect(s.doc.objects[s.doc.order.at(-1)!].style?.sector).toBe(true);
      }),
      RUNS,
    );
  });
});

describe('points', () => {
  it('Intersect: creates every crossing, on both objects, no duplicates', () => {
    fc.assert(
      fc.property(pt, fc.integer({ min: -150, max: 150 }), fc.integer({ min: -150, max: 150 }), fc.integer({ min: 20, max: 150 }), fc.integer({ min: 20, max: 150 }), (c1, ox, oy, r1, r2) => {
        const c2 = { x: c1.x + ox, y: c1.y + oy };
        const dd = d(c1, c2);
        fc.pre(dd < r1 + r2 - 1 && dd > Math.abs(r1 - r2) + 1);
        const { s, ids, g } = scene(c1, { x: c1.x + r1, y: c1.y }, c2, { x: c2.x + r2, y: c2.y });
        const a = s.tool('circle', [ids[0], ids[1]])[0];
        const b = s.tool('circle', [ids[2], ids[3]])[0];
        const pts = s.tool('intersect', [a, b]);
        expect(pts).toHaveLength(2);
        for (const id of pts) {
          const q = P(g(id));
          expect(Math.abs(d(q, c1) - r1)).toBeLessThan(1e-6);
          expect(Math.abs(d(q, c2) - r2)).toBeLessThan(1e-6);
        }
        expect(() => s.tool('intersect', [a, b])).toThrow(/already exist/);
      }),
      RUNS,
    );
  });

  it('Intersect edge cases: parallel lines, tangent circles, same object, segment ends', () => {
    const { s, ids } = scene({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 50 }, { x: 100, y: 50 }, { x: 200, y: 0 });
    const l1 = s.tool('line', [ids[0], ids[1]])[0];
    const l2 = s.tool('line', [ids[2], ids[3]])[0];
    expect(() => s.tool('intersect', [l1, l2])).toThrow(/don't intersect/);
    expect(() => s.tool('intersect', [l1, l1])).toThrow(/different/);
    // tangent circles touch once
    const c1 = s.tool('circle', [ids[0], ids[1]])[0]; // r 100 at origin
    const c2 = s.tool('circle', [ids[4], ids[1]])[0]; // r 100 at (200, 0)
    expect(() => s.tool('intersect', [c1, c2])).toThrow(/already exist/); // the touch point is B
    // a segment only intersects within its ends
    const seg = s.tool('segment', [ids[2], ids[3]])[0];
    const q = s.free(300, -100);
    const w = s.free(300, 100);
    const vert = s.tool('line', [q, w])[0]; // x = 300: misses the segment
    expect(() => s.tool('intersect', [seg, vert])).toThrow(/don't intersect/);
  });

  it('Midpoint: of two points, of a segment, and the center of a circle', () => {
    fc.assert(
      fc.property(pt, pt, (a, b) => {
        fc.pre(far(a, b));
        const { s, ids, g } = scene(a, b);
        const m = P(g(s.tool('midpoint', ids)[0]));
        expect(d(m, a)).toBeCloseTo(d(m, b), 6);
        expect(d(m, a) + d(m, b)).toBeCloseTo(d(a, b), 6);
        const seg = s.tool('segment', ids)[0];
        const m2 = P(g(s.tool('midpoint', [seg])[0]));
        expect(d(m, m2)).toBeLessThan(EPS);
        const k = s.tool('circle', ids)[0];
        expect(d(P(g(s.tool('midpoint', [k])[0])), a)).toBeLessThan(EPS);
      }),
      RUNS,
    );
  });

  it('Segment with length and Angle with given size', () => {
    fc.assert(
      fc.property(pt, pt, fc.double({ min: 0.1, max: 5, noNaN: true }), fc.double({ min: -350, max: 350, noNaN: true }), (a, v, len, deg) => {
        fc.pre(far(a, v));
        const { s, ids, g } = scene(a, v);
        const [b, seg] = s.tool('segmentLength', [ids[0]], len);
        expect(d(P(g(b)), a)).toBeCloseTo(len * UNIT, 6);
        expect(L(g(seg)).t1).toBeCloseTo(len * UNIT, 6);
        const [p2] = s.tool('angleSize', [ids[0], ids[1]], deg);
        const got = Math.atan2(P(g(p2)).y - v.y, P(g(p2)).x - v.x) - Math.atan2(a.y - v.y, a.x - v.x);
        expect(Math.cos(got - (deg * Math.PI) / 180)).toBeCloseTo(1, 9);
        expect(d(P(g(p2)), v)).toBeCloseTo(d(a, v), 6);
      }),
      RUNS,
    );
  });
});

describe('polygons', () => {
  it('Polygon: n sides as segments plus a region, closing on the first point', () => {
    const { s, ids, g } = scene({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 120, y: 80 }, { x: 10, y: 60 });
    const out = s.tool('polygon', [...ids, ids[0]]);
    expect(out).toHaveLength(5);
    expect(out.slice(0, 4).every((id) => s.doc.objects[id].kind === 'line')).toBe(true);
    const region = g(out[4]);
    expect(region?.k).toBe('region');
    expect(() => s.tool('polygon', [ids[0], ids[1]])).toThrow(/at least 3/);
  });

  it('Regular polygon: equal sides and a common circumcenter, for n = 3…12', () => {
    fc.assert(
      fc.property(pt, pt, fc.integer({ min: 3, max: 12 }), (a, b, n) => {
        fc.pre(far(a, b));
        const { s, ids, g } = scene(a, b);
        const out = s.tool('regularPolygon', ids, n);
        const region = g(out.at(-1)!);
        if (!region || region.k !== 'region') throw new Error('no region');
        expect(region.pts).toHaveLength(n);
        const side = d(a, b);
        const cx = region.pts.reduce((x, p) => x + p.x, 0) / n;
        const cy = region.pts.reduce((y, p) => y + p.y, 0) / n;
        const R = d(region.pts[0], { x: cx, y: cy });
        region.pts.forEach((p, i) => {
          expect(d(p, region.pts[(i + 1) % n])).toBeCloseTo(side, 6);
          expect(d(p, { x: cx, y: cy })).toBeCloseTo(R, 6);
        });
      }),
      RUNS,
    );
    const { s, ids } = scene({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(() => s.tool('regularPolygon', ids, 2)).toThrow(/3–60/);
  });
});

describe('transforms', () => {
  it('Reflect in a line: distances to the mirror are kept; twice = identity; works on lines and circles', () => {
    fc.assert(
      fc.property(pt, pt, pt, pt, (m1, m2, x, y) => {
        fc.pre(far(m1, m2) && far(x, y));
        const { s, ids, g } = scene(m1, m2, x, y);
        const mirror = s.tool('line', [ids[0], ids[1]])[0];
        const [x1] = s.tool('reflectLine', [ids[2], mirror]);
        const [x2] = s.tool('reflectLine', [x1, mirror]);
        expect(d(P(g(x2)), x)).toBeLessThan(1e-6);
        expect(toLine(L(g(mirror)), P(g(x1)))).toBeCloseTo(toLine(L(g(mirror)), x), 6);
        const circ = s.tool('circle', [ids[2], ids[3]])[0];
        const cImg = C(g(s.tool('reflectLine', [circ, mirror])[0]));
        expect(cImg.r).toBeCloseTo(d(x, y), 6);
        expect(d({ x: cImg.cx, y: cImg.cy }, P(g(x1)))).toBeLessThan(1e-6);
        const seg = s.tool('segment', [ids[2], ids[3]])[0];
        const sImg = L(g(s.tool('reflectLine', [seg, mirror])[0]));
        expect(sImg.t1 - sImg.t0).toBeCloseTo(d(x, y), 6); // still a segment of the same length
      }),
      RUNS,
    );
  });

  it('Reflect in a point, Translate, Rotate, Dilate (point-defined) and their typed versions', () => {
    fc.assert(
      fc.property(pt, pt, pt, pt, pt, (c, a, b, v, x) => {
        fc.pre(far(c, a, b, v, x));
        const { s, ids, g } = scene(c, a, b, v, x);
        const [ci, ai, bi, vi, xi] = ids;
        // point reflection: C is the midpoint of X and X'
        const xr = P(g(s.tool('reflectPoint', [xi, ci])[0]));
        expect(d({ x: (xr.x + x.x) / 2, y: (xr.y + x.y) / 2 }, c)).toBeLessThan(1e-6);
        // translation by A→B
        const xt = P(g(s.tool('translate', [xi, ai, bi])[0]));
        expect(xt.x - x.x).toBeCloseTo(b.x - a.x, 6);
        expect(xt.y - x.y).toBeCloseTo(b.y - a.y, 6);
        // rotation about C by angle A-V-B
        const xrot = P(g(s.tool('rotate', [xi, ci, ai, vi, bi])[0]));
        expect(d(xrot, c)).toBeCloseTo(d(x, c), 6);
        const want = Math.atan2(b.y - v.y, b.x - v.x) - Math.atan2(a.y - v.y, a.x - v.x);
        const got = Math.atan2(xrot.y - c.y, xrot.x - c.x) - Math.atan2(x.y - c.y, x.x - c.x);
        expect(Math.cos(got - want)).toBeCloseTo(1, 9);
        // dilation from C with ratio |CB| / |CA|
        const xd = P(g(s.tool('dilate', [xi, ci, ai, bi])[0]));
        expect(d(xd, c)).toBeCloseTo((d(x, c) * d(b, c)) / d(a, c), 5);
        expect(Math.abs((xd.x - c.x) * (x.y - c.y) - (xd.y - c.y) * (x.x - c.x))).toBeLessThan(1e-4 * Math.max(1, d(xd, c) * d(x, c)));
        // typed versions
        const xr90 = P(g(s.tool('rotateBy', [xi, ci], 90)[0]));
        expect((xr90.x - c.x) * (x.x - c.x) + (xr90.y - c.y) * (x.y - c.y)).toBeLessThan(1e-6 * Math.max(1, d(x, c) ** 2));
        const x2 = P(g(s.tool('dilateBy', [xi, ci], 2)[0]));
        expect(d(x2, c)).toBeCloseTo(2 * d(x, c), 6);
      }),
      RUNS,
    );
    const { s, ids } = scene({ x: 0, y: 0 }, { x: 10, y: 0 });
    expect(() => s.tool('dilateBy', ids, -1)).toThrow(/positive/);
  });

  it('Transforms keep arcs as arcs of the same sweep (reflection flips direction)', () => {
    const { s, ids, g } = scene({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 0, y: 100 }, { x: -50, y: -200 }, { x: 50, y: -200 });
    const arc = s.tool('sector', [ids[0], ids[1], ids[2]])[0]; // quarter arc
    const mirror = s.tool('line', [ids[3], ids[4]])[0]; // y = -200
    const img = C(g(s.tool('reflectLine', [arc, mirror])[0]));
    expect(img.a1! - img.a0!).toBeCloseTo(Math.PI / 2, 9);
    // reflected quarter lies below the mirror: its start point is the image of the arc's END (0,100) → (0,-500)
    expect(img.cx + img.r * Math.cos(img.a0!)).toBeCloseTo(0, 6);
    expect(img.cy + img.r * Math.sin(img.a0!)).toBeCloseTo(-500, 6);
  });
});

describe('measures', () => {
  it('distance, angle and area on known shapes', () => {
    const s = new Scratch();
    const a = s.free(0, 0);
    const b = s.free(300, 0);
    const c = s.free(0, 400);
    const [poly] = s.tool('polygon', [a, b, c, a]).slice(-1);
    const k = s.tool('circle', [a, b])[0];
    const v = s.values;
    expect(measureValue({ id: 'm', t: 'distance', a: b, b: c }, v).value).toBeCloseTo(5, 9); // 3-4-5 in units
    expect(measureValue({ id: 'm', t: 'angle', a: b, v: a, b: c }, v).value).toBeCloseTo(90, 9);
    expect(measureValue({ id: 'm', t: 'area', of: poly }, v).value).toBeCloseTo(6, 9);
    expect(measureValue({ id: 'm', t: 'area', of: k }, v).value).toBeCloseTo(Math.PI * 9, 9);
  });
});

describe('degenerate inputs never produce garbage', () => {
  it('coincident points give undefined objects, not NaN', () => {
    const s = new Scratch();
    const a = s.free(10, 10);
    const b = s.free(10, 10);
    for (const tool of ['line', 'circle', 'perpBisector', 'segment', 'semicircle'] as const) {
      const res = build(tool, [a, b], { doc: s.doc, values: s.values, obj: (id) => s.doc.objects[id] });
      for (const o of res.objs) {
        s.doc.objects[o.id] = o;
        s.doc.order.push(o.id);
      }
    }
    const vals = evaluateDoc(s.doc);
    for (const id of s.doc.order.slice(2)) expect(vals.get(id)).toBeNull();
  });
});
