// A small mutable builder over a Doc. Used for problem givens, reference
// solutions, macros and tests. The UI never uses it (the UI goes through patches).

import type { Clip, Doc, Geo, GeoObject, Id, ToolId, Values, Vec } from './types';
import { evalObject } from './evaluate';
import { newDoc, newId, nextName } from './doc';
import { roots } from './intersect';
import { build } from './build';

export class Scratch {
  doc: Doc;
  values: Values = new Map();

  constructor(doc: Doc = newDoc()) {
    this.doc = doc;
  }

  private add(o: GeoObject): Id {
    this.doc.objects[o.id] = o;
    this.doc.order.push(o.id);
    this.values.set(o.id, evalObject(o, (id) => this.values.get(id)));
    return o.id;
  }

  get(id: Id): Geo {
    const g = this.values.get(id);
    if (!g) throw new Error(`object ${id} is undefined`);
    return g;
  }

  pt(id: Id): Vec {
    const g = this.get(id);
    if (g.k !== 'point') throw new Error('not a point');
    return g;
  }

  free(x: number, y: number, extra: Partial<GeoObject> = {}): Id {
    return this.add({ id: newId(), kind: 'point', name: nextName(this.doc, 'point'), showLabel: true, def: { t: 'free', x, y }, ...extra } as GeoObject);
  }

  on(of: Id, u: number, extra: Partial<GeoObject> = {}): Id {
    return this.add({ id: newId(), kind: 'point', name: nextName(this.doc, 'point'), def: { t: 'on', of, u }, ...extra } as GeoObject);
  }

  line(a: Id, b: Id, clip: Clip = 'line', extra: Partial<GeoObject> = {}): Id {
    return this.add({ id: newId(), kind: 'line', name: nextName(this.doc, 'line'), def: { t: 'thru', a, b }, clip, ...extra } as GeoObject);
  }

  circle(c: Id, p: Id, extra: Partial<GeoObject> = {}): Id {
    return this.add({ id: newId(), kind: 'circle', name: nextName(this.doc, 'circle'), def: { t: 'ctr', c, p }, ...extra } as GeoObject);
  }

  /** Intersection point with root index i. */
  int(a: Id, b: Id, i = 0): Id {
    return this.add({ id: newId(), kind: 'point', name: nextName(this.doc, 'point'), def: { t: 'int', a, b, i } });
  }

  /** Intersection root closest to `near` (or farthest from `avoid`). */
  intNear(a: Id, b: Id, near: Vec, mode: 'near' | 'far' = 'near'): Id {
    const ga = this.get(a);
    const gb = this.get(b);
    if (ga.k === 'point' || ga.k === 'region' || gb.k === 'point' || gb.k === 'region') throw new Error('not curves');
    const rs = roots(ga, gb);
    if (!rs.length) throw new Error('no intersection');
    let best = 0;
    for (let i = 1; i < rs.length; i++) {
      const di = Math.hypot(rs[i].x - near.x, rs[i].y - near.y);
      const db = Math.hypot(rs[best].x - near.x, rs[best].y - near.y);
      if (mode === 'near' ? di < db : di > db) best = i;
    }
    return this.int(a, b, best);
  }

  /** Use a real tool (same code path as the UI) and record a step. Returns the new ids. */
  tool(tool: ToolId, inputs: Id[], num?: number): Id[] {
    const res = build(tool, inputs, { doc: this.doc, values: this.values, obj: (id) => this.doc.objects[id] }, num);
    if (res.error) throw new Error(`${tool}: ${res.error}`);
    for (const o of res.objs) this.add(o);
    this.doc.steps.push({ id: newId('s'), tool, inputs, outputs: res.objs.map((o) => o.id) });
    return res.objs.map((o) => o.id);
  }
}
