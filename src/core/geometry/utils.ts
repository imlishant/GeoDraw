import type { Vec2, Point, Line, Circle, GeoElement } from './types';

// Precision for floating point comparisons
export const EPSILON = 1e-6;

export function distance(a: Vec2, b: Vec2): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function midpoint(a: Vec2, b: Vec2): Vec2 {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

// Check if point p is on line segment (p1, p2)
export function isPointOnLine(p: Vec2, p1: Vec2, p2: Vec2, tolerance = 5): boolean {
  const dist = distance(p1, p) + distance(p, p2);
  return Math.abs(dist - distance(p1, p2)) < tolerance;
}

// Find intersection of two lines (returns null if parallel)
export function lineIntersection(
  l1: { p1: Vec2; p2: Vec2 },
  l2: { p1: Vec2; p2: Vec2 }
): Vec2 | null {
  const x1 = l1.p1.x, y1 = l1.p1.y;
  const x2 = l1.p2.x, y2 = l1.p2.y;
  const x3 = l2.p1.x, y3 = l2.p1.y;
  const x4 = l2.p2.x, y4 = l2.p2.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < EPSILON) return null; // Parallel

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  return {
    x: x1 + t * (x2 - x1),
    y: y1 + t * (y2 - y1)
  };
}

// Find snap target within radius
export function findSnapTarget(
  mouse: Vec2,
  points: Point[],
  lines: Line[],
  circles: Circle[],
  allElements: Map<string, GeoElement>,
  snapRadius: number
): Vec2 | null {
  // 1. Snap to existing points
  for (const point of points) {
    if (distance(mouse, point) < snapRadius) {
      return { x: point.x, y: point.y };
    }
  }

  // 2. Snap to line intersections
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const p1 = allElements.get(lines[i].p1Id) as Point;
      const p2 = allElements.get(lines[i].p2Id) as Point;
      const p3 = allElements.get(lines[j].p1Id) as Point;
      const p4 = allElements.get(lines[j].p2Id) as Point;
      
      const inter = lineIntersection(
        { p1: { x: p1.x, y: p1.y }, p2: { x: p2.x, y: p2.y } },
        { p1: { x: p3.x, y: p3.y }, p2: { x: p4.x, y: p4.y } }
      );
      
      if (inter && distance(mouse, inter) < snapRadius) {
        return inter;
      }
    }
  }

  // 3. Snap to grid (if no other snap)
  const gridSize = 20;
  const gridX = Math.round(mouse.x / gridSize) * gridSize;
  const gridY = Math.round(mouse.y / gridSize) * gridSize;
  if (distance(mouse, { x: gridX, y: gridY }) < snapRadius) {
    return { x: gridX, y: gridY };
  }

  return null;
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 11);
}