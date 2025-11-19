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

export type GeoElement = Point | Line | Circle;
export type Tool = 'select' | 'label' | 'point' | 'line' | 'circle' | 'perpendicular' | 'intersect';