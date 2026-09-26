import type { Vec } from './types';

export const v = (x: number, y: number): Vec => ({ x, y });
export const add = (a: Vec, b: Vec): Vec => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vec, b: Vec): Vec => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (a: Vec, k: number): Vec => ({ x: a.x * k, y: a.y * k });
export const dot = (a: Vec, b: Vec): number => a.x * b.x + a.y * b.y;
export const cross = (a: Vec, b: Vec): number => a.x * b.y - a.y * b.x;
export const len = (a: Vec): number => Math.hypot(a.x, a.y);
export const dist = (a: Vec, b: Vec): number => Math.hypot(a.x - b.x, a.y - b.y);
export const mid = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
/** Rotate 90° counterclockwise (y-up). */
export const perp = (a: Vec): Vec => ({ x: -a.y, y: a.x });
export const rotate = (a: Vec, ang: number): Vec => {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return { x: a.x * c - a.y * s, y: a.x * s + a.y * c };
};
export const norm = (a: Vec): Vec | null => {
  const l = len(a);
  return l > 0 ? { x: a.x / l, y: a.y / l } : null;
};
export const angleOf = (a: Vec): number => Math.atan2(a.y, a.x);

const TAU = Math.PI * 2;
/** Normalize an angle into [0, 2π). */
export const normAngle = (a: number): number => {
  const r = a % TAU;
  return r < 0 ? r + TAU : r;
};
