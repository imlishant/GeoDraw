import type { Doc } from '../../engine/types';
import { idbAll, idbDelete, idbGet, idbPut } from './idb';

export interface DocSummary {
  id: string;
  title: string;
  updatedAt: number;
  objectCount: number;
  stepCount: number;
}

export async function saveLocal(doc: Doc): Promise<void> {
  try {
    await idbPut('docs', doc);
  } catch {
    /* storage unavailable: autosave is best-effort */
  }
}

export async function loadLocal(id: string): Promise<Doc | undefined> {
  try {
    return await idbGet<Doc>('docs', id);
  } catch {
    return undefined;
  }
}

export async function listLocal(): Promise<DocSummary[]> {
  try {
    const all = await idbAll<Doc>('docs');
    return all
      .map((d) => ({ id: d.id, title: d.title, updatedAt: d.updatedAt, objectCount: d.order.length, stepCount: d.steps.length }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

export async function deleteLocal(id: string): Promise<void> {
  try {
    await idbDelete('docs', id);
  } catch {
    /* ignore */
  }
}

// ---- small per-viewer conveniences (localStorage) ---------------------------

export function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
