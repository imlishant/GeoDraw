import type { Doc, GeoObject, Id, Kind, Measure, Step } from './types';
import { parentsOf } from './evaluate';

// ---- Ids & names ------------------------------------------------------------

let counter = 0;
export function newId(prefix = 'o'): Id {
  counter = (counter + 1) % 1e6;
  return `${prefix}${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

const SUB = ['', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];
const subscript = (n: number): string =>
  n < 10 ? SUB[n] : String(n).split('').map((c) => '₀₁₂₃₄₅₆₇₈₉'[+c]).join('');

/** Next free name: points A…Z, A₁…; lines & circles a…z, a₁…; regions P1… */
export function nextName(doc: Doc, kind: Kind, taken: Set<string> = new Set()): string {
  const used = new Set(taken);
  for (const o of Object.values(doc.objects)) used.add(o.name);
  if (kind === 'region') {
    for (let i = 1; ; i++) if (!used.has(`poly${i}`)) return `poly${i}`;
  }
  const letters = kind === 'point' ? 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' : 'abcdefghijklmnopqrstuvwxyz';
  for (let round = 0; ; round++) {
    for (const ch of letters) {
      const name = ch + (round === 0 ? '' : subscript(round));
      if (!used.has(name)) return name;
    }
  }
}

export function newDoc(title = 'Untitled construction'): Doc {
  const now = Date.now();
  return { schemaVersion: 1, id: newId('d'), title, objects: {}, order: [], steps: [], measures: [], createdAt: now, updatedAt: now };
}

// ---- Patches: the unit of undo/redo -----------------------------------------
// A patch records before/after for everything it touches. Undo = apply "before".
// Arrays are replaced by reference, so history shares structure and stays small.

export interface Patch {
  label: string;
  objs?: Record<Id, [GeoObject | undefined, GeoObject | undefined]>;
  order?: [Id[], Id[]];
  steps?: [Step[], Step[]];
  measures?: [Measure[], Measure[]];
  title?: [string, string];
}

export function applyPatch(doc: Doc, p: Patch, dir: 'fwd' | 'back'): Doc {
  const i = dir === 'fwd' ? 1 : 0;
  const next: Doc = { ...doc, updatedAt: Date.now() };
  if (p.objs) {
    next.objects = { ...doc.objects };
    for (const [id, pair] of Object.entries(p.objs)) {
      const o = pair[i];
      if (o) next.objects[id] = o;
      else delete next.objects[id];
    }
  }
  if (p.order) next.order = p.order[i];
  if (p.steps) next.steps = p.steps[i];
  if (p.measures) next.measures = p.measures[i];
  if (p.title) next.title = p.title[i];
  return next;
}

/** Append new objects and the step that created them. */
export function addStepPatch(doc: Doc, objs: GeoObject[], step: Step | null, label: string): Patch {
  const map: Patch['objs'] = {};
  for (const o of objs) map[o.id] = [undefined, o];
  return {
    label,
    objs: map,
    order: [doc.order, [...doc.order, ...objs.map((o) => o.id)]],
    ...(step ? { steps: [doc.steps, [...doc.steps, step]] as [Step[], Step[]] } : {}),
  };
}

export function setObjectsPatch(doc: Doc, updates: GeoObject[], label: string): Patch {
  const map: Patch['objs'] = {};
  for (const o of updates) map[o.id] = [doc.objects[o.id], o];
  return { label, objs: map };
}

/** Everything that transitively depends on `ids` (including them), in creation order. */
export function dependentsClosure(doc: Doc, ids: Id[]): Id[] {
  const gone = new Set(ids);
  for (const id of doc.order) {
    if (gone.has(id)) continue;
    const o = doc.objects[id];
    if (o && parentsOf(o).some((p) => gone.has(p))) gone.add(id);
  }
  return doc.order.filter((id) => gone.has(id));
}

export function measureRefs(m: Measure): Id[] {
  switch (m.t) {
    case 'distance':
      return [m.a, m.b];
    case 'angle':
      return [m.a, m.v, m.b];
    case 'area':
      return [m.of];
  }
}

/** Delete objects and everything built on them. Steps lose those outputs; empty steps disappear. */
export function deletePatch(doc: Doc, ids: Id[]): Patch {
  const all = dependentsClosure(doc, ids);
  const gone = new Set(all);
  const map: Patch['objs'] = {};
  for (const id of all) map[id] = [doc.objects[id], undefined];
  const steps: Step[] = [];
  for (const s of doc.steps) {
    const outputs = s.outputs.filter((o) => !gone.has(o));
    if (outputs.length === 0) continue;
    if (s.inputs.some((i) => gone.has(i))) continue;
    steps.push(outputs.length === s.outputs.length ? s : { ...s, outputs });
  }
  return {
    label: `Delete ${all.length} object${all.length === 1 ? '' : 's'}`,
    objs: map,
    order: [doc.order, doc.order.filter((id) => !gone.has(id))],
    steps: [doc.steps, steps],
    measures: [doc.measures, doc.measures.filter((m) => !measureRefs(m).some((r) => gone.has(r)))],
  };
}

// ---- History ----------------------------------------------------------------

export interface History {
  past: Patch[];
  future: Patch[];
}

export const emptyHistory = (): History => ({ past: [], future: [] });

export function commit(doc: Doc, h: History, p: Patch): { doc: Doc; history: History } {
  return { doc: applyPatch(doc, p, 'fwd'), history: { past: [...h.past, p], future: [] } };
}

export function undo(doc: Doc, h: History): { doc: Doc; history: History } | null {
  const p = h.past[h.past.length - 1];
  if (!p) return null;
  return { doc: applyPatch(doc, p, 'back'), history: { past: h.past.slice(0, -1), future: [p, ...h.future] } };
}

export function redo(doc: Doc, h: History): { doc: Doc; history: History } | null {
  const p = h.future[0];
  if (!p) return null;
  return { doc: applyPatch(doc, p, 'fwd'), history: { past: [...h.past, p], future: h.future.slice(1) } };
}
