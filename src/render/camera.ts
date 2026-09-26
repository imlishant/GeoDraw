// Bounded camera (PLAN.md §4.5). World is y-up; screen is y-down.

import type { Vec } from '../engine/types';

export interface Camera {
  cx: number; // world point at the screen center
  cy: number;
  zoom: number; // screen px per world unit
}

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 20;
export const WHEEL_STEP = 1.1;

export interface Viewport {
  w: number;
  h: number;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));

export function toScreen(c: Camera, vp: Viewport, x: number, y: number): Vec {
  return { x: (x - c.cx) * c.zoom + vp.w / 2, y: -(y - c.cy) * c.zoom + vp.h / 2 };
}

export function toWorld(c: Camera, vp: Viewport, sx: number, sy: number): Vec {
  return { x: (sx - vp.w / 2) / c.zoom + c.cx, y: -(sy - vp.h / 2) / c.zoom + c.cy };
}

/** Zoom by `factor`, keeping the world point under (sx, sy) fixed. */
export function zoomAt(c: Camera, vp: Viewport, sx: number, sy: number, factor: number): Camera {
  const zoom = clampZoom(c.zoom * factor);
  const before = toWorld(c, vp, sx, sy);
  const next = { ...c, zoom };
  const after = toWorld(next, vp, sx, sy);
  return { zoom, cx: c.cx + before.x - after.x, cy: c.cy + before.y - after.y };
}

export function panBy(c: Camera, dxScreen: number, dyScreen: number): Camera {
  return { ...c, cx: c.cx - dxScreen / c.zoom, cy: c.cy + dyScreen / c.zoom };
}

/** Keep the view center within ~2 screen widths of the construction. */
export function clampPan(c: Camera, vp: Viewport, box: BBox | null): Camera {
  const b = box ?? { minX: 0, minY: 0, maxX: 0, maxY: 0 };
  const mx = (2 * vp.w) / c.zoom;
  const my = (2 * vp.h) / c.zoom;
  return {
    ...c,
    cx: Math.min(b.maxX + mx, Math.max(b.minX - mx, c.cx)),
    cy: Math.min(b.maxY + my, Math.max(b.minY - my, c.cy)),
  };
}

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * Frame `box` inside the part of the screen not covered by UI (insets), using at
 * most `fill` of that area so there is room to construct around the figure.
 */
export function fit(box: BBox | null, vp: Viewport, insets: Insets | number = 80, fill = 1, maxZoom = 2): Camera {
  const ins = typeof insets === 'number' ? { top: insets, right: insets, bottom: insets, left: insets } : insets;
  const availW = Math.max(vp.w - ins.left - ins.right, 80);
  const availH = Math.max(vp.h - ins.top - ins.bottom, 80);
  if (!box) return { cx: 0, cy: 0, zoom: 1 };
  const w = Math.max(box.maxX - box.minX, 1);
  const h = Math.max(box.maxY - box.minY, 1);
  const zoom = clampZoom(Math.min((availW * fill) / w, (availH * fill) / h, maxZoom));
  // center of the free area, expressed as an offset from the screen center
  const offX = (ins.left - ins.right) / 2;
  const offY = (ins.top - ins.bottom) / 2;
  return { cx: (box.minX + box.maxX) / 2 - offX / zoom, cy: (box.minY + box.maxY) / 2 + offY / zoom, zoom };
}
