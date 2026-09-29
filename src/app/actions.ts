import type { Doc } from '../engine/types';
import { newDoc, newId } from '../engine/doc';
import { docToJSON, FILE_EXT, parseDoc } from '../engine/serialize';
import { exportPNG, extractFromPng } from '../render/export';
import { loadDoc, toast, useApp } from './store';
import { loadLocal, lsSet, saveLocal } from './persistence/library';
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
    // recognise a PNG by its content, not its name: shared images often arrive renamed
    const bytes = new Uint8Array(await file.arrayBuffer());
    const isPng = bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
    const doc: Doc | null = isPng ? extractFromPng(bytes) : parseDoc(new TextDecoder().decode(bytes));
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
  input.accept = `${FILE_EXT},.json,.png,application/json,image/png`;
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

const isPhoneLike = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
const cancelled = (e: unknown) => e instanceof DOMException && e.name === 'AbortError';

/** On phones/tablets, hand the file to the share sheet (Save to Photos/Files, messages…); else download. */
async function shareOrDownload(blob: Blob, name: string, title: string) {
  const file = new File([blob], name, { type: blob.type });
  if (isPhoneLike() && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return;
    } catch (e) {
      if (cancelled(e)) return; // closed the share sheet: nothing else to do
    }
  }
  download(blob, name);
}

/** The whole construction as a file: the backup that can't lose anything. */
export async function saveFile() {
  const d = useApp.getState().doc;
  await shareOrDownload(new Blob([docToJSON(d)], { type: 'application/json' }), `${slug(d.title)}${FILE_EXT}`, d.title);
}

/** A picture of the figure (white background). DrawGeo can reopen it, unless an app strips the hidden data. */
export async function saveImage() {
  const s = useApp.getState();
  const png = await exportPNG(s.doc, s.values, { showPointLabels: s.settings.pointLabels, measures: canvasMeasuresForExport() });
  await shareOrDownload(png, `${slug(s.doc.title)}.png`, s.doc.title);
}

export async function copyShareLink() {
  const d = useApp.getState().doc;
  const url = await shareUrl(d);
  try {
    if (navigator.share && isPhoneLike()) {
      await navigator.share({ title: d.title, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    toast('Share link copied. Anyone with it can view and replay the steps.', 'success', 4000);
  } catch (e) {
    if (cancelled(e)) return;
    window.prompt('Copy this link:', url);
  }
}
