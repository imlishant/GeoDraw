export interface Vec2 {
  x: number;
  y: number;
}

export interface Point {
  id: string;
  type: 'point';
  x: number;
  y: number;
  isFixed: boolean; // true = user placed, false = intersection/derived
  label?: string; // Optional label (A-Z)
}

export interface Line {
  id: string;
  type: 'line';
  p1Id: string;
  p2Id: string;
  infinite: boolean;
}

export interface Circle {
  id: string;
  type: 'circle';
  centerId: string;
  radiusPointId: string; // Point that defines radius
}

export interface PerpendicularBisector {
  id: string;
  type: 'perpendicular_bisector';
  p1Id: string;  // First point
  p2Id: string;  // Second point
}

export interface PerpendicularLine {
  id: string;
  type: 'perpendicular_line';
  pointId: string;      // Point the line passes through
  referenceLineId: string;  // Line to be perpendicular to (could be line, bisector, etc.)
}

export type GeoElement = Point | Line | Circle | PerpendicularBisector | PerpendicularLine;
export type Tool = 'select' | 'label' | 'point' | 'line' | 'circle' | 'perpendicular_bisector' | 'perpendicular_line' | 'intersect';