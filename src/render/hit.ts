// Hit-testing and snapping. Tolerances arrive in world units already converted
// from screen pixels, so picking feels the same at every zoom, while the math
// (what counts as "the same point") never depends on zoom.

import type { Curve, Doc, Geo, GeoObject, Id, Kind, Values, Vec } from '../engine/types';
import { distToCurve, onCurve, projectToCurve, roots } from '../engine/intersect';
import { samePoint } from '../engine/tolerance';
import type { BBox } from './camera';

export type Snap =
  | { t: 'point'; id: Id; x: number; y: number }
  | { t: 'int'; a: Id; b: Id; i: number; x: number; y: number }
  | { t: 'on'; of: Id; u: number; x: number; y: number }
  | { t: 'curve'; id: Id; x: number; y: number }
  | { t: 'region'; id: Id; x: number; y: number }
  | { t: 'free'; x: number; y: number };

export interface HitScene {
  doc: Doc;
  values: Values;
  /** extra objects (pending points in a tool session) */
  extra?: Map<Id, GeoObject>;
  visible: (o: GeoObject) => boolean;
}

function* objects(s: HitScene): Generator<[GeoObject, Geo]> {
  for (const id of s.doc.order) {
    const o = s.doc.objects[id];
    const g = s.values.get(id);
    if (o && g && s.visible(o)) yield [o, g];
  }
  if (s.extra) {
    for (const [id, o] of s.extra) {
      const g = s.values.get(id);
      if (g) yield [o, g];
    }
  }
}

export function nearestPoint(s: HitScene, p: Vec, tolW: number, filter?: (o: GeoObject) => boolean): Id | null {
  let best: Id | null = null;
  let bd = tolW;
  for (const [o, g] of objects(s)) {
    if (g.k !== 'point' || (filter && !filter(o))) continue;
    const d = Math.hypot(g.x - p.x, g.y - p.y);
    if (d <= bd) {
      bd = d;
      best = o.id;
    }
  }
  return best;
}

export function nearestCurve(s: HitScene, p: Vec, tolW: number, kinds: Kind[] = ['line', 'circle']): Id | null {
  let best: Id | null = null;
  let bd = tolW;
  for (const [o, g] of objects(s)) {
    if (g.k !== 'line' && g.k !== 'circle') continue;
    if (!kinds.includes(g.k)) continue;
    const d = distToCurve(p, g);
    if (d <= bd) {
      bd = d;
      best = o.id;
    }
  }
  return best;
}

export function regionAt(s: HitScene, p: Vec): Id | null {
  let hit: Id | null = null;
  for (const [o, g] of objects(s)) {
    if (g.k === 'region' && pointInPolygon(p, g.pts)) hit = o.id; // topmost wins
  }
  return hit;
}

function pointInPolygon(p: Vec, pts: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Intersections of curves near p that are not already points ("virtual intersections", D1). */
export function virtualIntersections(s: HitScene, p: Vec, tolW: number): Array<{ a: Id; b: Id; i: number; x: number; y: number }> {
  const near: Array<[Id, Curve]> = [];
  for (const [o, g] of objects(s)) {
    if ((g.k === 'line' || g.k === 'circle') && distToCurve(p, g) <= tolW * 2) near.push([o.id, g]);
  }
  const out: Array<{ a: Id; b: Id; i: number; x: number; y: number }> = [];
  for (let m = 0; m < near.length; m++) {
    for (let n = m + 1; n < near.length; n++) {
      const [ia, ga] = near[m];
      const [ib, gb] = near[n];
      const rs = roots(ga, gb);
      rs.forEach((r, i) => {
        if (i === 1 && rs.length === 2 && samePoint(rs[0].x, rs[0].y, r.x, r.y)) return;
        if (Math.hypot(r.x - p.x, r.y - p.y) > tolW * 1.5) return;
        if (!onCurve(r, ga) || !onCurve(r, gb)) return;
        for (const [, g] of objects(s)) if (g.k === 'point' && samePoint(g.x, g.y, r.x, r.y)) return;
        out.push({ a: ia, b: ib, i, x: r.x, y: r.y });
      });
    }
  }
  out.sort((u, w) => Math.hypot(u.x - p.x, u.y - p.y) - Math.hypot(w.x - p.x, w.y - p.y));
  return out;
}

/** Parameter for an on-object point at p (line: in units of its scale; circle: angle). */
export function paramOn(g: Curve, p: Vec): { u: number; x: number; y: number } {
  const q = projectToCurve(p, g);
  if (g.k === 'line') return { u: ((q.x - g.px) * g.dx + (q.y - g.py) * g.dy) / g.s, x: q.x, y: q.y };
  return { u: Math.atan2(q.y - g.cy, q.x - g.cx), x: q.x, y: q.y };
}

export interface SnapOpts {
  kinds: Kind[]; // what the tool accepts next
  create: boolean; // may create a new point
  pointTol: number;
  curveTol: number;
  pointFilter?: (o: GeoObject) => boolean;
}

/** Resolve what a click at p means for the current pick (PLAN.md §4.2 priority order). */
export function snap(s: HitScene, p: Vec, o: SnapOpts): Snap | null {
  const wantsPoint = o.kinds.includes('point');
  if (wantsPoint) {
    const id = nearestPoint(s, p, o.pointTol, o.pointFilter);
    if (id) {
      const g = s.values.get(id) as { x: number; y: number };
      return { t: 'point', id, x: g.x, y: g.y };
    }
    if (o.create) {
      const vi = virtualIntersections(s, p, o.pointTol)[0];
      if (vi) return { t: 'int', ...vi };
    }
  }
  const curveKinds = o.kinds.filter((k) => k === 'line' || k === 'circle');
  if (curveKinds.length) {
    const id = nearestCurve(s, p, o.curveTol, curveKinds);
    if (id) return { t: 'curve', id, x: p.x, y: p.y };
  }
  if (o.kinds.includes('region')) {
    const id = regionAt(s, p);
    if (id) return { t: 'region', id, x: p.x, y: p.y };
  }
  if (wantsPoint && o.create) {
    const cid = nearestCurve(s, p, o.curveTol);
    if (cid) {
      const g = s.values.get(cid) as Curve;
      const on = paramOn(g, p);
      return { t: 'on', of: cid, u: on.u, x: on.x, y: on.y };
    }
    return { t: 'free', x: p.x, y: p.y };
  }
  return null;
}

/** Any object under p (for select / label / hide / delete tools). Points first. */
export function objectAt(s: HitScene, p: Vec, pointTol: number, curveTol: number): Id | null {
  return nearestPoint(s, p, pointTol) ?? nearestCurve(s, p, curveTol) ?? regionAt(s, p);
}

export function boundingBox(doc: Doc, values: Values): BBox | null {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const add = (x: number, y: number) => {
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  };
  for (const id of doc.order) {
    const g = values.get(id);
    if (!g || doc.objects[id]?.hidden) continue;
    if (g.k === 'point') add(g.x, g.y);
    else if (g.k === 'circle' && g.r < 1e5) {
      add(g.cx - g.r, g.cy - g.r);
      add(g.cx + g.r, g.cy + g.r);
    }
  }
  return Number.isFinite(minX) ? { minX, minY, maxX, maxY } : null;
}
