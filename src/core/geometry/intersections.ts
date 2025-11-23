import type { Point, Line, Circle, GeoElement, PerpendicularBisector, PerpendicularLine } from './types';
import { distance } from './utils';

export interface IntersectionPoint {
  x: number;
  y: number;
}

/**
 * Helper: Convert perpendicular bisector to two points on the bisector line
 * Returns {p1, p2} representing the infinite perpendicular bisector line
 */
function getBisectorLinePoints(
  bisector: PerpendicularBisector,
  points: Map<string, Point>
): { p1: Point; p2: Point } | null {
  const p1 = points.get(bisector.p1Id);
  const p2 = points.get(bisector.p2Id);
  if (!p1 || !p2) return null;

  // Midpoint
  const midX = (p1.x + p2.x) / 2;
  const midY = (p1.y + p2.y) / 2;

  // Direction along segment
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1e-10) return null;

  // Perpendicular direction (rotated 90 degrees)
  const perpX = -dy / len;
  const perpY = dx / len;

  // Two points on the bisector line (far apart for intersection calculation)
  const big = 10000;
  return {
    p1: { x: midX - perpX * big, y: midY - perpY * big, id: '', type: 'point', isFixed: false },
    p2: { x: midX + perpX * big, y: midY + perpY * big, id: '', type: 'point', isFixed: false }
  };
}

/**
 * Helper: Convert perpendicular line to two points on the perpendicular line
 * Returns {p1, p2} representing the infinite perpendicular line
 */
function getPerpLinePoints(
  perpLine: PerpendicularLine,
  points: Map<string, Point>,
  allElements: GeoElement[]
): { p1: Point; p2: Point } | null {
  const point = points.get(perpLine.pointId);
  if (!point) return null;

  // Get the reference geometry
  const refEl = allElements.find(e => e.id === perpLine.referenceLineId);
  if (!refEl) return null;

  let refP1: Point | undefined;
  let refP2: Point | undefined;

  // Extract two points from reference geometry
  if (refEl.type === 'line') {
    refP1 = points.get(refEl.p1Id);
    refP2 = points.get(refEl.p2Id);
  } else if (refEl.type === 'perpendicular_bisector') {
    // For perpendicular bisector, get the bisector line direction, not the segment direction
    refP1 = points.get(refEl.p1Id);
    refP2 = points.get(refEl.p2Id);
  } else if (refEl.type === 'perpendicular_line') {
    // For perpendicular line, extract its defining geometry
    const refPoint = points.get(refEl.pointId);
    if (!refPoint) return null;
    
    const refRefEl = allElements.find(e => e.id === refEl.referenceLineId);
    if (!refRefEl) return null;
    
    if (refRefEl.type === 'line' || refRefEl.type === 'perpendicular_bisector') {
      refP1 = points.get(refRefEl.p1Id);
      refP2 = points.get(refRefEl.p2Id);
    }
  }

  if (!refP1 || !refP2) return null;

  // Direction of reference line
  let refDx = refP2.x - refP1.x;
  let refDy = refP2.y - refP1.y;
  let refLen = Math.sqrt(refDx * refDx + refDy * refDy);

  if (refLen < 1e-10) return null;

  // For perpendicular bisectors, the direction is perpendicular to the segment
  if (refEl.type === 'perpendicular_bisector') {
    // The segment direction
    const segDx = refDx;
    const segDy = refDy;
    // Rotate 90 degrees to get the bisector direction
    refDx = -segDy;
    refDy = segDx;
    refLen = Math.hypot(refDx, refDy);
  }

  // Perpendicular direction to the reference (rotated 90 degrees)
  const perpX = -refDy / refLen;
  const perpY = refDx / refLen;

  // Two points on the perpendicular line (far apart for intersection calculation)
  const big = 10000;
  return {
    p1: { x: point.x - perpX * big, y: point.y - perpY * big, id: '', type: 'point', isFixed: false },
    p2: { x: point.x + perpX * big, y: point.y + perpY * big, id: '', type: 'point', isFixed: false }
  };
}


/**
 * Find intersection between a line and a perpendicular line (treated as infinite line)
 */
export function linePerpLineIntersection(
  line: Line,
  perpLine: PerpendicularLine,
  points: Map<string, Point>,
  allElements: GeoElement[]
): IntersectionPoint[] {
  const perpLinePoints = getPerpLinePoints(perpLine, points, allElements);
  if (!perpLinePoints) return [];

  // Create a temporary line object from the perpendicular line
  const tempPerpLine: Line = {
    id: 'temp',
    type: 'line',
    p1Id: 'temp1',
    p2Id: 'temp2',
    infinite: true
  };

  // Create a temporary points map with the perpendicular line points
  const tempPoints = new Map(points);
  tempPoints.set('temp1', perpLinePoints.p1);
  tempPoints.set('temp2', perpLinePoints.p2);

  return lineLineIntersection(line, tempPerpLine, tempPoints);
}

/**
 * Find intersection between a circle and a perpendicular line (treated as infinite line)
 */
export function circlePerpLineIntersection(
  circle: Circle,
  perpLine: PerpendicularLine,
  points: Map<string, Point>,
  allElements: GeoElement[]
): IntersectionPoint[] {
  const perpLinePoints = getPerpLinePoints(perpLine, points, allElements);
  if (!perpLinePoints) return [];

  const tempLine: Line = {
    id: 'temp',
    type: 'line',
    p1Id: 'temp1',
    p2Id: 'temp2',
    infinite: true
  };

  const tempPoints = new Map(points);
  tempPoints.set('temp1', perpLinePoints.p1);
  tempPoints.set('temp2', perpLinePoints.p2);

  return lineCircleIntersection(tempLine, circle, tempPoints);
}

/**
 * Find intersection between two perpendicular lines (treated as infinite lines)
 */
export function perpLinePerpLineIntersection(
  perpLine1: PerpendicularLine,
  perpLine2: PerpendicularLine,
  points: Map<string, Point>,
  allElements: GeoElement[]
): IntersectionPoint[] {
  const perpLinePoints1 = getPerpLinePoints(perpLine1, points, allElements);
  const perpLinePoints2 = getPerpLinePoints(perpLine2, points, allElements);

  if (!perpLinePoints1 || !perpLinePoints2) return [];

  const tempLine1: Line = {
    id: 'temp1',
    type: 'line',
    p1Id: 'temp1a',
    p2Id: 'temp1b',
    infinite: true
  };

  const tempLine2: Line = {
    id: 'temp2',
    type: 'line',
    p1Id: 'temp2a',
    p2Id: 'temp2b',
    infinite: true
  };

  const tempPoints = new Map(points);
  tempPoints.set('temp1a', perpLinePoints1.p1);
  tempPoints.set('temp1b', perpLinePoints1.p2);
  tempPoints.set('temp2a', perpLinePoints2.p1);
  tempPoints.set('temp2b', perpLinePoints2.p2);

  return lineLineIntersection(tempLine1, tempLine2, tempPoints);
}

/**
 * Find intersection between a perpendicular bisector and a perpendicular line (treated as infinite lines)
 */
export function bisectorPerpLineIntersection(
  bisector: PerpendicularBisector,
  perpLine: PerpendicularLine,
  points: Map<string, Point>,
  allElements: GeoElement[]
): IntersectionPoint[] {
  const bisectorPoints = getBisectorLinePoints(bisector, points);
  const perpLinePoints = getPerpLinePoints(perpLine, points, allElements);

  if (!bisectorPoints || !perpLinePoints) return [];

  const tempLine1: Line = {
    id: 'temp1',
    type: 'line',
    p1Id: 'temp1a',
    p2Id: 'temp1b',
    infinite: true
  };

  const tempLine2: Line = {
    id: 'temp2',
    type: 'line',
    p1Id: 'temp2a',
    p2Id: 'temp2b',
    infinite: true
  };

  const tempPoints = new Map(points);
  tempPoints.set('temp1a', bisectorPoints.p1);
  tempPoints.set('temp1b', bisectorPoints.p2);
  tempPoints.set('temp2a', perpLinePoints.p1);
  tempPoints.set('temp2b', perpLinePoints.p2);

  return lineLineIntersection(tempLine1, tempLine2, tempPoints);
}

/**
 * Find intersection between a line and a perpendicular bisector (treated as infinite line)
 */
export function lineBisectorIntersection(
  line: Line,
  bisector: PerpendicularBisector,
  points: Map<string, Point>
): IntersectionPoint[] {
  const bisectorPoints = getBisectorLinePoints(bisector, points);
  if (!bisectorPoints) return [];

  // Create a temporary line object from the bisector
  const tempBisectorLine: Line = {
    id: 'temp',
    type: 'line',
    p1Id: 'temp1',
    p2Id: 'temp2',
    infinite: true
  };

  // Create a temporary points map with the bisector points
  const tempPoints = new Map(points);
  tempPoints.set('temp1', bisectorPoints.p1);
  tempPoints.set('temp2', bisectorPoints.p2);

  return lineLineIntersection(line, tempBisectorLine, tempPoints);
}

/**
 * Find intersection between two perpendicular bisectors (treated as infinite lines)
 */
export function bisectorBisectorIntersection(
  bisector1: PerpendicularBisector,
  bisector2: PerpendicularBisector,
  points: Map<string, Point>
): IntersectionPoint[] {
  const bisectorPoints1 = getBisectorLinePoints(bisector1, points);
  const bisectorPoints2 = getBisectorLinePoints(bisector2, points);

  if (!bisectorPoints1 || !bisectorPoints2) return [];

  const tempLine1: Line = {
    id: 'temp1',
    type: 'line',
    p1Id: 'temp1a',
    p2Id: 'temp1b',
    infinite: true
  };

  const tempLine2: Line = {
    id: 'temp2',
    type: 'line',
    p1Id: 'temp2a',
    p2Id: 'temp2b',
    infinite: true
  };

  const tempPoints = new Map(points);
  tempPoints.set('temp1a', bisectorPoints1.p1);
  tempPoints.set('temp1b', bisectorPoints1.p2);
  tempPoints.set('temp2a', bisectorPoints2.p1);
  tempPoints.set('temp2b', bisectorPoints2.p2);

  return lineLineIntersection(tempLine1, tempLine2, tempPoints);
}

/**
 * Find intersection between a circle and a perpendicular bisector (treated as infinite line)
 */
export function circleBisectorIntersection(
  circle: Circle,
  bisector: PerpendicularBisector,
  points: Map<string, Point>
): IntersectionPoint[] {
  const bisectorPoints = getBisectorLinePoints(bisector, points);
  if (!bisectorPoints) return [];

  const tempLine: Line = {
    id: 'temp',
    type: 'line',
    p1Id: 'temp1',
    p2Id: 'temp2',
    infinite: true
  };

  const tempPoints = new Map(points);
  tempPoints.set('temp1', bisectorPoints.p1);
  tempPoints.set('temp2', bisectorPoints.p2);

  return lineCircleIntersection(tempLine, circle, tempPoints);
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
  points: Map<string, Point>,
  allElements: GeoElement[] = []
): IntersectionPoint[] {
  if (el1.type === 'point' || el2.type === 'point') return [];
  
  // Line-line intersections
  if (el1.type === 'line' && el2.type === 'line') {
    return lineLineIntersection(el1, el2, points);
  }
  
  // Line-circle intersections
  if (el1.type === 'line' && el2.type === 'circle') {
    return lineCircleIntersection(el1, el2, points);
  }
  
  if (el1.type === 'circle' && el2.type === 'line') {
    return lineCircleIntersection(el2, el1, points);
  }
  
  // Circle-circle intersections
  if (el1.type === 'circle' && el2.type === 'circle') {
    return circleCircleIntersection(el1, el2, points);
  }
  
  // Perpendicular bisector intersections (treat as infinite lines)
  if (el1.type === 'perpendicular_bisector' && el2.type === 'line') {
    return lineBisectorIntersection(el2, el1, points);
  }
  
  if (el1.type === 'line' && el2.type === 'perpendicular_bisector') {
    return lineBisectorIntersection(el1, el2, points);
  }
  
  if (el1.type === 'perpendicular_bisector' && el2.type === 'circle') {
    return circleBisectorIntersection(el2, el1, points);
  }
  
  if (el1.type === 'circle' && el2.type === 'perpendicular_bisector') {
    return circleBisectorIntersection(el1, el2, points);
  }
  
  if (el1.type === 'perpendicular_bisector' && el2.type === 'perpendicular_bisector') {
    return bisectorBisectorIntersection(el1, el2, points);
  }
  
  // Perpendicular line intersections (treat as infinite lines)
  if (el1.type === 'perpendicular_line' && el2.type === 'line') {
    return linePerpLineIntersection(el2, el1, points, allElements);
  }
  
  if (el1.type === 'line' && el2.type === 'perpendicular_line') {
    return linePerpLineIntersection(el1, el2, points, allElements);
  }
  
  if (el1.type === 'perpendicular_line' && el2.type === 'circle') {
    return circlePerpLineIntersection(el2, el1, points, allElements);
  }
  
  if (el1.type === 'circle' && el2.type === 'perpendicular_line') {
    return circlePerpLineIntersection(el1, el2, points, allElements);
  }
  
  if (el1.type === 'perpendicular_line' && el2.type === 'perpendicular_bisector') {
    return bisectorPerpLineIntersection(el2, el1, points, allElements);
  }
  
  if (el1.type === 'perpendicular_bisector' && el2.type === 'perpendicular_line') {
    return bisectorPerpLineIntersection(el1, el2, points, allElements);
  }
  
  if (el1.type === 'perpendicular_line' && el2.type === 'perpendicular_line') {
    return perpLinePerpLineIntersection(el1, el2, points, allElements);
  }
  
  return [];
}
