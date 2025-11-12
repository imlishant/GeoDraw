import type { Point, Line, Circle, GeoElement } from './types';
import { distance } from './utils';

export interface IntersectionPoint {
  x: number;
  y: number;
}

/**
 * Find intersection points between a line and a line
 */
export function lineLineIntersection(
  l1: Line,
  l2: Line,
  points: Map<string, Point>
): IntersectionPoint[] {
  const p1 = points.get(l1.p1Id);
  const p2 = points.get(l1.p2Id);
  const p3 = points.get(l2.p1Id);
  const p4 = points.get(l2.p2Id);
  
  if (!p1 || !p2 || !p3 || !p4) return [];

  // Line 1: parametric form p1 + t * (p2 - p1)
  // Line 2: parametric form p3 + s * (p4 - p3)
  const d1x = p2.x - p1.x;
  const d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x;
  const d2y = p4.y - p3.y;

  const denom = d1x * d2y - d1y * d2x;
  
  // Lines are parallel or coincident
  if (Math.abs(denom) < 1e-10) return [];

  const dx = p3.x - p1.x;
  const dy = p3.y - p1.y;
  
  const t = (dx * d2y - dy * d2x) / denom;
  
  const ix = p1.x + t * d1x;
  const iy = p1.y + t * d1y;
  
  return [{ x: ix, y: iy }];
}

/**
 * Find intersection points between a line and a circle
 */
export function lineCircleIntersection(
  line: Line,
  circle: Circle,
  points: Map<string, Point>
): IntersectionPoint[] {
  const p1 = points.get(line.p1Id);
  const p2 = points.get(line.p2Id);
  const center = points.get(circle.centerId);
  const radiusPoint = points.get(circle.radiusPointId);
  
  if (!p1 || !p2 || !center || !radiusPoint) return [];

  const radius = distance(center, radiusPoint);
  
  // Line direction
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  if (len < 1e-10) return [];
  
  const ux = dx / len;
  const uy = dy / len;
  
  // Vector from p1 to center
  const fx = center.x - p1.x;
  const fy = center.y - p1.y;
  
  // Project center onto line
  const proj = fx * ux + fy * uy;
  
  // Closest point on line to center
  const closestX = p1.x + proj * ux;
  const closestY = p1.y + proj * uy;
  
  // Distance from center to line
  const distToLine = Math.sqrt(
    (center.x - closestX) ** 2 + (center.y - closestY) ** 2
  );
  
  // No intersection if line doesn't reach circle
  if (distToLine > radius) return [];
  
  // Distance along line from closest point to intersection points
  const halfChord = Math.sqrt(radius * radius - distToLine * distToLine);
  
  const results: IntersectionPoint[] = [];
  
  // Two intersection points (or one if tangent)
  if (halfChord > 1e-10) {
    results.push({
      x: closestX - halfChord * ux,
      y: closestY - halfChord * uy
    });
    results.push({
      x: closestX + halfChord * ux,
      y: closestY + halfChord * uy
    });
  } else {
    // Tangent case
    results.push({ x: closestX, y: closestY });
  }
  
  return results;
}

/**
 * Find intersection points between two circles
 */
export function circleCircleIntersection(
  c1: Circle,
  c2: Circle,
  points: Map<string, Point>
): IntersectionPoint[] {
  const center1 = points.get(c1.centerId);
  const radius1Point = points.get(c1.radiusPointId);
  const center2 = points.get(c2.centerId);
  const radius2Point = points.get(c2.radiusPointId);
  
  if (!center1 || !radius1Point || !center2 || !radius2Point) return [];

  const r1 = distance(center1, radius1Point);
  const r2 = distance(center2, radius2Point);
  const d = distance(center1, center2);
  
  // No intersection if circles are too far apart or one contains the other
  if (d > r1 + r2 || d < Math.abs(r1 - r2) || d < 1e-10) return [];
  
  // Distance from center1 to the line between intersection points
  const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
  
  // Height of the intersection points above the line between centers
  const h = Math.sqrt(r1 * r1 - a * a);
  
  // Point on line between centers
  const px = center1.x + a * (center2.x - center1.x) / d;
  const py = center1.y + a * (center2.y - center1.y) / d;
  
  // Perpendicular offsets
  const offsetX = h * (center2.y - center1.y) / d;
  const offsetY = h * (center2.x - center1.x) / d;
  
  return [
    { x: px + offsetX, y: py - offsetY },
    { x: px - offsetX, y: py + offsetY }
  ];
}

/**
 * Find all intersection points between two geometric elements
 */
export function findIntersections(
  el1: GeoElement,
  el2: GeoElement,
  points: Map<string, Point>
): IntersectionPoint[] {
  if (el1.type === 'point' || el2.type === 'point') return [];
  
  if (el1.type === 'line' && el2.type === 'line') {
    return lineLineIntersection(el1, el2, points);
  }
  
  if (el1.type === 'line' && el2.type === 'circle') {
    return lineCircleIntersection(el1, el2, points);
  }
  
  if (el1.type === 'circle' && el2.type === 'line') {
    return lineCircleIntersection(el2, el1, points);
  }
  
  if (el1.type === 'circle' && el2.type === 'circle') {
    return circleCircleIntersection(el1, el2, points);
  }
  
  return [];
}
