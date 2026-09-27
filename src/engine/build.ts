// Pure tool builders: given picked inputs, produce the new objects.
// Used by the UI and by tests, so there is one
// code path for "what a tool does".

import type { Doc, GeoObject, Id, Kind, LineObj, MapDef, Style, ToolId, Values } from './types';
import { newId, nextName } from './doc';
import { onCurve, roots } from './intersect';
import { samePoint } from './tolerance';
import { UNIT } from './measure';

export interface BuildCtx {
  doc: Doc;
  values: Values;
  /** Looks up doc objects and any pending (not yet committed) ones. */
  obj(id: Id): GeoObject | undefined;
}

export interface BuildResult {
  objs: GeoObject[];
  /** Human-readable reason when nothing could be built. */
  error?: string;
}

class Namer {
  private taken = new Set<string>();
  constructor(private ctx: BuildCtx) {
    for (const id of ctx.values.keys()) {
      const o = ctx.obj(id);
      if (o) this.taken.add(o.name);
    }
  }
  next(kind: Kind): string {
    const n = nextName(this.ctx.doc, kind, this.taken);
    this.taken.add(n);
    return n;
  }
}

const fail = (error: string): BuildResult => ({ objs: [], error });

export function kindOf(ctx: BuildCtx, id: Id): Kind | undefined {
  return ctx.obj(id)?.kind;
}

export function build(tool: ToolId, inputs: Id[], ctx: BuildCtx, num?: number): BuildResult {
  const names = new Namer(ctx);
  const point = (def: GeoObject['def'] & { t: string }, extra: Partial<GeoObject> = {}): GeoObject =>
    ({ id: newId(), kind: 'point', name: names.next('point'), showLabel: true, def, ...extra }) as GeoObject;
  const line = (def: LineObj['def'], clip: LineObj['clip'] = 'line', style?: Style): LineObj => ({
    id: newId(),
    kind: 'line',
    name: names.next('line'),
    def,
    clip,
    ...(style ? { style } : {}),
  });
  const ok = (objs: GeoObject[]): BuildResult => ({ objs });
  const pick = (kind: Kind) => inputs.find((i) => kindOf(ctx, i) === kind);

  switch (tool) {
    case 'point':
      return ok([]);
    case 'line':
    case 'segment':
    case 'ray':
    case 'vector': {
      const [a, b] = inputs;
      const clip = tool === 'line' ? 'line' : tool === 'ray' ? 'ray' : 'segment';
      return ok([line({ t: 'thru', a, b }, clip, tool === 'vector' ? { arrow: true } : undefined)]);
    }
    case 'circle': {
      const [c, p] = inputs;
      return ok([{ id: newId(), kind: 'circle', name: names.next('circle'), def: { t: 'ctr', c, p } }]);
    }
    case 'perpBisector': {
      const [a, b] = inputs;
      return ok([line({ t: 'perpBis', a, b })]);
    }
    case 'perpendicular':
    case 'parallel': {
      const l = pick('line');
      const p = pick('point');
      if (!l || !p) return fail('Pick a line and a point');
      return ok([line(tool === 'perpendicular' ? { t: 'perp', l, p } : { t: 'par', l, p })]);
    }
    case 'angleBisector': {
      const [a, v, b] = inputs;
      return ok([line({ t: 'angBis', a, v, b })]);
    }
    case 'compass': {
      if (inputs.length === 2) {
        const [r, c] = inputs;
        return ok([{ id: newId(), kind: 'circle', name: names.next('circle'), def: { t: 'compassC', r, c } }]);
      }
      const [a, b, c] = inputs;
      return ok([{ id: newId(), kind: 'circle', name: names.next('circle'), def: { t: 'compass', a, b, c } }]);
    }
    case 'intersect':
      return intersectAll(ctx, inputs[0], inputs[1], names);
    case 'midpoint': {
      if (inputs.length === 1) {
        const o = ctx.obj(inputs[0]);
        if (o?.kind === 'circle') return ok([point({ t: 'center', c: o.id })]);
        if (o?.kind === 'line' && o.def.t === 'thru' && o.clip === 'segment') {
          return ok([point({ t: 'mid', a: o.def.a, b: o.def.b })]);
        }
        return fail('Pick two points, a segment or a circle');
      }
      const [a, b] = inputs;
      return ok([point({ t: 'mid', a, b })]);
    }
    case 'tangents': {
      const p = pick('point');
      const c = pick('circle');
      if (!p || !c) return fail('Pick a point and a circle');
      const pg = ctx.values.get(p);
      const cg = ctx.values.get(c);
      if (!pg || !cg || pg.k !== 'point' || cg.k !== 'circle') return fail('Undefined input');
      const d = Math.hypot(pg.x - cg.cx, pg.y - cg.cy);
      const eps = 1e-9 * Math.max(1, cg.r, Math.abs(pg.x), Math.abs(pg.y));
      if (d < cg.r - eps) return fail('The point is inside the circle: no tangents');
      if (Math.abs(d - cg.r) <= eps) return ok([line({ t: 'tangent', p, c, i: 0 })]); // point on the circle: one tangent
      return ok([line({ t: 'tangent', p, c, i: 0 }), line({ t: 'tangent', p, c, i: 1 })]);
    }
    case 'polygon': {
      const pts = inputs[inputs.length - 1] === inputs[0] ? inputs.slice(0, -1) : inputs;
      if (pts.length < 3) return fail('A polygon needs at least 3 points');
      const sides = pts.map((a, i) => line({ t: 'thru', a, b: pts[(i + 1) % pts.length] }, 'segment'));
      const region: GeoObject = { id: newId(), kind: 'region', name: names.next('region'), def: { t: 'poly', pts } };
      return ok([...sides, region]);
    }
    case 'regularPolygon': {
      const [a, b] = inputs;
      const n = Math.round(num ?? 0);
      if (!(n >= 3 && n <= 60)) return fail('Number of vertices must be 3–60');
      const verts: Id[] = [a, b];
      const objs: GeoObject[] = [];
      for (let k = 2; k < n; k++) {
        const p = point({ t: 'regVertex', a, b, n, k });
        objs.push(p);
        verts.push(p.id);
      }
      const sides = verts.map((x, i) => line({ t: 'thru', a: x, b: verts[(i + 1) % n] }, 'segment'));
      const region: GeoObject = { id: newId(), kind: 'region', name: names.next('region'), def: { t: 'poly', pts: verts } };
      return ok([...objs, ...sides, region]);
    }
    case 'semicircle': {
      const [a, b] = inputs;
      return ok([{ id: newId(), kind: 'circle', name: names.next('circle'), def: { t: 'semi', a, b } }]);
    }
    case 'sector': {
      const [c, a, b] = inputs;
      return ok([{ id: newId(), kind: 'circle', name: names.next('circle'), def: { t: 'sector', c, a, b }, style: { sector: true } }]);
    }
    case 'reflectLine':
    case 'reflectPoint':
    case 'translate':
    case 'rotate':
    case 'dilate':
    case 'rotateBy':
    case 'dilateBy': {
      const [src, ...rest] = inputs;
      let map: MapDef;
      if (tool === 'reflectLine') map = { t: 'reflL', l: rest[0] };
      else if (tool === 'reflectPoint') map = { t: 'reflP', c: rest[0] };
      else if (tool === 'translate') map = { t: 'trans', a: rest[0], b: rest[1] };
      else if (tool === 'rotate') map = { t: 'rot', c: rest[0], a: rest[1], v: rest[2], b: rest[3] };
      else if (tool === 'dilate') map = { t: 'dil', c: rest[0], a: rest[1], b: rest[2] };
      else if (tool === 'rotateBy') map = { t: 'rotNum', c: rest[0], deg: num ?? 0 };
      else {
        if (!(num !== undefined && num > 0)) return fail('The factor must be positive');
        map = { t: 'dilNum', c: rest[0], k: num };
      }
      return transform(ctx, src, map, names);
    }
    case 'segmentLength': {
      const [a] = inputs;
      if (!(num !== undefined && num > 0)) return fail('The length must be positive');
      const b = point({ t: 'polar', a, len: num * UNIT, ang: 0 });
      return ok([b, line({ t: 'thru', a, b: b.id }, 'segment')]);
    }
    case 'circleRadius': {
      const [c] = inputs;
      if (!(num !== undefined && num > 0)) return fail('The radius must be positive');
      return ok([{ id: newId(), kind: 'circle', name: names.next('circle'), def: { t: 'radius', c, r: num * UNIT } }]);
    }
    case 'angleSize': {
      const [a, vtx] = inputs;
      if (num === undefined || !Number.isFinite(num)) return fail('Enter an angle in degrees');
      const p = point({ t: 'rotNum', p: a, v: vtx, deg: num });
      return ok([p, line({ t: 'thru', a: vtx, b: p.id }, 'ray')]);
    }
  }
}

function intersectAll(ctx: BuildCtx, a: Id, b: Id, names: Namer): BuildResult {
  const ga = ctx.values.get(a);
  const gb = ctx.values.get(b);
  if (!ga || !gb || ga.k === 'point' || gb.k === 'point' || ga.k === 'region' || gb.k === 'region') {
    return fail('Pick two lines or circles');
  }
  if (a === b) return fail('Pick two different objects');
  const rs = roots(ga, gb);
  const objs: GeoObject[] = [];
  const seen: { x: number; y: number }[] = [];
  rs.forEach((r, i) => {
    if (!onCurve(r, ga) || !onCurve(r, gb)) return;
    if (seen.some((s) => samePoint(s.x, s.y, r.x, r.y))) return; // tangency: one point
    seen.push(r);
    if (existingPointAt(ctx, r.x, r.y)) return;
    objs.push({ id: newId(), kind: 'point', name: names.next('point'), showLabel: true, def: { t: 'int', a, b, i } });
  });
  if (objs.length === 0) {
    return fail(seen.length ? 'Those intersection points already exist' : "These don't intersect");
  }
  return { objs };
}

export function existingPointAt(ctx: BuildCtx, x: number, y: number): Id | undefined {
  for (const [id, g] of ctx.values) {
    if (ctx.obj(id)?.hidden) continue;
    if (g && g.k === 'point' && samePoint(g.x, g.y, x, y)) return id;
  }
  return undefined;
}

function transform(ctx: BuildCtx, src: Id, map: MapDef, names: Namer): BuildResult {
  const o = ctx.obj(src);
  if (!o || o.kind === 'region') return fail('Pick a point, line or circle to transform');
  const id = newId();
  if (o.kind === 'point') return { objs: [{ id, kind: 'point', name: names.next('point'), showLabel: true, def: { t: 'xf', src, map } }] };
  if (o.kind === 'line') {
    return { objs: [{ id, kind: 'line', name: names.next('line'), clip: o.clip, def: { t: 'xf', src, map }, ...(o.style ? { style: { ...o.style } } : {}) }] };
  }
  return { objs: [{ id, kind: 'circle', name: names.next('circle'), def: { t: 'xf', src, map }, ...(o.style ? { style: { ...o.style } } : {}) }] };
}
