// Original problem set, based on classic constructions from Euclid's Elements
// (public domain). Not copied from Euclidea's levels (PLAN.md §3.3).
// Each problem has givens, goal targets and a reference solution; tests check
// that every reference solution passes the checker.

import type { Doc, Geo, GPoint, Id, ToolId, Vec } from './types';
import type { Target, TargetFn } from './checker';
import { Scratch } from './scratch';
import { newDoc } from './doc';
import { tangentPoints, regularVertices } from './evaluate';

export interface Problem {
  id: string;
  title: string;
  statement: string;
  group: 'Basics' | 'Circles' | 'Figures';
  /** Allowed construction tools (measure/edit tools are always allowed). */
  tools: ToolId[];
  setup(s: Scratch): Record<string, Id>;
  targets: TargetFn;
  solve(s: Scratch, g: Record<string, Id>): void;
}

export const TIER_A_TOOLS: ToolId[] = [
  'point',
  'line',
  'circle',
  'perpBisector',
  'perpendicular',
  'angleBisector',
  'parallel',
  'compass',
  'intersect',
];

const G = { given: true } as const;
const P = (g: (n: string) => Geo, n: string): GPoint => g(n) as GPoint;
const lineT = (p: Vec, q: Vec): Target => ({ k: 'line', px: p.x, py: p.y, dx: q.x - p.x, dy: q.y - p.y });
const lineDirT = (p: Vec, dx: number, dy: number): Target => ({ k: 'line', px: p.x, py: p.y, dx, dy });
const pointT = (p: Vec): Target => ({ k: 'point', x: p.x, y: p.y });
const rot = (o: Vec, p: Vec, ang: number): Vec => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: o.x + (p.x - o.x) * c - (p.y - o.y) * s, y: o.y + (p.x - o.x) * s + (p.y - o.y) * c };
};
const circleOf = (g: Geo) => {
  if (g.k !== 'circle') throw new Error('not a circle');
  return g;
};

function segmentGivens(s: Scratch): Record<string, Id> {
  const A = s.free(-100, -40, { ...G, name: 'A' });
  const B = s.free(100, -40, { ...G, name: 'B' });
  const AB = s.line(A, B, 'segment', { ...G, name: 'AB' });
  return { A, B, AB };
}

export const PROBLEMS: Problem[] = [
  {
    id: 'equilateral',
    title: 'Equilateral triangle',
    statement: 'Construct an equilateral triangle with side AB. (Elements I.1)',
    group: 'Basics',
    tools: TIER_A_TOOLS,
    setup: segmentGivens,
    targets: (g) => {
      const A = P(g, 'A');
      const B = P(g, 'B');
      return [1, -1].map((sgn) => {
        const C = rot(A, B, (sgn * Math.PI) / 3);
        return [lineT(A, C), lineT(B, C)];
      });
    },
    solve: (s, g) => {
      const [c1] = s.tool('circle', [g.A, g.B]);
      const [c2] = s.tool('circle', [g.B, g.A]);
      const pts = s.tool('intersect', [c1, c2]);
      s.tool('line', [g.A, pts[0]]);
      s.tool('line', [g.B, pts[0]]);
    },
  },
  {
    id: 'midpoint',
    title: 'Midpoint',
    statement: 'Construct the midpoint of segment AB. (Elements I.10)',
    group: 'Basics',
    tools: TIER_A_TOOLS,
    setup: segmentGivens,
    targets: (g) => {
      const A = P(g, 'A');
      const B = P(g, 'B');
      return [[pointT({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 })]];
    },
    solve: (s, g) => {
      const [pb] = s.tool('perpBisector', [g.A, g.B]);
      s.tool('intersect', [pb, g.AB]);
    },
  },
  {
    id: 'perp-bisector',
    title: 'Perpendicular bisector',
    statement: 'Construct the perpendicular bisector of segment AB using only lines and circles.',
    group: 'Basics',
    tools: ['point', 'line', 'circle', 'intersect'],
    setup: segmentGivens,
    targets: (g) => {
      const A = P(g, 'A');
      const B = P(g, 'B');
      return [[lineDirT({ x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 }, -(B.y - A.y), B.x - A.x)]];
    },
    solve: (s, g) => {
      const [c1] = s.tool('circle', [g.A, g.B]);
      const [c2] = s.tool('circle', [g.B, g.A]);
      const [p, q] = s.tool('intersect', [c1, c2]);
      s.tool('line', [p, q]);
    },
  },
  {
    id: 'angle-bisector',
    title: 'Angle bisector',
    statement: 'Bisect the angle between rays VA and VB using only lines and circles. (Elements I.9)',
    group: 'Basics',
    tools: ['point', 'line', 'circle', 'intersect'],
    setup: (s) => {
      const V = s.free(-120, -60, { ...G, name: 'V' });
      const A = s.free(120, -40, { ...G, name: 'A' });
      const B = s.free(10, 150, { ...G, name: 'B' });
      const VA = s.line(V, A, 'ray', { ...G, name: 'VA' });
      const VB = s.line(V, B, 'ray', { ...G, name: 'VB' });
      return { V, A, B, VA, VB };
    },
    targets: (g) => {
      const V = P(g, 'V');
      const A = P(g, 'A');
      const B = P(g, 'B');
      const la = Math.hypot(A.x - V.x, A.y - V.y);
      const lb = Math.hypot(B.x - V.x, B.y - V.y);
      return [[lineDirT(V, (A.x - V.x) / la + (B.x - V.x) / lb, (A.y - V.y) / la + (B.y - V.y) / lb)]];
    },
    solve: (s, g) => {
      const [c1] = s.tool('circle', [g.V, g.A]);
      const pts = s.tool('intersect', [c1, g.VB]);
      const [c2] = s.tool('circle', [g.A, g.V]);
      const [c3] = s.tool('circle', [pts[0], g.V]);
      const w = s.tool('intersect', [c2, c3]);
      s.tool('line', [g.V, w[0]]);
    },
  },
  {
    id: 'drop-perpendicular',
    title: 'Drop a perpendicular',
    statement: 'Construct the line through P perpendicular to line l. (Elements I.12)',
    group: 'Basics',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const Q = s.free(-150, -60, { ...G, name: 'Q' });
      const R = s.free(150, -20, { ...G, name: 'R' });
      const l = s.line(Q, R, 'line', { ...G, name: 'l' });
      const Pp = s.free(10, 90, { ...G, name: 'P' });
      return { Q, R, l, P: Pp };
    },
    targets: (g) => {
      const Q = P(g, 'Q');
      const R = P(g, 'R');
      return [[lineDirT(P(g, 'P'), -(R.y - Q.y), R.x - Q.x)]];
    },
    solve: (s, g) => {
      s.tool('perpendicular', [g.l, g.P]);
    },
  },
  {
    id: 'parallel',
    title: 'Parallel through a point',
    statement: 'Construct the line through P parallel to line l using only lines and circles. (Elements I.31)',
    group: 'Basics',
    tools: ['point', 'line', 'circle', 'intersect'],
    setup: (s) => {
      const Q = s.free(-150, -60, { ...G, name: 'Q' });
      const R = s.free(150, -20, { ...G, name: 'R' });
      const l = s.line(Q, R, 'line', { ...G, name: 'l' });
      const Pp = s.free(10, 90, { ...G, name: 'P' });
      return { Q, R, l, P: Pp };
    },
    targets: (g) => {
      const Q = P(g, 'Q');
      const R = P(g, 'R');
      return [[lineDirT(P(g, 'P'), R.x - Q.x, R.y - Q.y)]];
    },
    solve: (s, g) => {
      // Rhombus: circle Q through P meets l at X; circles P and X of the same radius meet at D.
      const [c1] = s.tool('circle', [g.Q, g.P]);
      const xs = s.tool('intersect', [c1, g.l]);
      const [c2] = s.tool('circle', [g.P, g.Q]);
      const [c3] = s.tool('circle', [xs[1], g.Q]);
      const ds = s.tool('intersect', [c2, c3]);
      const q = s.pt(g.Q);
      const far = ds.reduce((a, b) => (Math.hypot(s.pt(a).x - q.x, s.pt(a).y - q.y) > Math.hypot(s.pt(b).x - q.x, s.pt(b).y - q.y) ? a : b));
      s.tool('line', [g.P, far]);
    },
  },
  {
    id: 'reflect',
    title: 'Mirror image',
    statement: 'Construct the reflection of point P in line l.',
    group: 'Basics',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const Q = s.free(-150, -40, { ...G, name: 'Q' });
      const R = s.free(150, 0, { ...G, name: 'R' });
      const l = s.line(Q, R, 'line', { ...G, name: 'l' });
      const Pp = s.free(-20, 100, { ...G, name: 'P' });
      return { Q, R, l, P: Pp };
    },
    targets: (g) => {
      const Q = P(g, 'Q');
      const R = P(g, 'R');
      const p = P(g, 'P');
      const dx = R.x - Q.x;
      const dy = R.y - Q.y;
      const t = ((p.x - Q.x) * dx + (p.y - Q.y) * dy) / (dx * dx + dy * dy);
      const fx = Q.x + dx * t;
      const fy = Q.y + dy * t;
      return [[pointT({ x: 2 * fx - p.x, y: 2 * fy - p.y })]];
    },
    solve: (s, g) => {
      const [c1] = s.tool('circle', [g.Q, g.P]);
      const [c2] = s.tool('circle', [g.R, g.P]);
      s.tool('intersect', [c1, c2]);
    },
  },
  {
    id: 'square',
    title: 'Square on a segment',
    statement: 'Construct a square with side AB.',
    group: 'Figures',
    tools: TIER_A_TOOLS,
    setup: segmentGivens,
    targets: (g) => {
      const A = P(g, 'A');
      const B = P(g, 'B');
      return [1, -1].map((sgn) => {
        const D = rot(A, B, (sgn * Math.PI) / 2);
        const C = { x: B.x + D.x - A.x, y: B.y + D.y - A.y };
        return [lineT(A, D), lineT(B, C), lineT(C, D)];
      });
    },
    solve: (s, g) => {
      const [pa] = s.tool('perpendicular', [g.AB, g.A]);
      const [pb] = s.tool('perpendicular', [g.AB, g.B]);
      const [ca] = s.tool('circle', [g.A, g.B]);
      const [cb] = s.tool('circle', [g.B, g.A]);
      const ds = s.tool('intersect', [pa, ca]);
      const cs = s.tool('intersect', [pb, cb]);
      // same side of AB
      const side = (id: Id) => {
        const a = s.pt(g.A);
        const b = s.pt(g.B);
        const p = s.pt(id);
        return Math.sign((b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x));
      };
      const D = ds.find((d) => side(d) > 0)!;
      const C = cs.find((c) => side(c) > 0)!;
      s.tool('line', [C, D]);
    },
  },
  {
    id: 'center',
    title: 'Center of a circle',
    statement: 'Find the center of the circle. (Elements III.1)',
    group: 'Circles',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const O = s.free(10, 10, { ...G, name: 'O', hidden: true });
      const Q = s.free(130, 60, { ...G, name: 'Q', hidden: true });
      const c = s.circle(O, Q, { ...G, name: 'c' });
      return { O, Q, c };
    },
    targets: (g) => [[pointT(P(g, 'O'))]],
    solve: (s, g) => {
      const p1 = s.on(g.c, 0.3);
      const p2 = s.on(g.c, 2.1);
      const p3 = s.on(g.c, 4.0);
      const [b1] = s.tool('perpBisector', [p1, p2]);
      const [b2] = s.tool('perpBisector', [p2, p3]);
      s.tool('intersect', [b1, b2]);
    },
  },
  {
    id: 'tangent-at',
    title: 'Tangent at a point',
    statement: 'Construct the tangent to the circle at point P.',
    group: 'Circles',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const O = s.free(0, 0, { ...G, name: 'O' });
      const Q = s.free(120, 0, { ...G, name: 'Q', hidden: true });
      const c = s.circle(O, Q, { ...G, name: 'c' });
      const Pp = s.on(c, 1.1, { ...G, name: 'P', showLabel: true });
      return { O, Q, c, P: Pp };
    },
    targets: (g) => {
      const O = P(g, 'O');
      const p = P(g, 'P');
      return [[lineDirT(p, -(p.y - O.y), p.x - O.x)]];
    },
    solve: (s, g) => {
      const [op] = s.tool('line', [g.O, g.P]);
      s.tool('perpendicular', [op, g.P]);
    },
  },
  {
    id: 'tangent-from',
    title: 'Tangent from a point',
    statement: 'Construct a tangent from point P to the circle. (Elements III.17)',
    group: 'Circles',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const O = s.free(-40, 0, { ...G, name: 'O' });
      const Q = s.free(50, 0, { ...G, name: 'Q', hidden: true });
      const c = s.circle(O, Q, { ...G, name: 'c' });
      const Pp = s.free(170, 60, { ...G, name: 'P' });
      return { O, Q, c, P: Pp };
    },
    targets: (g) => {
      const p = P(g, 'P');
      const c = circleOf(g('c'));
      const ts = tangentPoints(p, c);
      if (!ts) throw new Error('inside');
      return ts.map((t) => [lineT(p, t)]);
    },
    solve: (s, g) => {
      const [op] = s.tool('line', [g.O, g.P]);
      const [pb] = s.tool('perpBisector', [g.O, g.P]);
      const [m] = s.tool('intersect', [pb, op]);
      const [k] = s.tool('circle', [m, g.O]);
      const ts = s.tool('intersect', [k, g.c]);
      s.tool('line', [g.P, ts[0]]);
    },
  },
  {
    id: 'circumcircle',
    title: 'Circle through three points',
    statement: 'Construct the circle through A, B and C. (Elements IV.5)',
    group: 'Circles',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const A = s.free(-120, -50, { ...G, name: 'A' });
      const B = s.free(110, -70, { ...G, name: 'B' });
      const C = s.free(20, 110, { ...G, name: 'C' });
      return { A, B, C };
    },
    targets: (g) => {
      const A = P(g, 'A');
      const B = P(g, 'B');
      const C = P(g, 'C');
      const d = 2 * (A.x * (B.y - C.y) + B.x * (C.y - A.y) + C.x * (A.y - B.y));
      const a2 = A.x * A.x + A.y * A.y;
      const b2 = B.x * B.x + B.y * B.y;
      const c2 = C.x * C.x + C.y * C.y;
      const ux = (a2 * (B.y - C.y) + b2 * (C.y - A.y) + c2 * (A.y - B.y)) / d;
      const uy = (a2 * (C.x - B.x) + b2 * (A.x - C.x) + c2 * (B.x - A.x)) / d;
      return [[{ k: 'circle', cx: ux, cy: uy, r: Math.hypot(A.x - ux, A.y - uy) }]];
    },
    solve: (s, g) => {
      const [b1] = s.tool('perpBisector', [g.A, g.B]);
      const [b2] = s.tool('perpBisector', [g.B, g.C]);
      const [o] = s.tool('intersect', [b1, b2]);
      s.tool('circle', [o, g.A]);
    },
  },
  {
    id: 'incircle',
    title: 'Inscribed circle',
    statement: 'Construct the circle inscribed in triangle ABC. (Elements IV.4)',
    group: 'Figures',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const A = s.free(-140, -70, { ...G, name: 'A' });
      const B = s.free(140, -70, { ...G, name: 'B' });
      const C = s.free(10, 120, { ...G, name: 'C' });
      const AB = s.line(A, B, 'segment', { ...G, name: 'AB' });
      const BC = s.line(B, C, 'segment', { ...G, name: 'BC' });
      const CA = s.line(C, A, 'segment', { ...G, name: 'CA' });
      return { A, B, C, AB, BC, CA };
    },
    targets: (g) => {
      const A = P(g, 'A');
      const B = P(g, 'B');
      const C = P(g, 'C');
      const a = Math.hypot(B.x - C.x, B.y - C.y);
      const b = Math.hypot(A.x - C.x, A.y - C.y);
      const c = Math.hypot(A.x - B.x, A.y - B.y);
      const p = a + b + c;
      const ix = (a * A.x + b * B.x + c * C.x) / p;
      const iy = (a * A.y + b * B.y + c * C.y) / p;
      const s2 = p / 2;
      const area = Math.sqrt(Math.max(0, s2 * (s2 - a) * (s2 - b) * (s2 - c)));
      return [[{ k: 'circle', cx: ix, cy: iy, r: area / s2 }]];
    },
    solve: (s, g) => {
      const [ba] = s.tool('angleBisector', [g.B, g.A, g.C]);
      const [bb] = s.tool('angleBisector', [g.A, g.B, g.C]);
      const [i] = s.tool('intersect', [ba, bb]);
      const [pp] = s.tool('perpendicular', [g.AB, i]);
      const [t] = s.tool('intersect', [pp, g.AB]);
      s.tool('circle', [i, t]);
    },
  },
  {
    id: 'hexagon',
    title: 'Hexagon in a circle',
    statement: 'Inscribe a regular hexagon in the circle with one vertex at A. (Elements IV.15)',
    group: 'Figures',
    tools: TIER_A_TOOLS,
    setup: (s) => {
      const O = s.free(0, 0, { ...G, name: 'O' });
      const A = s.free(120, 20, { ...G, name: 'A' });
      const c = s.circle(O, A, { ...G, name: 'c' });
      return { O, A, c };
    },
    targets: (g) => {
      const O = P(g, 'O');
      const A = P(g, 'A');
      const vs = regularVertices(A, rot(O, A, Math.PI / 3), 6);
      return [vs.map((p, i) => lineT(p, vs[(i + 1) % 6]))];
    },
    solve: (s, g) => {
      // Step around the circle with radius |OA|: each new circle meets c at the previous
      // vertex (already there, so Intersect skips it) and at the next one.
      const o = s.pt(g.O);
      const ccw = (from: Id, id: Id) => {
        const a = s.pt(from);
        const p = s.pt(id);
        return (a.x - o.x) * (p.y - o.y) - (a.y - o.y) * (p.x - o.x) > 0;
      };
      const [kA] = s.tool('circle', [g.A, g.O]);
      const firstTwo = s.tool('intersect', [kA, g.c]);
      const B = firstTwo.find((id) => ccw(g.A, id))!;
      const F = firstTwo.find((id) => id !== B)!;
      const verts: Id[] = [g.A, B];
      for (let k = 0; k < 3; k++) {
        const [kc] = s.tool('circle', [verts[verts.length - 1], g.O]);
        const [next] = s.tool('intersect', [kc, g.c]);
        verts.push(next);
      }
      verts.push(F);
      for (let i = 0; i < 6; i++) s.tool('line', [verts[i], verts[(i + 1) % 6]]);
    },
  },
];

/** Build a fresh problem document (givens only). */
export function problemDoc(p: Problem): Doc {
  const s = new Scratch(newDoc(p.title));
  const givens = p.setup(s);
  s.doc.problemId = p.id;
  s.doc.problemGivens = givens;
  return s.doc;
}
