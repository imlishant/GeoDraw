// PNG/SVG export with the construction embedded (Excalidraw's trick): opening an
// exported image in DrawGeo restores the full construction and its steps.

import type { Doc, Values } from '../engine/types';
import { base64UrlToBytes, bytesToBase64Url, docToJSON, parseDoc } from '../engine/serialize';
import { boundingBox } from './hit';
import { fit, toScreen, type Viewport } from './camera';
import { clipLine, drawConstruction, isDraggable, type CanvasMeasure } from './renderer';
import { objectColor, type Theme } from './theme';

const KEY = 'drawgeo';

export interface ExportOpts {
  theme: Theme;
  showPointLabels: boolean;
  measures: CanvasMeasure[];
  whiteBackground: boolean;
}

function exportFrame(doc: Doc, values: Values) {
  const box = boundingBox(doc, values) ?? { minX: -200, minY: -150, maxX: 200, maxY: 150 };
  const pad = 40;
  const w = Math.min(4000, Math.max(200, box.maxX - box.minX + pad * 2));
  const h = Math.min(4000, Math.max(160, box.maxY - box.minY + pad * 2));
  const vp: Viewport = { w, h };
  const cam = fit(box, vp, pad);
  return { vp, cam };
}

const printTheme = (t: Theme): Theme => ({ ...t, bg: '#ffffff' });

export async function exportPNG(doc: Doc, values: Values, o: ExportOpts): Promise<Blob> {
  const { vp, cam } = exportFrame(doc, values);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.w * scale);
  canvas.height = Math.round(vp.h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const theme = o.whiteBackground ? printTheme(o.theme) : o.theme;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, vp.w, vp.h);
  drawConstruction(ctx, vp, {
    doc,
    values,
    cam,
    theme,
    visible: (x) => !x.hidden,
    faint: () => false,
    highlight: new Set(),
    showPointLabels: o.showPointLabels,
    measures: o.measures,
    coarse: false,
  });
  const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('PNG export failed'))), 'image/png'));
  const bytes = new Uint8Array(await blob.arrayBuffer());
  return new Blob([embedInPng(bytes, docToJSON(doc)) as BlobPart], { type: 'image/png' });
}

export function exportSVG(doc: Doc, values: Values, o: ExportOpts): string {
  const { vp, cam } = exportFrame(doc, values);
  const t = o.whiteBackground ? printTheme(o.theme) : o.theme;
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const parts: string[] = [];
  const f = (n: number) => n.toFixed(2);
  for (const id of doc.order) {
    const ob = doc.objects[id];
    const g = values.get(id);
    if (!ob || !g || ob.hidden) continue;
    const color = objectColor(t, ob.style?.color, !!ob.given);
    const sw = ob.given ? 2 : 1.4;
    const dash = ob.style?.dashed ? ' stroke-dasharray="7 5"' : '';
    if (g.k === 'line') {
      const seg = clipLine(g, cam, vp, 0);
      if (!seg) continue;
      const a = toScreen(cam, vp, seg[0].x, seg[0].y);
      const b = toScreen(cam, vp, seg[1].x, seg[1].y);
      parts.push(`<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${color}" stroke-width="${sw}"${dash} stroke-linecap="round"/>`);
    } else if (g.k === 'circle') {
      const c = toScreen(cam, vp, g.cx, g.cy);
      const r = g.r * cam.zoom;
      if (g.a0 !== undefined && g.a1 !== undefined) {
        const p0 = { x: c.x + r * Math.cos(-g.a0), y: c.y + r * Math.sin(-g.a0) };
        const p1 = { x: c.x + r * Math.cos(-g.a1), y: c.y + r * Math.sin(-g.a1) };
        const large = g.a1 - g.a0 > Math.PI ? 1 : 0;
        parts.push(`<path d="M${f(p0.x)} ${f(p0.y)} A${f(r)} ${f(r)} 0 ${large} 0 ${f(p1.x)} ${f(p1.y)}" fill="none" stroke="${color}" stroke-width="${sw}"${dash}/>`);
      } else {
        parts.push(`<circle cx="${f(c.x)}" cy="${f(c.y)}" r="${f(r)}" fill="none" stroke="${color}" stroke-width="${sw}"${dash}/>`);
      }
    } else if (g.k === 'region') {
      const pts = g.pts.map((p) => toScreen(cam, vp, p.x, p.y)).map((p) => `${f(p.x)},${f(p.y)}`).join(' ');
      parts.push(`<polygon points="${pts}" fill="${color}" fill-opacity="0.1" stroke="none"/>`);
    }
  }
  for (const id of doc.order) {
    const ob = doc.objects[id];
    const g = values.get(id);
    if (!ob || !g || ob.hidden || g.k !== 'point') continue;
    const color = objectColor(t, ob.style?.color, !!ob.given);
    const p = toScreen(cam, vp, g.x, g.y);
    parts.push(`<circle cx="${f(p.x)}" cy="${f(p.y)}" r="4.2" fill="${isDraggable(ob) ? color : t.bg}" stroke="${color}" stroke-width="1.6"/>`);
    if (o.showPointLabels && ob.showLabel !== false) {
      parts.push(`<text x="${f(p.x + 8)}" y="${f(p.y - 12)}" font-family="STIX Two Text, Times New Roman, serif" font-style="italic" font-size="18" fill="${t.label}" dominant-baseline="middle">${esc(ob.name)}</text>`);
    }
  }
  const meta = `<metadata id="${KEY}">${esc(docToJSON(doc))}</metadata>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(vp.w)}" height="${f(vp.h)}" viewBox="0 0 ${f(vp.w)} ${f(vp.h)}">${meta}<rect width="100%" height="100%" fill="${t.bg}"/>${parts.join('')}</svg>`;
}

// ---- PNG tEXt chunk ---------------------------------------------------------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Insert a tEXt chunk "drawgeo" (base64url UTF-8 JSON) before IEND. */
export function embedInPng(png: Uint8Array, json: string): Uint8Array {
  const text = new TextEncoder().encode(`${KEY}\0${bytesToBase64Url(new TextEncoder().encode(json))}`);
  const type = new TextEncoder().encode('tEXt');
  const chunk = new Uint8Array(12 + text.length);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, text.length);
  chunk.set(type, 4);
  chunk.set(text, 8);
  const crcInput = new Uint8Array(4 + text.length);
  crcInput.set(type, 0);
  crcInput.set(text, 4);
  dv.setUint32(8 + text.length, crc32(crcInput));
  const iend = png.length - 12; // IEND is always the final 12 bytes
  const out = new Uint8Array(png.length + chunk.length);
  out.set(png.subarray(0, iend), 0);
  out.set(chunk, iend);
  out.set(png.subarray(iend), iend + chunk.length);
  return out;
}

export function extractFromPng(png: Uint8Array): Doc | null {
  const dv = new DataView(png.buffer, png.byteOffset, png.byteLength);
  let off = 8;
  while (off + 12 <= png.length) {
    const len = dv.getUint32(off);
    const type = String.fromCharCode(...png.subarray(off + 4, off + 8));
    if (type === 'tEXt') {
      const data = png.subarray(off + 8, off + 8 + len);
      const zero = data.indexOf(0);
      const key = new TextDecoder().decode(data.subarray(0, zero));
      if (key === KEY) {
        const b64 = new TextDecoder().decode(data.subarray(zero + 1));
        return parseDoc(new TextDecoder().decode(base64UrlToBytes(b64)));
      }
    }
    off += 12 + len;
  }
  return null;
}

export function extractFromSvg(svg: string): Doc | null {
  const m = svg.match(new RegExp(`<metadata id="${KEY}">([\\s\\S]*?)</metadata>`));
  if (!m) return null;
  const txt = m[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return parseDoc(txt);
}
