import { describe, expect, it } from 'vitest';
import { Scratch } from '../src/engine/scratch';
import { downstream, evaluateDoc, reevaluate } from '../src/engine/evaluate';
import type { GeoObject } from '../src/engine/types';

// PLAN.md §7: recompute during a drag must stay well under a frame for ~1,000 objects.
describe('performance', () => {
  it('re-evaluates a 1,000-object construction during a drag in < 2 ms per frame', () => {
    const s = new Scratch();
    const root = s.free(0, 0);
    let prev = root;
    let prev2 = s.free(40, 5);
    while (s.doc.order.length < 1000) {
      const [c] = s.tool('circle', [prev, prev2]);
      const [l] = s.tool('line', [prev, prev2]);
      const pts = s.tool('intersect', [c, l]);
      prev = prev2;
      prev2 = pts[pts.length - 1];
    }
    const ids = [root, ...downstream(s.doc, [root])];
    expect(ids.length).toBeGreaterThan(900);
    const vals = evaluateDoc(s.doc);
    const o = s.doc.objects[root];
    const frames = 200;
    const t0 = performance.now();
    for (let f = 0; f < frames; f++) {
      const moved = new Map<string, GeoObject>([[root, { ...o, def: { t: 'free', x: Math.sin(f) * 3, y: Math.cos(f) * 3 } } as GeoObject]]);
      reevaluate(s.doc, vals, ids, moved);
    }
    const perFrame = (performance.now() - t0) / frames;
    expect(perFrame).toBeLessThan(2);
  });
});
