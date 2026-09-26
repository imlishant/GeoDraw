import type {
  CircleObj,
  Doc,
  GCircle,
  Geo,
  GeoObject,
  GLine,
  GPoint,
  Id,
  LineObj,
  MapDef,
  PointObj,
  RegionObj,
  Values,
  Vec,
} from './types';
import { clampToArc, onCurve, roots } from './intersect';
import { tol } from './tolerance';
import { angleOf, normAngle } from './vec';

type Get = (id: Id) => Geo | null | undefined;

const TAU = Math.PI * 2;
const INF = Infinity;

const pt = (x: number, y: number): GPoint => ({ k: 'point', x, y });

function getPoint(get: Get, id: Id): GPoint | null {
  const g = get(id);
  return g && g.k === 'point' ? g : null;
}
function getLine(get: Get, id: Id): GLine | null {
  const g = get(id);
  return g && g.k === 'line' ? g : null;
}
function getCircle(get: Get, id: Id): GCircle | null {
  const g = get(id);
  return g && g.k === 'circle' ? g : null;
}

/** An infinite line through p with direction (dx, dy), not necessarily unit. */
function lineFrom(px: number, py: number, dx: number, dy: number, s: number): GLine | null {
  const l = Math.hypot(dx, dy);
  if (!(l > tol(px, py) * 1e-3) || !Number.isFinite(l)) return null;
  return { k: 'line', px, py, dx: dx / l, dy: dy / l, s: s > 0 ? s : 1, t0: -INF, t1: INF };
}

// ---- Similarity maps --------------------------------------------------------

export interface Sim {
  apply(p: Vec): Vec;
  k: number; // scale factor
  flip: boolean; // orientation-reversing
}

export function evalMap(m: MapDef, get: Get): Sim | null {
  switch (m.t) {
    case 'reflL': {
      const l = getLine(get, m.l);
      if (!l) return null;
      return {
        k: 1,
        flip: true,
        apply: (p) => {
          const t = (p.x - l.px) * l.dx + (p.y - l.py) * l.dy;
          const fx = l.px + l.dx * t;
          const fy = l.py + l.dy * t;
          return { x: 2 * fx - p.x, y: 2 * fy - p.y };
        },
      };
    }
    case 'reflP': {
      const c = getPoint(get, m.c);
      if (!c) return null;
      return { k: 1, flip: false, apply: (p) => ({ x: 2 * c.x - p.x, y: 2 * c.y - p.y }) };
    }
    case 'trans': {
      const a = getPoint(get, m.a);
      const b = getPoint(get, m.b);
      if (!a || !b) return null;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      return { k: 1, flip: false, apply: (p) => ({ x: p.x + dx, y: p.y + dy }) };
    }
    case 'rot':
    case 'rotNum': {
      const c = getPoint(get, m.c);
      if (!c) return null;
      let ang: number;
      if (m.t === 'rotNum') ang = (m.deg * Math.PI) / 180;
      else {
        const a = getPoint(get, m.a);
        const vv = getPoint(get, m.v);
        const b = getPoint(get, m.b);
        if (!a || !vv || !b) return null;
        if (Math.hypot(a.x - vv.x, a.y - vv.y) === 0 || Math.hypot(b.x - vv.x, b.y - vv.y) === 0) return null;
        ang = Math.atan2(b.y - vv.y, b.x - vv.x) - Math.atan2(a.y - vv.y, a.x - vv.x);
      }
      const cs = Math.cos(ang);
      const sn = Math.sin(ang);
      return {
        k: 1,
        flip: false,
        apply: (p) => {
          const x = p.x - c.x;
          const y = p.y - c.y;
          return { x: c.x + x * cs - y * sn, y: c.y + x * sn + y * cs };
        },
      };
    }
    case 'dil':
    case 'dilNum': {
      const c = getPoint(get, m.c);
      if (!c) return null;
      let k: number;
      if (m.t === 'dilNum') k = m.k;
      else {
        const a = getPoint(get, m.a);
        const b = getPoint(get, m.b);
        if (!a || !b) return null;
        const da = Math.hypot(a.x - c.x, a.y - c.y);
        if (da <= tol(a.x, a.y, c.x, c.y)) return null;
        k = Math.hypot(b.x - c.x, b.y - c.y) / da;
      }
      if (!(k > 0) || !Number.isFinite(k)) return null;
      return { k, flip: false, apply: (p) => ({ x: c.x + (p.x - c.x) * k, y: c.y + (p.y - c.y) * k }) };
    }
  }
}

function mapGeo(g: Geo, m: Sim): Geo | null {
  switch (g.k) {
    case 'point': {
      const p = m.apply(g);
      return pt(p.x, p.y);
    }
    case 'line': {
      const o = m.apply({ x: g.px, y: g.py });
      const q = m.apply({ x: g.px + g.dx, y: g.py + g.dy });
      const l = lineFrom(o.x, o.y, q.x - o.x, q.y - o.y, g.s * m.k);
      if (!l) return null;
      l.t0 = g.t0 * m.k;
      l.t1 = g.t1 * m.k;
      return l;
    }
    case 'circle': {
      const c = m.apply({ x: g.cx, y: g.cy });
      const out: GCircle = { k: 'circle', cx: c.x, cy: c.y, r: g.r * m.k };
      if (g.a0 !== undefined && g.a1 !== undefined) {
        const sweep = g.a1 - g.a0;
        const e0 = m.apply({ x: g.cx + g.r * Math.cos(g.a0), y: g.cy + g.r * Math.sin(g.a0) });
        const e1 = m.apply({ x: g.cx + g.r * Math.cos(g.a1), y: g.cy + g.r * Math.sin(g.a1) });
        // Reflections reverse orientation, so the arc now starts at the image of its end.
        const start = m.flip ? e1 : e0;
        out.a0 = normAngle(Math.atan2(start.y - c.y, start.x - c.x));
        out.a1 = out.a0 + sweep;
      }
      return out;
    }
    case 'region':
      return { k: 'region', pts: g.pts.map((p) => m.apply(p)) };
  }
}

// ---- Per-kind evaluation ----------------------------------------------------

function evalPoint(o: PointObj, get: Get): GPoint | null {
  const d = o.def;
  switch (d.t) {
    case 'free':
      return pt(d.x, d.y);
    case 'on': {
      const g = get(d.of);
      if (!g) return null;
      if (g.k === 'line') {
        let t = d.u * g.s;
        t = Math.min(Math.max(t, g.t0), g.t1);
        return pt(g.px + g.dx * t, g.py + g.dy * t);
      }
      if (g.k === 'circle') {
        let a = d.u;
        if (g.a0 !== undefined && g.a1 !== undefined) a = clampToArc(a, g.a0, g.a1);
        return pt(g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a));
      }
      return null;
    }
    case 'int': {
      const a = get(d.a);
      const b = get(d.b);
      if (!a || !b || a.k === 'point' || b.k === 'point' || a.k === 'region' || b.k === 'region') return null;
      const rs = roots(a, b);
      const r = rs[d.i] ?? (rs.length === 1 && d.i === 0 ? rs[0] : undefined);
      if (!r) return null;
      if (!onCurve(r, a) || !onCurve(r, b)) return null;
      return pt(r.x, r.y);
    }
    case 'mid': {
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      return a && b ? pt((a.x + b.x) / 2, (a.y + b.y) / 2) : null;
    }
    case 'center': {
      const c = getCircle(get, d.c);
      return c ? pt(c.cx, c.cy) : null;
    }
    case 'polar': {
      const a = getPoint(get, d.a);
      return a ? pt(a.x + d.len * Math.cos(d.ang), a.y + d.len * Math.sin(d.ang)) : null;
    }
    case 'rotNum': {
      const p = getPoint(get, d.p);
      const c = getPoint(get, d.v);
      if (!p || !c) return null;
      const ang = (d.deg * Math.PI) / 180;
      const x = p.x - c.x;
      const y = p.y - c.y;
      return pt(c.x + x * Math.cos(ang) - y * Math.sin(ang), c.y + x * Math.sin(ang) + y * Math.cos(ang));
    }
    case 'regVertex': {
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      if (!a || !b || d.n < 3) return null;
      const r = regularVertices(a, b, d.n);
      const p = r[d.k];
      return p ? pt(p.x, p.y) : null;
    }
    case 'xf': {
      const src = get(d.src);
      const m = evalMap(d.map, get);
      if (!src || !m || src.k !== 'point') return null;
      return mapGeo(src, m) as GPoint | null;
    }
  }
}

/** Vertices of the regular n-gon on edge AB, counterclockwise (polygon lies left of A→B). */
export function regularVertices(a: Vec, b: Vec, n: number): Vec[] {
  const out: Vec[] = [a, b];
  let ex = b.x - a.x;
  let ey = b.y - a.y;
  const ext = TAU / n;
  const c = Math.cos(ext);
  const s = Math.sin(ext);
  let cur = b;
  for (let k = 2; k < n; k++) {
    const nx = ex * c - ey * s;
    const ny = ex * s + ey * c;
    ex = nx;
    ey = ny;
    cur = { x: cur.x + ex, y: cur.y + ey };
    out.push(cur);
  }
  return out;
}

function evalLine(o: LineObj, get: Get): GLine | null {
  const d = o.def;
  switch (d.t) {
    case 'thru': {
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      if (!a || !b) return null;
      const ab = Math.hypot(b.x - a.x, b.y - a.y);
      if (ab <= tol(a.x, a.y, b.x, b.y) * 100) return null;
      const l = lineFrom(a.x, a.y, b.x - a.x, b.y - a.y, ab);
      if (!l) return null;
      if (o.clip === 'segment') {
        l.t0 = 0;
        l.t1 = ab;
      } else if (o.clip === 'ray') l.t0 = 0;
      return l;
    }
    case 'perpBis': {
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      if (!a || !b) return null;
      const ab = Math.hypot(b.x - a.x, b.y - a.y);
      if (ab <= tol(a.x, a.y, b.x, b.y) * 100) return null;
      return lineFrom((a.x + b.x) / 2, (a.y + b.y) / 2, -(b.y - a.y), b.x - a.x, ab);
    }
    case 'perp':
    case 'par': {
      const l = getLine(get, d.l);
      const p = getPoint(get, d.p);
      if (!l || !p) return null;
      return d.t === 'perp' ? lineFrom(p.x, p.y, -l.dy, l.dx, l.s) : lineFrom(p.x, p.y, l.dx, l.dy, l.s);
    }
    case 'angBis': {
      const a = getPoint(get, d.a);
      const vv = getPoint(get, d.v);
      const b = getPoint(get, d.b);
      if (!a || !vv || !b) return null;
      const la = Math.hypot(a.x - vv.x, a.y - vv.y);
      const lb = Math.hypot(b.x - vv.x, b.y - vv.y);
      if (la === 0 || lb === 0) return null;
      const ux = (a.x - vv.x) / la + (b.x - vv.x) / lb;
      const uy = (a.y - vv.y) / la + (b.y - vv.y) / lb;
      if (Math.hypot(ux, uy) < 1e-9) return lineFrom(vv.x, vv.y, -(a.y - vv.y), a.x - vv.x, la); // straight angle
      return lineFrom(vv.x, vv.y, ux, uy, la);
    }
    case 'tangent': {
      const p = getPoint(get, d.p);
      const c = getCircle(get, d.c);
      if (!p || !c) return null;
      const t = tangentPoints(p, c);
      if (!t) return null;
      const tp = t[d.i] ?? t[0];
      if (t.length === 1 || Math.hypot(tp.x - p.x, tp.y - p.y) <= tol(p.x, p.y, c.r)) {
        // P on the circle: the tangent is perpendicular to the radius at P
        return lineFrom(p.x, p.y, -(p.y - c.cy), p.x - c.cx, c.r);
      }
      return lineFrom(p.x, p.y, tp.x - p.x, tp.y - p.y, Math.hypot(tp.x - p.x, tp.y - p.y));
    }
    case 'xf': {
      const src = get(d.src);
      const m = evalMap(d.map, get);
      if (!src || !m || src.k !== 'line') return null;
      return mapGeo(src, m) as GLine | null;
    }
  }
}

/** Touch points of the tangents from P to circle C, ordered (i = 0 turns left). Null if P is inside. */
export function tangentPoints(p: Vec, c: GCircle): Vec[] | null {
  const dx = p.x - c.cx;
  const dy = p.y - c.cy;
  const D = Math.hypot(dx, dy);
  const eps = tol(c.r, c.cx, c.cy, p.x, p.y);
  if (D < c.r - eps) return null;
  if (Math.abs(D - c.r) <= eps) return [{ x: p.x, y: p.y }];
  const phi = Math.acos(c.r / D);
  const base = Math.atan2(dy, dx);
  return [
    { x: c.cx + c.r * Math.cos(base + phi), y: c.cy + c.r * Math.sin(base + phi) },
    { x: c.cx + c.r * Math.cos(base - phi), y: c.cy + c.r * Math.sin(base - phi) },
  ];
}

function evalCircle(o: CircleObj, get: Get): GCircle | null {
  const d = o.def;
  const circ = (cx: number, cy: number, r: number): GCircle | null =>
    r > tol(cx, cy) * 100 && Number.isFinite(r) ? { k: 'circle', cx, cy, r } : null;
  switch (d.t) {
    case 'ctr': {
      const c = getPoint(get, d.c);
      const p = getPoint(get, d.p);
      return c && p ? circ(c.x, c.y, Math.hypot(p.x - c.x, p.y - c.y)) : null;
    }
    case 'compass': {
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      const c = getPoint(get, d.c);
      return a && b && c ? circ(c.x, c.y, Math.hypot(b.x - a.x, b.y - a.y)) : null;
    }
    case 'compassC': {
      const r = getCircle(get, d.r);
      const c = getPoint(get, d.c);
      return r && c ? circ(c.x, c.y, r.r) : null;
    }
    case 'radius': {
      const c = getPoint(get, d.c);
      return c ? circ(c.x, c.y, d.r) : null;
    }
    case 'semi': {
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      if (!a || !b) return null;
      const g = circ((a.x + b.x) / 2, (a.y + b.y) / 2, Math.hypot(b.x - a.x, b.y - a.y) / 2);
      if (!g) return null;
      g.a0 = normAngle(angleOf({ x: a.x - g.cx, y: a.y - g.cy }));
      g.a1 = g.a0 + Math.PI;
      return g;
    }
    case 'sector': {
      const c = getPoint(get, d.c);
      const a = getPoint(get, d.a);
      const b = getPoint(get, d.b);
      if (!c || !a || !b) return null;
      const g = circ(c.x, c.y, Math.hypot(a.x - c.x, a.y - c.y));
      if (!g) return null;
      g.a0 = normAngle(Math.atan2(a.y - c.y, a.x - c.x));
      let sweep = normAngle(Math.atan2(b.y - c.y, b.x - c.x) - g.a0);
      if (sweep === 0) sweep = TAU;
      g.a1 = g.a0 + sweep;
      return g;
    }
    case 'xf': {
      const src = get(d.src);
      const m = evalMap(d.map, get);
      if (!src || !m || src.k !== 'circle') return null;
      return mapGeo(src, m) as GCircle | null;
    }
  }
}

function evalRegion(o: RegionObj, get: Get): Geo | null {
  const pts: Vec[] = [];
  for (const id of o.def.pts) {
    const p = getPoint(get, id);
    if (!p) return null;
    pts.push({ x: p.x, y: p.y });
  }
  return { k: 'region', pts };
}

export function evalObject(o: GeoObject, get: Get): Geo | null {
  let g: Geo | null;
  switch (o.kind) {
    case 'point':
      g = evalPoint(o, get);
      break;
    case 'line':
      g = evalLine(o, get);
      break;
    case 'circle':
      g = evalCircle(o, get);
      break;
    case 'region':
      g = evalRegion(o, get);
      break;
  }
  if (g && g.k === 'point' && !(Number.isFinite(g.x) && Number.isFinite(g.y))) return null;
  return g;
}

/** Parent ids referenced by an object's definition. */
export function parentsOf(o: GeoObject): Id[] {
  const d = o.def as unknown as Record<string, unknown>;
  const out: Id[] = [];
  const addMap = (m: MapDef) => {
    for (const [k, val] of Object.entries(m)) if (k !== 't' && typeof val === 'string') out.push(val);
  };
  for (const [k, val] of Object.entries(d)) {
    if (k === 't') continue;
    if (k === 'map') addMap(val as MapDef);
    else if (k === 'pts') out.push(...(val as Id[]));
    else if (typeof val === 'string') out.push(val);
  }
  return out;
}

/** Evaluate the whole document in creation order. `override` replaces some objects (e.g. while dragging). */
export function evaluateDoc(doc: Doc, override?: Map<Id, GeoObject>): Values {
  const vals: Values = new Map();
  const get: Get = (id) => vals.get(id);
  for (const id of doc.order) {
    const o = override?.get(id) ?? doc.objects[id];
    if (!o) continue;
    vals.set(id, evalObject(o, get));
  }
  return vals;
}

/** Ids (in creation order) that depend on any of `roots`, excluding the roots themselves. */
export function downstream(doc: Doc, rootIds: Id[]): Id[] {
  const dirty = new Set(rootIds);
  const out: Id[] = [];
  for (const id of doc.order) {
    if (dirty.has(id) && rootIds.includes(id)) continue;
    const o = doc.objects[id];
    if (!o) continue;
    if (parentsOf(o).some((p) => dirty.has(p))) {
      dirty.add(id);
      out.push(id);
    }
  }
  return out;
}

/** Re-evaluate only the given ids in place (they must be in creation order). */
export function reevaluate(doc: Doc, vals: Values, ids: Id[], override?: Map<Id, GeoObject>): void {
  const get: Get = (id) => vals.get(id);
  for (const id of ids) {
    const o = override?.get(id) ?? doc.objects[id];
    if (o) vals.set(id, evalObject(o, get));
  }
}
