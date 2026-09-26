// UI-level tool definitions: what each tool picks next, and the hint line text.
// The geometry each tool produces lives in engine/build.ts.

import type { Id, Kind, ToolId } from '../engine/types';

export type ActionTool = 'move' | 'measureDistance' | 'measureAngle' | 'measureArea' | 'label' | 'showHide' | 'delete';
export type ToolKey = ToolId | ActionTool;

export interface Pick {
  id: Id;
  kind: Kind;
}

export interface Accept {
  kinds: Kind[];
  create: boolean; // clicking empty space / a curve may create a point
}

export type Group = 'main' | 'construct' | 'polygons' | 'circles' | 'transform' | 'measure' | 'edit' | 'free';

export interface ToolUI {
  key: ToolKey;
  label: string;
  shortcut?: string;
  group: Group;
  role: 'construct' | 'measure' | 'action' | 'nav';
  next(picks: Pick[]): Accept | null;
  hint(picks: Pick[]): string;
  number?: { label: string; def: number; integer?: boolean; unit?: string };
  keywords?: string;
}

const P: Accept = { kinds: ['point'], create: true };
const PX: Accept = { kinds: ['point'], create: false }; // existing points only
const SRC: Accept = { kinds: ['point', 'line', 'circle'], create: false };
const ANY: Accept = { kinds: ['point', 'line', 'circle', 'region'], create: false };

const seq =
  (...accepts: Accept[]) =>
  (picks: Pick[]) =>
    accepts[picks.length] ?? null;

const hints =
  (...h: string[]) =>
  (picks: Pick[]) =>
    h[Math.min(picks.length, h.length - 1)];

/** Line + point in either order (Perpendicular, Parallel). */
function lineAndPoint(picks: Pick[]): Accept | null {
  const hasLine = picks.some((p) => p.kind === 'line');
  const hasPoint = picks.some((p) => p.kind === 'point');
  if (hasLine && hasPoint) return null;
  if (hasLine) return P;
  if (hasPoint) return { kinds: ['line'], create: false };
  return { kinds: ['line', 'point'], create: true };
}

function pointAndCircle(picks: Pick[]): Accept | null {
  const hasC = picks.some((p) => p.kind === 'circle');
  const hasP = picks.some((p) => p.kind === 'point');
  if (hasC && hasP) return null;
  if (hasC) return P;
  if (hasP) return { kinds: ['circle'], create: false };
  return { kinds: ['circle', 'point'], create: true };
}

const t = (x: ToolUI) => x;

export const TOOLS: ToolUI[] = [
  // ---- Tier A: Euclidea's bar, in Euclidea's order ----
  t({ key: 'move', label: 'Move', shortcut: 'V', group: 'main', role: 'nav', next: () => null, hint: () => 'Drag a point to move it · drag the canvas to pan · tap an object to select it' }),
  t({ key: 'point', label: 'Point', shortcut: 'P', group: 'main', role: 'construct', next: seq(P), hint: () => 'Point: tap anywhere, on a line or circle, or on an intersection' }),
  t({ key: 'line', label: 'Line', shortcut: 'L', group: 'main', role: 'construct', next: seq(P, P), hint: hints('Line: pick the first point', 'Line: pick the second point') }),
  t({ key: 'circle', label: 'Circle', shortcut: 'C', group: 'main', role: 'construct', next: seq(P, P), hint: hints('Circle: pick the center', 'Circle: pick a point on the circle') }),
  t({ key: 'perpBisector', label: 'Perpendicular bisector', shortcut: 'B', group: 'main', role: 'construct', next: seq(P, P), hint: hints('Perpendicular bisector: pick the first point', 'Perpendicular bisector: pick the second point') }),
  t({
    key: 'perpendicular',
    label: 'Perpendicular',
    shortcut: 'T',
    group: 'main',
   
    role: 'construct',
    next: lineAndPoint,
    hint: (p) => (p.length === 0 ? 'Perpendicular: pick a line and a point' : p[0].kind === 'line' ? 'Perpendicular: pick the point it passes through' : 'Perpendicular: pick the line'),
  }),
  t({ key: 'angleBisector', label: 'Angle bisector', shortcut: 'G', group: 'main', role: 'construct', next: seq(P, P, P), hint: hints('Angle bisector: pick a point on the first side', 'Angle bisector: pick the vertex', 'Angle bisector: pick a point on the second side') }),
  t({
    key: 'parallel',
    label: 'Parallel',
    shortcut: 'A',
    group: 'main',
   
    role: 'construct',
    next: lineAndPoint,
    hint: (p) => (p.length === 0 ? 'Parallel: pick a line and a point' : p[0].kind === 'line' ? 'Parallel: pick the point it passes through' : 'Parallel: pick the line'),
  }),
  t({
    key: 'compass',
    label: 'Compass',
    shortcut: 'K',
    group: 'main',
   
    role: 'construct',
    next: (p) => {
      if (p.length === 0) return { kinds: ['circle', 'point'], create: true };
      if (p[0].kind === 'circle') return p.length === 1 ? P : null;
      return p.length < 3 ? P : null;
    },
    hint: (p) =>
      p.length === 0 ? 'Compass: pick two points for the radius (or a circle)' : p[0].kind === 'circle' || p.length === 2 ? 'Compass: pick the center' : 'Compass: pick the second point of the radius',
  }),
  t({
    key: 'intersect',
    label: 'Intersect',
    shortcut: 'X',
    group: 'main',
   
    role: 'construct',
    next: seq({ kinds: ['line', 'circle'], create: false }, { kinds: ['line', 'circle'], create: false }),
    hint: hints('Intersect: pick two lines or circles (or tap a crossing)', 'Intersect: pick the second line or circle'),
  }),

  // ---- Tier B: More → construct ----
  t({ key: 'segment', label: 'Segment', shortcut: 'S', group: 'construct', role: 'construct', next: seq(P, P), hint: hints('Segment: pick the first endpoint', 'Segment: pick the second endpoint') }),
  t({ key: 'ray', label: 'Ray', shortcut: 'Y', group: 'construct', role: 'construct', next: seq(P, P), hint: hints('Ray: pick the start point', 'Ray: pick a point it passes through') }),
  t({ key: 'vector', label: 'Vector', group: 'construct', role: 'construct', next: seq(P, P), hint: hints('Vector: pick the start', 'Vector: pick the end') }),
  t({
    key: 'midpoint',
    label: 'Midpoint or center',
    group: 'construct',
   
    role: 'construct',
    next: (p) => (p.length === 0 ? { kinds: ['point', 'line', 'circle'], create: true } : p[0].kind === 'point' && p.length === 1 ? P : null),
    hint: hints('Midpoint: pick two points, a segment, or a circle (its center)', 'Midpoint: pick the second point'),
    keywords: 'center centre',
  }),
  t({
    key: 'tangents',
    label: 'Tangents',
    group: 'construct',
   
    role: 'construct',
    next: pointAndCircle,
    hint: (p) => (p.length === 0 ? 'Tangents: pick a point and a circle' : p[0].kind === 'circle' ? 'Tangents: pick the point' : 'Tangents: pick the circle'),
  }),
  // polygons
  t({
    key: 'polygon',
    label: 'Polygon',
    group: 'polygons',
   
    role: 'construct',
    next: (p) => (p.length >= 4 && p[p.length - 1].id === p[0].id ? null : P),
    hint: (p) => (p.length < 3 ? 'Polygon: pick the vertices' : 'Polygon: pick the next vertex, or tap the first one (Enter) to close'),
  }),
  t({ key: 'regularPolygon', label: 'Regular polygon', group: 'polygons', role: 'construct', next: seq(P, P), hint: hints('Regular polygon: pick the first vertex', 'Regular polygon: pick the second vertex'), number: { label: 'Number of vertices', def: 5, integer: true } }),
  // circles
  t({ key: 'semicircle', label: 'Semicircle', group: 'circles', role: 'construct', next: seq(P, P), hint: hints('Semicircle: pick one end of the diameter', 'Semicircle: pick the other end') }),
  t({ key: 'sector', label: 'Circular sector', group: 'circles', role: 'construct', next: seq(P, P, P), hint: hints('Sector: pick the center', 'Sector: pick the start of the arc', 'Sector: pick where the arc ends (counterclockwise)') }),
  // transforms
  t({ key: 'reflectLine', label: 'Reflect about line', group: 'transform', role: 'construct', next: seq(SRC, { kinds: ['line'], create: false }), hint: hints('Reflect: pick the object to reflect', 'Reflect: pick the mirror line') }),
  t({ key: 'reflectPoint', label: 'Reflect about point', group: 'transform', role: 'construct', next: seq(SRC, P), hint: hints('Reflect: pick the object to reflect', 'Reflect: pick the center point') }),
  t({ key: 'translate', label: 'Translate by vector', group: 'transform', role: 'construct', next: seq(SRC, P, P), hint: hints('Translate: pick the object', 'Translate: pick where the vector starts', 'Translate: pick where the vector ends') }),
  t({ key: 'rotate', label: 'Rotate around point', group: 'transform', role: 'construct', next: seq(SRC, P, P, P, P), hint: hints('Rotate: pick the object', 'Rotate: pick the center', 'Rotate: angle — pick a point on its first side', 'Rotate: angle — pick its vertex', 'Rotate: angle — pick a point on its second side') }),
  t({ key: 'dilate', label: 'Dilate from point', group: 'transform', role: 'construct', next: seq(SRC, P, P, P), hint: hints('Dilate: pick the object', 'Dilate: pick the center', 'Dilate: ratio |center→B| / |center→A| — pick A', 'Dilate: pick B') }),
  // Tier D: free-form (typed numbers)
  t({ key: 'segmentLength', label: 'Segment with length', group: 'free', role: 'construct', next: seq(P), hint: () => 'Segment with length: pick the start point', number: { label: 'Length', def: 2, unit: 'units' } }),
  t({ key: 'circleRadius', label: 'Circle: center & radius', group: 'free', role: 'construct', next: seq(P), hint: () => 'Circle with radius: pick the center', number: { label: 'Radius', def: 1, unit: 'units' } }),
  t({ key: 'angleSize', label: 'Angle with given size', group: 'free', role: 'construct', next: seq(P, P), hint: hints('Angle with size: pick a point on the first side', 'Angle with size: pick the vertex'), number: { label: 'Angle (degrees, counterclockwise)', def: 45, unit: '°' } }),
  t({ key: 'rotateBy', label: 'Rotate by angle', group: 'free', role: 'construct', next: seq(SRC, P), hint: hints('Rotate by angle: pick the object', 'Rotate by angle: pick the center'), number: { label: 'Angle (degrees, counterclockwise)', def: 90, unit: '°' } }),
  t({ key: 'dilateBy', label: 'Dilate by factor', group: 'free', role: 'construct', next: seq(SRC, P), hint: hints('Dilate by factor: pick the object', 'Dilate by factor: pick the center'), number: { label: 'Factor', def: 2 } }),
  // measure (never counted)
  t({
    key: 'measureDistance',
    label: 'Distance or length',
    group: 'measure',
   
    role: 'measure',
    next: (p) => (p.length === 0 ? { kinds: ['point', 'line'], create: false } : p[0].kind === 'point' && p.length === 1 ? PX : null),
    hint: hints('Distance: pick two points or a segment', 'Distance: pick the second point'),
    keywords: 'length measure',
  }),
  t({ key: 'measureAngle', label: 'Angle', group: 'measure', role: 'measure', next: seq(PX, PX, PX), hint: hints('Angle: pick a point on the first side', 'Angle: pick the vertex', 'Angle: pick a point on the second side'), keywords: 'measure degrees' }),
  t({ key: 'measureArea', label: 'Area', group: 'measure', role: 'measure', next: seq({ kinds: ['region', 'circle'], create: false }), hint: () => 'Area: pick a polygon or a circle', keywords: 'measure' }),
  // edit
  t({ key: 'label', label: 'Name / label', group: 'edit', role: 'action', next: seq(ANY), hint: () => 'Label: pick an object to name it', keywords: 'rename name show hide label' }),
  t({ key: 'showHide', label: 'Show / hide object', group: 'edit', role: 'action', next: seq(ANY), hint: () => 'Show / hide: tap objects to hide them (hidden ones show faintly)', keywords: 'visibility' }),
  t({ key: 'delete', label: 'Delete', group: 'edit', role: 'action', next: seq(ANY), hint: () => 'Delete: tap an object (things built on it go too)', keywords: 'remove erase' }),
];

export const TOOL_BY_KEY: Record<ToolKey, ToolUI> = Object.fromEntries(TOOLS.map((x) => [x.key, x])) as Record<ToolKey, ToolUI>;

export const MAIN_BAR: ToolKey[] = ['move', 'point', 'line', 'circle', 'perpBisector', 'perpendicular', 'angleBisector', 'parallel', 'compass', 'intersect'];

export const MORE_GROUPS: Array<{ group: Group; title: string }> = [
  { group: 'construct', title: 'Construct' },
  { group: 'polygons', title: 'Polygons' },
  { group: 'circles', title: 'Circles' },
  { group: 'transform', title: 'Transform' },
  { group: 'measure', title: 'Measure' },
  { group: 'edit', title: 'Edit' },
  { group: 'free', title: 'Typed numbers' },
];

export const MAX_PINS = 2;

/** Tools whose point inputs must all be different (a line through A and A is meaningless). Transforms and Compass may reuse points. */
export const DISTINCT_POINTS = new Set<ToolKey>([
  'line',
  'circle',
  'perpBisector',
  'angleBisector',
  'segment',
  'ray',
  'vector',
  'midpoint',
  'semicircle',
  'regularPolygon',
  'measureDistance',
  'measureAngle',
]);

/** Strict mode (pure Euclid): the only construction tools allowed. */
export const STRICT_TOOLS: ToolKey[] = ['point', 'line', 'circle', 'intersect'];
