// Randomized verification (PLAN.md §6.5): "it looks right" is not "it is right".
// Move every free point a little, re-evaluate the whole construction, and require
// the goal to hold in every trial. A point placed by eye passes trial 0 and fails
// the rest.

import type { Doc, Geo, GeoObject, Id, Values } from './types';
import { evaluateDoc } from './evaluate';

export type Target =
  | { k: 'point'; x: number; y: number }
  | { k: 'line'; px: number; py: number; dx: number; dy: number }
  | { k: 'circle'; cx: number; cy: number; r: number };

/** Given values of the problem's givens (by name), return goal alternatives; any one fully present wins. */
export type TargetFn = (g: (name: string) => Geo) => Target[][];

export interface CheckResult {
  solved: boolean;
  validTrials: number;
  failedTrial?: number;
}

/** Deterministic PRNG so checks are reproducible. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sceneSize(doc: Doc, vals: Values): number {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of doc.order) {
    const o = doc.objects[id];
    const g = vals.get(id);
    if (!o?.given || !g || g.k !== 'point') continue;
    minX = Math.min(minX, g.x);
    maxX = Math.max(maxX, g.x);
    minY = Math.min(minY, g.y);
    maxY = Math.max(maxY, g.y);
  }
  const s = Math.max(maxX - minX, maxY - minY);
  return Number.isFinite(s) && s > 0 ? s : 100;
}

export function matches(t: Target, g: Geo | null | undefined, eps: number): boolean {
  if (!g) return false;
  if (t.k === 'point') return g.k === 'point' && Math.hypot(g.x - t.x, g.y - t.y) <= eps;
  if (t.k === 'circle') {
    return g.k === 'circle' && Math.hypot(g.cx - t.cx, g.cy - t.cy) <= eps && Math.abs(g.r - t.r) <= eps;
  }
  if (g.k !== 'line') return false;
  const tl = Math.hypot(t.dx, t.dy);
  const sin = Math.abs(g.dx * t.dy - g.dy * t.dx) / tl;
  if (sin > 1e-7) return false;
  const dist = Math.abs(g.dx * (t.py - g.py) - g.dy * (t.px - g.px));
  return dist <= eps;
}

function perturbed(doc: Doc, rand: () => number, delta: number): Map<Id, GeoObject> {
  const out = new Map<Id, GeoObject>();
  for (const id of doc.order) {
    const o = doc.objects[id];
    if (o.kind !== 'point') continue;
    if (o.def.t === 'free') {
      out.set(id, { ...o, def: { t: 'free', x: o.def.x + (rand() * 2 - 1) * delta, y: o.def.y + (rand() * 2 - 1) * delta } });
    } else if (o.def.t === 'on') {
      out.set(id, { ...o, def: { ...o.def, u: o.def.u + (rand() * 2 - 1) * 0.05 } });
    }
  }
  return out;
}

export function checkSolution(doc: Doc, targets: TargetFn, trials = 20, seed = 1234): CheckResult {
  const givens = doc.problemGivens ?? {};
  const base = evaluateDoc(doc);
  const size = sceneSize(doc, base);
  const rand = mulberry32(seed);
  const candidates = doc.order.filter((id) => !doc.objects[id].given);
  let valid = 0;
  for (let k = 0; k < trials; k++) {
    const vals = k === 0 ? base : evaluateDoc(doc, perturbed(doc, rand, size * 0.06));
    let alts: Target[][];
    try {
      alts = targets((name) => {
        const g = vals.get(givens[name]);
        if (!g) throw new Error('given undefined');
        return g;
      });
    } catch {
      continue; // givens degenerate in this trial: skip it
    }
    valid++;
    const eps = 1e-6 * size;
    const ok = alts.some((alt) => alt.every((t) => candidates.some((id) => matches(t, vals.get(id), eps))));
    if (!ok) return { solved: false, validTrials: valid, failedTrial: k };
  }
  return { solved: valid >= Math.min(10, trials), validTrials: valid };
}
