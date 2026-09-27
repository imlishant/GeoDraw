// Two stacked canvases (Excalidraw's pattern): the scene layer redraws when the
// construction or camera changes; the overlay (hover, snap, previews) redraws on
// pointer moves without touching the scene. All sizes are in screen pixels, so
// strokes and points look the same at every zoom.

import type { Doc, GCircle, Geo, GeoObject, GLine, Id, Values, Vec } from '../engine/types';
import { toScreen, type Camera, type Viewport } from './camera';
import { objectColor, type Theme } from './theme';

export const LABEL_FONT = 'italic 18px "STIX Two Text", "Times New Roman", serif';
export const UI_FONT = '600 12px Nunito, system-ui, sans-serif';

export interface CanvasMeasure {
  kind: 'distance' | 'angle' | 'area';
  refs: Vec[]; // distance: [a, b]; angle: [a, v, b]; area: [anchor]
  text: string;
}

export interface SceneInput {
  doc: Doc;
  values: Values;
  cam: Camera;
  theme: Theme;
  visible: (o: GeoObject) => boolean;
  faint: (o: GeoObject) => boolean;
  highlight: Set<Id>;
  showPointLabels: boolean;
  measures: CanvasMeasure[];
  coarse: boolean; // touch-first device: slightly larger points
}

export interface OverlayInput {
  cam: Camera;
  theme: Theme;
  ghosts: Geo[]; // preview of the tool result
  pending: Vec[]; // points created during the current tool session
  snap: (Vec & { kind: 'point' | 'int' | 'on' | 'free' | 'curve' | 'region' }) | null;
  candidates: Vec[]; // nearby virtual intersections
  box: { x0: number; y0: number; x1: number; y1: number } | null;
  coarse: boolean;
}

export class Renderer {
  private sctx: CanvasRenderingContext2D;
  private octx: CanvasRenderingContext2D;
  vp: Viewport = { w: 1, h: 1 };
  private dpr = 1;

  constructor(
    private scene: HTMLCanvasElement,
    private overlay: HTMLCanvasElement,
  ) {
    this.sctx = scene.getContext('2d')!;
    this.octx = overlay.getContext('2d')!;
  }

  resize(w: number, h: number, dpr: number) {
    this.vp = { w, h };
    this.dpr = dpr;
    for (const c of [this.scene, this.overlay]) {
      c.width = Math.max(1, Math.round(w * dpr));
      c.height = Math.max(1, Math.round(h * dpr));
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
    }
  }

  drawScene(s: SceneInput) {
    const ctx = this.sctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = s.theme.bg;
    ctx.fillRect(0, 0, this.vp.w, this.vp.h);
    drawConstruction(ctx, this.vp, s);
  }

  drawOverlay(o: OverlayInput) {
    const ctx = this.octx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.vp.w, this.vp.h);
    const t = o.theme;
    ctx.save();
    ctx.strokeStyle = t.accent;
    ctx.fillStyle = t.accent;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 5]);
    ctx.globalAlpha = 0.85;
    for (const g of o.ghosts) {
      if (g.k === 'line') strokeLine(ctx, this.vp, o.cam, g);
      else if (g.k === 'circle') strokeCircle(ctx, this.vp, o.cam, g);
    }
    ctx.setLineDash([]);
    for (const g of o.ghosts) if (g.k === 'point') drawPointShape(ctx, toScreen(o.cam, this.vp, g.x, g.y), false, t.accent, t.bg, o.coarse);
    ctx.globalAlpha = 1;
    for (const p of o.pending) drawPointShape(ctx, toScreen(o.cam, this.vp, p.x, p.y), true, t.accent, t.bg, o.coarse);
    ctx.globalAlpha = 0.7;
    for (const c of o.candidates) {
      const s = toScreen(o.cam, this.vp, c.x, c.y);
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    if (o.snap && o.snap.kind !== 'free' && o.snap.kind !== 'curve' && o.snap.kind !== 'region') {
      const s = toScreen(o.cam, this.vp, o.snap.x, o.snap.y);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, o.coarse ? 13 : 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (o.box) {
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1;
      ctx.globalAlpha = 0.9;
      const { x0, y0, x1, y1 } = o.box;
      ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      ctx.globalAlpha = 0.06;
      ctx.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
    }
    ctx.restore();
  }
}

// ---- Shared drawing (also used for PNG export) ------------------------------

export function drawConstruction(ctx: CanvasRenderingContext2D, vp: Viewport, s: SceneInput) {
  const t = s.theme;
  const items: Array<[GeoObject, Geo]> = [];
  for (const id of s.doc.order) {
    const o = s.doc.objects[id];
    const g = s.values.get(id);
    if (!o || !g) continue;
    if (!s.visible(o)) continue;
    items.push([o, g]);
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // 1. regions (fills)
  for (const [o, g] of items) {
    if (g.k !== 'region' || g.pts.length < 3) continue;
    ctx.save();
    ctx.globalAlpha = s.faint(o) ? 0.04 : 0.1;
    ctx.fillStyle = s.highlight.has(o.id) ? t.accent : objectColor(t, o.style?.color);
    ctx.beginPath();
    g.pts.forEach((p, i) => {
      const q = toScreen(s.cam, vp, p.x, p.y);
      if (i === 0) ctx.moveTo(q.x, q.y);
      else ctx.lineTo(q.x, q.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // 2. lines and circles
  for (const [o, g] of items) {
    if (g.k !== 'line' && g.k !== 'circle') continue;
    const hi = s.highlight.has(o.id);
    ctx.save();
    ctx.strokeStyle = hi ? t.accent : objectColor(t, o.style?.color);
    ctx.lineWidth = 1.4 + (hi ? 1.2 : 0);
    if (o.style?.dashed) ctx.setLineDash([7, 5]);
    if (s.faint(o)) ctx.globalAlpha = 0.3;
    if (g.k === 'line') {
      const seg = strokeLine(ctx, vp, s.cam, g);
      if (seg && o.kind === 'line' && o.style?.arrow && Number.isFinite(g.t1)) {
        const end = toScreen(s.cam, vp, g.px + g.dx * g.t1, g.py + g.dy * g.t1);
        drawArrowHead(ctx, end, -g.dx, g.dy);
      }
    } else {
      if (o.style?.sector && g.a0 !== undefined && g.a1 !== undefined) {
        const c = toScreen(s.cam, vp, g.cx, g.cy);
        const r = g.r * s.cam.zoom;
        ctx.save();
        ctx.globalAlpha *= 0.1;
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.arc(c.x, c.y, r, -g.a0, -g.a1, true);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.beginPath();
        ctx.moveTo(c.x + r * Math.cos(-g.a0), c.y + r * Math.sin(-g.a0));
        ctx.lineTo(c.x, c.y);
        ctx.lineTo(c.x + r * Math.cos(-g.a1), c.y + r * Math.sin(-g.a1));
        ctx.stroke();
      }
      strokeCircle(ctx, vp, s.cam, g);
    }
    ctx.restore();
  }

  // 3. measures drawn on the figure
  drawMeasures(ctx, vp, s);

  // 4. points on top
  for (const [o, g] of items) {
    if (g.k !== 'point') continue;
    const hi = s.highlight.has(o.id);
    const p = toScreen(s.cam, vp, g.x, g.y);
    if (p.x < -20 || p.y < -20 || p.x > vp.w + 20 || p.y > vp.h + 20) continue;
    ctx.save();
    if (s.faint(o)) ctx.globalAlpha = 0.35;
    const color = hi ? t.accent : objectColor(t, o.style?.color);
    drawPointShape(ctx, p, isDraggable(o), color, t.bg, s.coarse);
    ctx.restore();
  }

  // 5. labels
  ctx.save();
  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'middle';
  for (const [o, g] of items) {
    const show = o.kind === 'point' ? s.showPointLabels && o.showLabel !== false : !!o.showLabel;
    if (!show || s.faint(o)) continue;
    const at = labelAnchor(g, s.cam, vp);
    if (!at) continue;
    ctx.lineWidth = 4;
    ctx.strokeStyle = t.bg;
    ctx.fillStyle = s.highlight.has(o.id) ? t.accent : t.label;
    ctx.strokeText(o.name, at.x, at.y);
    ctx.fillText(o.name, at.x, at.y);
  }
  ctx.restore();
}

/** Filled = you can drag it; hollow ring = derived (PLAN.md §4.4). */
export function isDraggable(o: GeoObject): boolean {
  return o.kind === 'point' && (o.def.t === 'free' || o.def.t === 'on' || o.def.t === 'polar');
}

function drawPointShape(ctx: CanvasRenderingContext2D, p: Vec, filled: boolean, color: string, bg: string, coarse: boolean) {
  const r = coarse ? 5 : 4.2;
  ctx.beginPath();
  ctx.arc(p.x, p.y, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = bg; // halo keeps points readable on top of lines
  ctx.fill();
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fillStyle = filled ? color : bg;
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function drawArrowHead(ctx: CanvasRenderingContext2D, tip: Vec, bx: number, by: number) {
  // (bx, by) is the screen direction pointing back along the segment
  const l = Math.hypot(bx, by) || 1;
  const ux = bx / l;
  const uy = by / l;
  const size = 11;
  const w = size * 0.45;
  ctx.beginPath();
  ctx.moveTo(tip.x + ux * size - uy * w, tip.y + uy * size + ux * w);
  ctx.lineTo(tip.x, tip.y);
  ctx.lineTo(tip.x + ux * size + uy * w, tip.y + uy * size - ux * w);
  ctx.stroke();
}

/** Clip a (possibly infinite) line to the viewport and stroke it. Returns false if invisible. */
export function strokeLine(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, g: GLine): boolean {
  const seg = clipLine(g, cam, vp, 40);
  if (!seg) return false;
  const a = toScreen(cam, vp, seg[0].x, seg[0].y);
  const b = toScreen(cam, vp, seg[1].x, seg[1].y);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  return true;
}

export function clipLine(g: GLine, cam: Camera, vp: Viewport, padPx: number): [Vec, Vec] | null {
  const hw = vp.w / 2 / cam.zoom + padPx / cam.zoom;
  const hh = vp.h / 2 / cam.zoom + padPx / cam.zoom;
  let lo = g.t0;
  let hi = g.t1;
  const slab = (p: number, d: number, min: number, max: number): boolean => {
    if (Math.abs(d) < 1e-15) return p >= min && p <= max;
    const ta = (min - p) / d;
    const tb = (max - p) / d;
    lo = Math.max(lo, Math.min(ta, tb));
    hi = Math.min(hi, Math.max(ta, tb));
    return true;
  };
  if (!slab(g.px, g.dx, cam.cx - hw, cam.cx + hw)) return null;
  if (!slab(g.py, g.dy, cam.cy - hh, cam.cy + hh)) return null;
  if (!(lo <= hi) || !Number.isFinite(lo) || !Number.isFinite(hi)) return null;
  return [
    { x: g.px + g.dx * lo, y: g.py + g.dy * lo },
    { x: g.px + g.dx * hi, y: g.py + g.dy * hi },
  ];
}

export function strokeCircle(ctx: CanvasRenderingContext2D, vp: Viewport, cam: Camera, g: GCircle) {
  const c = toScreen(cam, vp, g.cx, g.cy);
  const r = g.r * cam.zoom;
  // cull: fully outside, or the view is entirely inside the circle
  const nx = Math.max(0, Math.min(vp.w, c.x));
  const ny = Math.max(0, Math.min(vp.h, c.y));
  if (Math.hypot(nx - c.x, ny - c.y) > r + 4) return;
  const far = Math.max(Math.hypot(c.x, c.y), Math.hypot(c.x - vp.w, c.y), Math.hypot(c.x, c.y - vp.h), Math.hypot(c.x - vp.w, c.y - vp.h));
  if (far < r - 4) return;
  ctx.beginPath();
  if (g.a0 !== undefined && g.a1 !== undefined) ctx.arc(c.x, c.y, r, -g.a0, -g.a1, true);
  else ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.stroke();
}

function labelAnchor(g: Geo, cam: Camera, vp: Viewport): Vec | null {
  if (g.k === 'point') {
    const p = toScreen(cam, vp, g.x, g.y);
    return { x: p.x + 8, y: p.y - 12 };
  }
  if (g.k === 'line') {
    const seg = clipLine(g, cam, vp, -30);
    if (!seg) return null;
    const m = toScreen(cam, vp, (seg[0].x + seg[1].x) / 2, (seg[0].y + seg[1].y) / 2);
    return { x: m.x + 6, y: m.y - 12 };
  }
  if (g.k === 'circle') {
    const a = g.a0 !== undefined && g.a1 !== undefined ? (g.a0 + g.a1) / 2 : Math.PI / 4;
    const p = toScreen(cam, vp, g.cx + g.r * Math.cos(a), g.cy + g.r * Math.sin(a));
    return { x: p.x + 6, y: p.y - 10 };
  }
  if (g.pts.length) {
    const cx = g.pts.reduce((s, p) => s + p.x, 0) / g.pts.length;
    const cy = g.pts.reduce((s, p) => s + p.y, 0) / g.pts.length;
    return toScreen(cam, vp, cx, cy);
  }
  return null;
}

function drawMeasures(ctx: CanvasRenderingContext2D, vp: Viewport, s: SceneInput) {
  if (!s.measures.length) return;
  const t = s.theme;
  ctx.save();
  ctx.font = UI_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const m of s.measures) {
    let at: Vec;
    if (m.kind === 'distance') {
      const a = toScreen(s.cam, vp, m.refs[0].x, m.refs[0].y);
      const b = toScreen(s.cam, vp, m.refs[1].x, m.refs[1].y);
      const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      at = { x: (a.x + b.x) / 2 - ((b.y - a.y) / len) * 14, y: (a.y + b.y) / 2 + ((b.x - a.x) / len) * 14 };
    } else if (m.kind === 'angle') {
      const a = toScreen(s.cam, vp, m.refs[0].x, m.refs[0].y);
      const v = toScreen(s.cam, vp, m.refs[1].x, m.refs[1].y);
      const b = toScreen(s.cam, vp, m.refs[2].x, m.refs[2].y);
      const a1 = Math.atan2(a.y - v.y, a.x - v.x);
      const a2 = Math.atan2(b.y - v.y, b.x - v.x);
      let d = a2 - a1;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      ctx.strokeStyle = t.measure;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(v.x, v.y, 20, a1, a1 + d, d < 0);
      ctx.stroke();
      const mid = a1 + d / 2;
      at = { x: v.x + Math.cos(mid) * 38, y: v.y + Math.sin(mid) * 38 };
    } else {
      at = toScreen(s.cam, vp, m.refs[0].x, m.refs[0].y);
    }
    ctx.lineWidth = 4;
    ctx.strokeStyle = t.bg;
    ctx.fillStyle = t.measure;
    ctx.strokeText(m.text, at.x, at.y);
    ctx.fillText(m.text, at.x, at.y);
  }
  ctx.restore();
}
