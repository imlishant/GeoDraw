import { afterAll, describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Doc, GeoObject, Id, Kind, ToolId, Values } from '../src/engine/types';
import { build } from '../src/engine/build';
import { addStepPatch, commit, deletePatch, emptyHistory, newDoc, newId, redo, setObjectsPatch, undo, type History } from '../src/engine/doc';
import { downstream, evaluateDoc, parentsOf, reevaluate } from '../src/engine/evaluate';
import { docToJSON, parseDoc } from '../src/engine/serialize';

// Random sequences of user actions through the same functions the UI uses
// (build → addStepPatch → commit, move, hide, delete, undo, redo), checking
// that the document stays consistent after EVERY action.

type In = 'P' | 'L' | 'C' | 'K' | 'A'; // point, line, circle, curve, any
const TOOLS: Array<[ToolId, In[], number?]> = [
  ['line', ['P', 'P']],
  ['segment', ['P', 'P']],
  ['ray', ['P', 'P']],
  ['vector', ['P', 'P']],
  ['circle', ['P', 'P']],
  ['perpBisector', ['P', 'P']],
  ['perpendicular', ['L', 'P']],
  ['parallel', ['L', 'P']],
  ['angleBisector', ['P', 'P', 'P']],
  ['compass', ['P', 'P', 'P']],
  ['intersect', ['K', 'K']],
  ['midpoint', ['P', 'P']],
  ['tangents', ['P', 'C']],
  ['polygon', ['P', 'P', 'P']],
  ['semicircle', ['P', 'P']],
  ['sector', ['P', 'P', 'P']],
  ['reflectLine', ['A', 'L']],
  ['reflectPoint', ['A', 'P']],
  ['translate', ['A', 'P', 'P']],
  ['rotate', ['A', 'P', 'P', 'P', 'P']],
  ['dilate', ['A', 'P', 'P', 'P']],
  ['segmentLength', ['P'], 1.5],
  ['circleRadius', ['P'], 0.8],
  ['angleSize', ['P', 'P'], 50],
  ['rotateBy', ['A', 'P'], 30],
  ['dilateBy', ['A', 'P'], 1.5],
  ['regularPolygon', ['P', 'P'], 5],
];

type Action =
  | { t: 'free'; x: number; y: number }
  | { t: 'tool'; k: number; picks: number[] }
  | { t: 'move'; i: number; x: number; y: number }
  | { t: 'hide'; i: number }
  | { t: 'delete'; i: number }
  | { t: 'undo' }
  | { t: 'redo' };

const c = fc.integer({ min: -250, max: 250 });
const action: fc.Arbitrary<Action> = fc.oneof(
  { weight: 6, arbitrary: fc.record({ t: fc.constant('free' as const), x: c, y: c }) },
  { weight: 16, arbitrary: fc.record({ t: fc.constant('tool' as const), k: fc.nat(), picks: fc.array(fc.nat(), { minLength: 5, maxLength: 5 }) }) },
  { weight: 3, arbitrary: fc.record({ t: fc.constant('move' as const), i: fc.nat(), x: c, y: c }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('hide' as const), i: fc.nat() }) },
  { weight: 1, arbitrary: fc.record({ t: fc.constant('delete' as const), i: fc.nat() }) },
  { weight: 2, arbitrary: fc.constant({ t: 'undo' as const }) },
  { weight: 1, arbitrary: fc.constant({ t: 'redo' as const }) },
);

const kinds: Record<In, Kind[]> = { P: ['point'], L: ['line'], C: ['circle'], K: ['line', 'circle'], A: ['point', 'line', 'circle'] };

function checkInvariants(doc: Doc): Values {
  const ids = new Set(doc.order);
  expect(new Set(Object.keys(doc.objects))).toEqual(ids);
  const seen = new Set<Id>();
  for (const id of doc.order) {
    for (const p of parentsOf(doc.objects[id])) expect(seen.has(p), `${id} uses ${p} before it exists`).toBe(true);
    seen.add(id);
  }
  for (const s of doc.steps) {
    for (const o of s.outputs) expect(ids.has(o), 'step output missing').toBe(true);
    for (const i of s.inputs) expect(ids.has(i), 'step input missing').toBe(true);
  }
  const vals = evaluateDoc(doc);
  for (const [, g] of vals) {
    if (!g) continue;
    const nums = g.k === 'region' ? g.pts.flatMap((p) => [p.x, p.y]) : Object.values(g).filter((v) => typeof v === 'number');
    for (const n of nums as number[]) expect(Number.isNaN(n), 'NaN in geometry').toBe(false);
  }
  // round-trip through the file format
  const back = parseDoc(docToJSON(doc));
  expect(back.order).toEqual(doc.order);
  return vals;
}

function run(actions: Action[]) {
  let doc = newDoc();
  let h: History = emptyHistory();
  const apply = (p: Parameters<typeof commit>[2]) => ({ doc, history: h } = commit(doc, h, p));
  for (const a of actions) {
    const vals = evaluateDoc(doc);
    const of = (ks: Kind[]) => doc.order.filter((id) => ks.includes(doc.objects[id].kind) && vals.get(id));
    if (a.t === 'free') {
      const o: GeoObject = { id: newId(), kind: 'point', name: `P${doc.order.length}`, def: { t: 'free', x: a.x, y: a.y } };
      apply(addStepPatch(doc, [o], { id: newId('s'), tool: 'point', inputs: [o.id], outputs: [o.id] }, 'Point'));
    } else if (a.t === 'tool') {
      const [tool, ins, num] = TOOLS[a.k % TOOLS.length];
      const picks: Id[] = [];
      for (let j = 0; j < ins.length; j++) {
        const pool = of(kinds[ins[j]]);
        if (!pool.length) break;
        picks.push(pool[a.picks[j] % pool.length]);
      }
      if (picks.length !== ins.length) continue;
      if (tool === 'polygon') picks.push(picks[0]);
      const res = build(tool, picks, { doc, values: vals, obj: (id) => doc.objects[id] }, num);
      if (res.error || !res.objs.length) continue;
      apply(addStepPatch(doc, res.objs, { id: newId('s'), tool, inputs: picks, outputs: res.objs.map((o) => o.id) }, tool));
      STATS.tools.add(tool);
    } else if (a.t === 'move') {
      const pool = doc.order.filter((id) => doc.objects[id].kind === 'point' && doc.objects[id].def.t === 'free');
      if (!pool.length) continue;
      const o = doc.objects[pool[a.i % pool.length]];
      apply(setObjectsPatch(doc, [{ ...o, def: { t: 'free', x: a.x, y: a.y } } as GeoObject], 'Move'));
    } else if (a.t === 'hide') {
      if (!doc.order.length) continue;
      const o = doc.objects[doc.order[a.i % doc.order.length]];
      apply(setObjectsPatch(doc, [{ ...o, hidden: !o.hidden }], 'Hide'));
    } else if (a.t === 'delete') {
      if (!doc.order.length) continue;
      apply(deletePatch(doc, [doc.order[a.i % doc.order.length]]));
    } else if (a.t === 'undo') {
      const r = undo(doc, h);
      if (r) ({ doc, history: h } = r);
    } else {
      const r = redo(doc, h);
      if (r) ({ doc, history: h } = r);
    }
    checkInvariants(doc);
  }
  STATS.maxObjects = Math.max(STATS.maxObjects, doc.order.length);
  STATS.runs++;
  STATS.totalObjects += doc.order.length;
  return { doc, h };
}

export const STATS = { tools: new Set<string>(), maxObjects: 0, runs: 0, totalObjects: 0 };

const snapshot = (d: Doc) => JSON.stringify({ o: d.objects, order: d.order, steps: d.steps, m: d.measures });

describe('random action sequences', () => {
  afterAll(() => console.log(`fuzz: ${STATS.runs} runs, avg ${(STATS.totalObjects / STATS.runs).toFixed(1)} objects, max ${STATS.maxObjects}, tools used ${STATS.tools.size}/${TOOLS.length}`));
  it('keep the document consistent after every action', () => {
    fc.assert(fc.property(fc.array(action, { minLength: 20, maxLength: 120 }), (acts) => void run(acts)), { numRuns: 400 });
  }, 60_000);

  it('undo everything → empty; redo everything → the identical document', () => {
    fc.assert(
      fc.property(fc.array(action.filter((a) => a.t !== 'undo' && a.t !== 'redo'), { minLength: 10, maxLength: 80 }), (acts) => {
        let { doc, h } = run(acts);
        const final = snapshot(doc);
        for (let r = undo(doc, h); r; r = undo(doc, h)) ({ doc, history: h } = r);
        expect(doc.order).toEqual([]);
        expect(doc.steps).toEqual([]);
        for (let r = redo(doc, h); r; r = redo(doc, h)) ({ doc, history: h } = r);
        expect(snapshot(doc)).toBe(final);
      }),
      { numRuns: 300 },
    );
  }, 60_000);

  it('dragging: the fast partial update equals a full re-evaluation, every frame', () => {
    fc.assert(
      fc.property(fc.array(action.filter((a) => a.t === 'free' || a.t === 'tool'), { minLength: 10, maxLength: 80 }), fc.array(fc.tuple(c, c), { minLength: 1, maxLength: 12 }), fc.nat(), (acts, path, pick) => {
        const { doc } = run(acts);
        const free = doc.order.filter((id) => doc.objects[id].kind === 'point' && doc.objects[id].def.t === 'free');
        if (!free.length) return;
        const id = free[pick % free.length];
        const ids = [id, ...downstream(doc, [id])];
        const live = evaluateDoc(doc);
        for (const [x, y] of path) {
          const moved = new Map<Id, GeoObject>([[id, { ...doc.objects[id], def: { t: 'free', x, y } } as GeoObject]]);
          reevaluate(doc, live, ids, moved);
          const full = evaluateDoc(doc, moved);
          for (const oid of doc.order) expect(JSON.stringify(live.get(oid))).toBe(JSON.stringify(full.get(oid)));
        }
        // and moving back restores exactly the original figure (no hidden state)
        reevaluate(doc, live, ids);
        const orig = evaluateDoc(doc);
        for (const oid of doc.order) expect(JSON.stringify(live.get(oid))).toBe(JSON.stringify(orig.get(oid)));
      }),
      { numRuns: 300 },
    );
  }, 60_000);
});
