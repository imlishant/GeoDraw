import type { Doc } from '../engine/types';
import { newDoc, newId } from '../engine/doc';
import { docToJSON, FILE_EXT, parseDoc } from '../engine/serialize';
import { problemDoc, type Problem } from '../engine/problems';
import { exportPNG, exportSVG, extractFromPng, extractFromSvg } from '../render/export';
import { controller } from './controller';
import { stepsAsText } from './describe';
import { loadDoc, problemOf, toast, useApp } from './store';
import { getProgress, loadLocal, lsSet, saveLocal } from './persistence/library';
import { shareUrl } from './persistence/share';
import { formatNumber } from './format';
import { measureValue } from '../engine/measure';

function slug(s: string) {
  return s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'construction';
}

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function newConstruction() {
  const d = newDoc();
  loadDoc(d);
  lsSet('drawgeo.current', d.id);
  history.replaceState(null, '', location.pathname);
}

export async function openLocal(id: string) {
  const d = await loadLocal(id);
  if (!d) return toast('That construction could not be found', 'error');
  loadDoc(d);
  lsSet('drawgeo.current', d.id);
}

export async function openProblem(p: Problem) {
  const prog = await getProgress(p.id);
  const prev = prog?.docId ? await loadLocal(prog.docId) : undefined;
  const d = prev && prev.problemId === p.id ? prev : problemDoc(p);
  loadDoc(d);
  lsSet('drawgeo.current', d.id);
  history.replaceState(null, '', location.pathname);
  useApp.setState({ dialog: null });
}

export function restartProblem() {
  const p = problemOf(useApp.getState().doc);
  if (!p) return;
  const d = problemDoc(p);
  loadDoc(d);
  lsSet('drawgeo.current', d.id);
}

export function exitProblem() {
  newConstruction();
}

/** A shared (read-only) construction becomes your own editable copy. */
export async function makeCopy() {
  const s = useApp.getState();
  const d: Doc = { ...s.doc, id: newId('d'), title: `${s.doc.title} (copy)`, updatedAt: Date.now() };
  history.replaceState(null, '', location.pathname);
  loadDoc(d);
  await saveLocal(d);
  lsSet('drawgeo.current', d.id);
  toast('Saved a copy to your library', 'success');
}

export async function importFile(file: File) {
  try {
    let doc: Doc | null;
    const name = file.name.toLowerCase();
    if (file.type === 'image/png' || name.endsWith('.png')) doc = extractFromPng(new Uint8Array(await file.arrayBuffer()));
    else if (file.type === 'image/svg+xml' || name.endsWith('.svg')) doc = extractFromSvg(await file.text());
    else doc = parseDoc(await file.text());
    if (!doc) throw new Error('This image has no DrawGeo construction inside');
    const fresh = { ...doc, id: newId('d'), updatedAt: Date.now() };
    loadDoc(fresh);
    await saveLocal(fresh);
    lsSet('drawgeo.current', fresh.id);
    toast(`Opened “${fresh.title}”`, 'success');
  } catch (e) {
    toast((e as Error).message, 'error', 4500);
  }
}

export function pickFileToImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = `${FILE_EXT},.json,.png,.svg,application/json,image/png,image/svg+xml`;
  input.onchange = () => {
    const f = input.files?.[0];
    if (f) void importFile(f);
  };
  input.click();
}

function canvasMeasuresForExport() {
  const s = useApp.getState();
  if (!s.settings.canvasMeasures) return [];
  const out: Parameters<typeof exportPNG>[2]['measures'] = [];
  for (const m of s.doc.measures) {
    const v = measureValue(m, s.values);
    if (v.value === null) continue;
    const text = `${formatNumber(v.value, s.settings.decimals)}${v.unit}`;
    const pt = (id: string) => s.values.get(id) as { x: number; y: number } | undefined;
    if (m.t === 'distance' && pt(m.a) && pt(m.b)) out.push({ kind: 'distance', refs: [pt(m.a)!, pt(m.b)!], text });
    if (m.t === 'angle' && pt(m.a) && pt(m.v) && pt(m.b)) out.push({ kind: 'angle', refs: [pt(m.a)!, pt(m.v)!, pt(m.b)!], text });
  }
  return out;
}

export function exportJSON() {
  const d = useApp.getState().doc;
  download(new Blob([docToJSON(d)], { type: 'application/json' }), `${slug(d.title)}${FILE_EXT}`);
}

export async function exportImage(kind: 'png' | 'svg', whiteBackground = false) {
  const s = useApp.getState();
  const opts = { theme: controller.theme, showPointLabels: s.settings.pointLabels, measures: canvasMeasuresForExport(), whiteBackground };
  if (kind === 'png') download(await exportPNG(s.doc, s.values, opts), `${slug(s.doc.title)}.png`);
  else download(new Blob([exportSVG(s.doc, s.values, opts)], { type: 'image/svg+xml' }), `${slug(s.doc.title)}.svg`);
}

export function exportStepsText() {
  const d = useApp.getState().doc;
  download(new Blob([stepsAsText(d)], { type: 'text/plain' }), `${slug(d.title)}-steps.txt`);
}

export async function copyShareLink() {
  const d = useApp.getState().doc;
  const url = await shareUrl(d);
  try {
    if (navigator.share && matchMedia('(pointer: coarse)').matches) {
      await navigator.share({ title: d.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Share link copied. Anyone with it can view and replay the steps.', 'success', 4000);
  } catch {
    window.prompt('Copy this link:', url);
  }
}
