// Core data model. The document IS the list of steps; geometry is always derived.
// World coordinates are y-up (math convention); the renderer flips y.

export type Id = string;
export type Kind = 'point' | 'line' | 'circle' | 'region';

export interface Vec {
  x: number;
  y: number;
}

// ---- Similarity maps used by transform tools --------------------------------

export type MapDef =
  | { t: 'reflL'; l: Id }
  | { t: 'reflP'; c: Id }
  | { t: 'trans'; a: Id; b: Id }
  | { t: 'rot'; c: Id; a: Id; v: Id; b: Id } // angle from VA to VB
  | { t: 'rotNum'; c: Id; deg: number } // Tier D
  | { t: 'dil'; c: Id; a: Id; b: Id } // ratio |CB| / |CA|
  | { t: 'dilNum'; c: Id; k: number }; // Tier D

// ---- Definitions: how each object was built ---------------------------------

export type PointDef =
  | { t: 'free'; x: number; y: number }
  | { t: 'on'; of: Id; u: number } // param along a line (in units of its scale) or angle on a circle
  | { t: 'int'; a: Id; b: Id; i: number } // i-th root, ordered by parent orientation
  | { t: 'mid'; a: Id; b: Id }
  | { t: 'center'; c: Id }
  | { t: 'polar'; a: Id; len: number; ang: number } // Tier D: fixed distance from A
  | { t: 'rotNum'; p: Id; v: Id; deg: number } // Tier D: angle with given size
  | { t: 'regVertex'; a: Id; b: Id; n: number; k: number }
  | { t: 'xf'; src: Id; map: MapDef };

export type LineDef =
  | { t: 'thru'; a: Id; b: Id }
  | { t: 'perpBis'; a: Id; b: Id }
  | { t: 'perp'; l: Id; p: Id }
  | { t: 'par'; l: Id; p: Id }
  | { t: 'angBis'; a: Id; v: Id; b: Id }
  | { t: 'tangent'; p: Id; c: Id; i: number }
  | { t: 'xf'; src: Id; map: MapDef };

export type CircleDef =
  | { t: 'ctr'; c: Id; p: Id }
  | { t: 'compass'; a: Id; b: Id; c: Id }
  | { t: 'compassC'; r: Id; c: Id } // radius taken from an existing circle
  | { t: 'radius'; c: Id; r: number } // Tier D
  | { t: 'semi'; a: Id; b: Id } // arc: semicircle on diameter AB
  | { t: 'sector'; c: Id; a: Id; b: Id } // arc from A to B around C
  | { t: 'xf'; src: Id; map: MapDef };

export type RegionDef = { t: 'poly'; pts: Id[] };

export type Clip = 'line' | 'segment' | 'ray';

export type ColorToken = 'default' | 'blue' | 'red' | 'green' | 'orange';

export interface Style {
  color?: ColorToken;
  dashed?: boolean;
  arrow?: boolean; // vectors
  sector?: boolean; // draw radii + fill for sector arcs
}

interface Base {
  id: Id;
  name: string; // auto-generated, user-editable
  showLabel?: boolean;
  hidden?: boolean;
  style?: Style;
}

export interface PointObj extends Base {
  kind: 'point';
  def: PointDef;
}
export interface LineObj extends Base {
  kind: 'line';
  def: LineDef;
  clip: Clip;
}
export interface CircleObj extends Base {
  kind: 'circle';
  def: CircleDef;
}
export interface RegionObj extends Base {
  kind: 'region';
  def: RegionDef;
}

export type GeoObject = PointObj | LineObj | CircleObj | RegionObj;

// ---- Computed geometry ------------------------------------------------------

export interface GPoint {
  k: 'point';
  x: number;
  y: number;
}

/** Line: origin p, unit direction d, param scale s (for on-object points), clip range [t0, t1] in world units along d. */
export interface GLine {
  k: 'line';
  px: number;
  py: number;
  dx: number;
  dy: number;
  s: number;
  t0: number;
  t1: number;
}

/** Circle, optionally an arc from angle a0 sweeping counterclockwise to a1 (a1 > a0, a1 - a0 <= 2π). */
export interface GCircle {
  k: 'circle';
  cx: number;
  cy: number;
  r: number;
  a0?: number;
  a1?: number;
}

export interface GRegion {
  k: 'region';
  pts: Vec[];
}

export type Geo = GPoint | GLine | GCircle | GRegion;
export type Curve = GLine | GCircle;

/** Evaluated values: null = currently undefined (e.g. circles that no longer meet). */
export type Values = Map<Id, Geo | null>;

// ---- Steps, measures, document ---------------------------------------------

export type ToolId =
  | 'point'
  | 'line'
  | 'circle'
  | 'perpBisector'
  | 'perpendicular'
  | 'angleBisector'
  | 'parallel'
  | 'compass'
  | 'intersect'
  | 'segment'
  | 'ray'
  | 'vector'
  | 'midpoint'
  | 'tangents'
  | 'polygon'
  | 'semicircle'
  | 'sector'
  | 'reflectLine'
  | 'reflectPoint'
  | 'translate'
  | 'rotate'
  | 'dilate'
  | 'segmentLength'
  | 'circleRadius'
  | 'angleSize'
  | 'rotateBy'
  | 'dilateBy'
  | 'regularPolygon';

export interface Step {
  id: Id;
  tool: ToolId;
  inputs: Id[];
  outputs: Id[]; // includes points created implicitly while using the tool
  note?: string;
}

export type Measure =
  | { id: Id; t: 'distance'; a: Id; b: Id }
  | { id: Id; t: 'angle'; a: Id; v: Id; b: Id }
  | { id: Id; t: 'area'; of: Id };

export interface Doc {
  schemaVersion: 1;
  id: Id;
  title: string;
  objects: Record<Id, GeoObject>;
  order: Id[]; // creation order = valid topological order
  steps: Step[];
  measures: Measure[];
  createdAt: number;
  updatedAt: number;
}
