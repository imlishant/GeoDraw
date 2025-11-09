import type { Point, Line, Circle, GeoElement } from './types';
import { isPointOnLine, distance, EPSILON } from './utils';

// Euclidea-style validation: ensure constructions are geometrically precise
export class ConstraintValidator {
  // Check if line can be drawn through two points
  static validateLine(p1Id: string, p2Id: string, elements: Map<string, GeoElement>): boolean {
    const p1 = elements.get(p1Id);
    const p2 = elements.get(p2Id);
    return p1?.type === 'point' && p2?.type === 'point' && p1Id !== p2Id;
  }

  // Check if circle can be drawn (center + radius point)
  static validateCircle(centerId: string, radiusPointId: string, elements: Map<string, GeoElement>): boolean {
    const center = elements.get(centerId);
    const radiusPoint = elements.get(radiusPointId);
    return center?.type === 'point' && radiusPoint?.type === 'point' && centerId !== radiusPointId;
  }

  // Check if point lies on existing geometry (for intersection points)
  static validatePointOnGeometry(x: number, y: number, elements: GeoElement[]): boolean {
    // For MVP: allow points anywhere (Euclidea restricts this)
    // In future: check if point is on line/circle intersection
    return true;
  }
}