// Composite tools rebuilt from primitives (point, line, circle, intersect).
// Each macro returns the resulting object id. macros.test.ts checks that the
// composite tools give exactly the same objects as these ruler-and-compass recipes.

import type { Id } from '../src/engine/types';
import type { Scratch } from './scratch';

/** Perpendicular bisector of AB. */
export function perpBisectorMacro(s: Scratch, a: Id, b: Id): Id {
  const c1 = s.circle(a, b);
  const c2 = s.circle(b, a);
  const p = s.int(c1, c2, 0);
  const q = s.int(c1, c2, 1);
  return s.line(p, q);
}

/** Perpendicular to line l through P (P not on l). */
export function perpendicularMacro(s: Scratch, l: Id, p: Id): Id {
  const A = s.on(l, 0);
  const B = s.on(l, 1);
  const c1 = s.circle(A, p);
  const c2 = s.circle(B, p);
  const q = s.intNear(c1, c2, s.pt(p), 'far');
  return s.line(p, q);
}

/** Parallel to line l through P, via a rhombus. */
export function parallelMacro(s: Scratch, l: Id, p: Id): Id {
  const A = s.on(l, 0);
  const c1 = s.circle(A, p); // radius r = |AP|
  const B = s.int(l, c1, 1); // |AB| = r
  const c2 = s.circle(p, A); // radius r around P
  const c3 = s.circle(B, A); // radius r around B
  const D = s.intNear(c2, c3, s.pt(A), 'far'); // APDB is a rhombus
  return s.line(p, D);
}

/** Bisector of angle AVB when lines VA and VB exist (as in Euclidea). */
export function angleBisectorMacro(s: Scratch, a: Id, v: Id, b: Id, lineVB: Id): Id {
  const c1 = s.circle(v, a);
  const b2 = s.intNear(lineVB, c1, s.pt(b)); // on ray VB with |VB'| = |VA|
  const c2 = s.circle(a, v);
  const c3 = s.circle(b2, v);
  const w = s.intNear(c2, c3, s.pt(v), 'far'); // V A W B' is a rhombus
  return s.line(v, w);
}

/** Reflection of point X in line l. */
export function reflectLineMacro(s: Scratch, x: Id, l: Id): Id {
  const A = s.on(l, 0);
  const B = s.on(l, 1);
  const c1 = s.circle(A, x);
  const c2 = s.circle(B, x);
  return s.intNear(c1, c2, s.pt(x), 'far');
}

/** Reflection of point X about point C. */
export function reflectPointMacro(s: Scratch, x: Id, c: Id): Id {
  const l = s.line(x, c);
  const k = s.circle(c, x);
  return s.intNear(l, k, s.pt(x), 'far');
}

/** Midpoint of AB when line AB exists: perpendicular bisector ∩ AB = 3E. */
export function midpointMacro(s: Scratch, a: Id, b: Id, lineAB: Id): Id {
  const pb = perpBisectorMacro(s, a, b);
  return s.int(pb, lineAB, 0);
}
