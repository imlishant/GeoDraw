import type { Doc } from './types';
import { parentsOf } from './evaluate';

export const FILE_EXT = '.drawgeo.json';

export function docToJSON(doc: Doc): string {
  return JSON.stringify(doc);
}

/** Parse and validate a document from untrusted JSON. Throws with a readable message. */
export function parseDoc(text: string): Doc {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('Not a DrawGeo file (invalid JSON)');
  }
  const d = raw as Partial<Doc>;
  if (!d || typeof d !== 'object' || d.schemaVersion !== 1) throw new Error('Unsupported or missing schemaVersion');
  if (!d.objects || typeof d.objects !== 'object' || !Array.isArray(d.order) || !Array.isArray(d.steps)) {
    throw new Error('File is missing objects, order or steps');
  }
  // every reference must point to an earlier object (keeps evaluation a simple forward pass)
  const seen = new Set<string>();
  for (const id of d.order) {
    const o = d.objects[id];
    if (!o || o.id !== id) throw new Error(`Object ${id} is listed but missing`);
    for (const p of parentsOf(o)) if (!seen.has(p)) throw new Error(`Object ${id} refers to ${p} before it exists`);
    seen.add(id);
  }
  const now = Date.now();
  return {
    schemaVersion: 1,
    id: typeof d.id === 'string' ? d.id : `d${now.toString(36)}`,
    title: typeof d.title === 'string' ? d.title : 'Imported construction',
    objects: d.objects,
    order: d.order,
    steps: d.steps,
    measures: Array.isArray(d.measures) ? d.measures : [],
    ...(d.problemId ? { problemId: d.problemId, problemGivens: d.problemGivens } : {}),
    createdAt: typeof d.createdAt === 'number' ? d.createdAt : now,
    updatedAt: typeof d.updatedAt === 'number' ? d.updatedAt : now,
  };
}

// ---- base64url helpers (share links, PNG embedding) -------------------------

export function bytesToBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(s: string): Uint8Array {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}
