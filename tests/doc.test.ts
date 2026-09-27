import { describe, expect, it } from 'vitest';
import { Scratch } from './scratch';
import { addStepPatch, commit, deletePatch, emptyHistory, nextName, newDoc, redo, setObjectsPatch, undo } from '../src/engine/doc';
import { downstream, evaluateDoc } from '../src/engine/evaluate';
import type { GeoObject, PointObj } from '../src/engine/types';

function triangleDoc() {
  const s = new Scratch();
  const A = s.free(-100, 0);
  const B = s.free(100, 0);
  const [c1] = s.tool('circle', [A, B]);
  const [c2] = s.tool('circle', [B, A]);
  const [C, D] = s.tool('intersect', [c1, c2]);
  const [l] = s.tool('line', [C, D]);
  return { s, A, B, c1, c2, C, D, l };
}

describe('document', () => {
  it('names points A, B, … and lines a, b, …, then subscripts', () => {
    const d = newDoc();
    expect(nextName(d, 'point')).toBe('A');
    expect(nextName(d, 'line')).toBe('a');
    const taken = new Set('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
    expect(nextName(d, 'point', taken)).toBe('A₁');
  });

  it('evaluates in order and propagates undefined', () => {
    const { s, A, C, l } = triangleDoc();
    const vals = evaluateDoc(s.doc);
    expect(vals.get(l)).toBeTruthy();
    // pull A far away: circles no longer meet → C and the line become undefined
    const a = s.doc.objects[A] as PointObj;
    const moved = new Map<string, GeoObject>([[A, { ...a, def: { t: 'free', x: -10000, y: 0 } }]]);
    // circles still meet (radius grows with distance) — so instead shrink: move A onto B
    const onB = new Map<string, GeoObject>([[A, { ...a, def: { t: 'free', x: 100, y: 0 } }]]);
    expect(evaluateDoc(s.doc, moved).get(C)).toBeTruthy();
    const v2 = evaluateDoc(s.doc, onB);
    expect(v2.get(C)).toBeNull();
    expect(v2.get(l)).toBeNull();
    // and it comes back
    expect(evaluateDoc(s.doc).get(C)).toBeTruthy();
  });

  it('downstream finds only dependents, in order', () => {
    const { s, A, B, c1, c2, C, D, l } = triangleDoc();
    expect(downstream(s.doc, [A])).toEqual([c1, c2, C, D, l]);
    expect(downstream(s.doc, [C])).toEqual([l]);
    expect(downstream(s.doc, [B]).includes(A)).toBe(false);
  });

  it('delete cascades to dependents and undo restores everything', () => {
    const { s, c1, C, D, l } = triangleDoc();
    const before = s.doc;
    const p = deletePatch(before, [c1]);
    const r = commit(before, emptyHistory(), p);
    expect(r.doc.objects[c1]).toBeUndefined();
    expect(r.doc.objects[C]).toBeUndefined();
    expect(r.doc.objects[D]).toBeUndefined();
    expect(r.doc.objects[l]).toBeUndefined();
    expect(r.doc.steps.map((x) => x.tool)).toEqual(['circle']); // only c2's step survives
    const u = undo(r.doc, r.history)!;
    expect(u.doc.order).toEqual(before.order);
    expect(u.doc.steps).toEqual(before.steps);
    const again = redo(u.doc, u.history)!;
    expect(again.doc.order).toEqual(r.doc.order);
  });

  it('history is unlimited and shares structure', () => {
    let doc = newDoc();
    let h = emptyHistory();
    for (let i = 0; i < 500; i++) {
      const o: GeoObject = { id: `p${i}`, kind: 'point', name: `P${i}`, def: { t: 'free', x: i, y: 0 } };
      ({ doc, history: h } = commit(doc, h, addStepPatch(doc, [o], null, 'point')));
    }
    expect(h.past).toHaveLength(500);
    for (let i = 0; i < 500; i++) ({ doc, history: h } = undo(doc, h)!);
    expect(doc.order).toHaveLength(0);
  });

  it('move is a single set patch', () => {
    const { s, A } = triangleDoc();
    const a = s.doc.objects[A] as PointObj;
    const p = setObjectsPatch(s.doc, [{ ...a, def: { t: 'free', x: 0, y: 50 } }], 'Move');
    const r = commit(s.doc, emptyHistory(), p);
    expect((r.doc.objects[A] as PointObj).def).toEqual({ t: 'free', x: 0, y: 50 });
    expect(r.doc.steps).toBe(s.doc.steps); // moving is not a step
  });
});
