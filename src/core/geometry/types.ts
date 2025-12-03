export interface Vec2 {
  x: number;
  y: number;
}

export interface BaseElement {
  id: string;
  type: string;
  dependencies?: string[]; // IDs of elements this element depends on
  label?: string;
}

export interface Point extends BaseElement {
  type: 'point';
  x: number;
  y: number;
  isFixed: boolean; // true = user placed, false = intersection/derived
  intersectionIndex?: number; // If derived from intersection, which one? (0 or 1)
}

export interface Line extends BaseElement {
  type: 'line';
  p1Id: string;
  p2Id: string;
  infinite: boolean;
}

export interface Circle extends BaseElement {
  type: 'circle';
  centerId: string;
  radiusPointId: string; // Point that defines radius
}

export interface PerpendicularBisector extends BaseElement {
  type: 'perpendicular_bisector';
  p1Id: string;  // First point
  p2Id: string;  // Second point
}

export interface PerpendicularLine extends BaseElement {
  type: 'perpendicular_line';
  pointId: string;      // Point the line passes through
  referenceLineId: string;  // Line to be perpendicular to
}

export interface AngleBisector extends BaseElement {
  type: 'angle_bisector';
  vertexId: string;  // Vertex of the angle
  p1Id: string;      // First point on one ray
  p2Id: string;      // Second point on other ray
}

export type GeoElement = Point | Line | Circle | PerpendicularBisector | PerpendicularLine | AngleBisector;
export type Tool = 'select' | 'label' | 'point' | 'line' | 'circle' | 'perpendicular_bisector' | 'perpendicular_line' | 'angle_bisector' | 'intersect';