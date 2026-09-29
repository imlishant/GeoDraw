// PNG export with the construction embedded (Excalidraw's trick): opening an exported
// image in DrawGeo restores the full construction and its steps. Always light colors
// on white, whatever theme is on screen (a dark-theme figure on white is unreadable).

import type { Doc, Values } from '../engine/types';
import { base64UrlToBytes, bytesToBase64Url, docToJSON, parseDoc } from '../engine/serialize';
import { boundingBox } from './hit';
import { fit, type Viewport } from './camera';
import { drawConstruction, type CanvasMeasure } from './renderer';
import { LIGHT, type Theme } from './theme';

const KEY = 'drawgeo';

export interface ExportOpts {
  showPointLabels: boolean;
  measures: CanvasMeasure[];
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

const PRINT: Theme = { ...LIGHT, bg: '#ffffff' };

export async function exportPNG(doc: Doc, values: Values, o: ExportOpts): Promise<Blob> {
  const { vp, cam } = exportFrame(doc, values);
  const scale = 2;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(vp.w * scale);
  canvas.height = Math.round(vp.h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const theme = PRINT;
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
