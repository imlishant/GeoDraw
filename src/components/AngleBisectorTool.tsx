import type { Point, GeoElement, AngleBisector } from '../core/geometry/types';
import { generateId } from '../core/geometry/utils';
import type { GeometryState } from '../store/useGeometryStore';

/**
 * Angle Bisector Tool
 * - Click to select vertex point
 * - Click to select first point (on one ray from vertex)
 * - Click to select second point (on other ray from vertex)
 * - Creates bisector of angle formed by rays vertex→p1 and vertex→p2
 * 
 * Order-independent for p1 and p2 selection
 */
export function handleAngleBisectorClick(
  worldX: number,
  worldY: number,
  elements: GeoElement[],
  isDrawing: boolean,
  tempData: any,
  zoom: number,
  store: GeometryState
) {
  const pointThreshold = 12 / zoom; // Click threshold for points

  // Find closest point
  let closestPoint: Point | null = null;
  let minPointDist = Infinity;

  for (const el of elements) {
    if (el.type === 'point') {
      const dx = el.x - worldX;
      const dy = el.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < pointThreshold && dist < minPointDist) {
        closestPoint = el;
        minPointDist = dist;
      }
    }
  }

  if (!closestPoint) {
    // Cancel if no point clicked
    if (isDrawing) {
      store.completeConstruction();
    }
    return;
  }

  // First click: select vertex
  if (!isDrawing) {
    store.startConstruction({ vertex: closestPoint });
    return;
  }

  const vertex = tempData.vertex as Point | undefined;
  const p1 = tempData.p1 as Point | undefined;

  // Second click: select first point on a ray
  if (vertex && !p1 && closestPoint.id !== vertex.id) {
    store.startConstruction({ vertex, p1: closestPoint });
    return;
  }

  // Third click: select second point on another ray
  if (vertex && p1 && closestPoint.id !== vertex.id && closestPoint.id !== p1.id) {
    // Check if angle bisector already exists
    const bisectorExists = elements.some(el => {
      if (el.type !== 'angle_bisector') return false;
      return (
        el.vertexId === vertex.id &&
        ((el.p1Id === p1.id && el.p2Id === closestPoint.id) ||
         (el.p1Id === closestPoint.id && el.p2Id === p1.id))
      );
    });

    if (bisectorExists) {
      store.completeConstruction();
      return;
    }

    // Calculate angle bisector direction
    // Ray 1: vertex → p1
    const ray1X = p1.x - vertex.x;
    const ray1Y = p1.y - vertex.y;
    const ray1Len = Math.hypot(ray1X, ray1Y);

    // Ray 2: vertex → p2
    const ray2X = closestPoint.x - vertex.x;
    const ray2Y = closestPoint.y - vertex.y;
    const ray2Len = Math.hypot(ray2X, ray2Y);

    // Normalize rays
    const ray1NormX = ray1Len > 1e-8 ? ray1X / ray1Len : 0;
    const ray1NormY = ray1Len > 1e-8 ? ray1Y / ray1Len : 0;
    const ray2NormX = ray2Len > 1e-8 ? ray2X / ray2Len : 0;
    const ray2NormY = ray2Len > 1e-8 ? ray2Y / ray2Len : 0;

    // Bisector direction: average of normalized rays
    const bisectorX = ray1NormX + ray2NormX;
    const bisectorY = ray1NormY + ray2NormY;
    const bisectorLen = Math.hypot(bisectorX, bisectorY);

    // If rays are opposite, bisector is undefined (degenerate case)
    if (bisectorLen < 1e-8) {
      store.completeConstruction();
      return;
    }

    const bisector: AngleBisector = {
      id: generateId(),
      type: 'angle_bisector',
      vertexId: vertex.id,
      p1Id: p1.id,
      p2Id: closestPoint.id
    };

    store.addElement(bisector);
    store.completeConstruction();
    return;
  }

  // Cancel if invalid sequence (e.g., clicking same point twice)
  store.completeConstruction();
}

// No visible component needed
export default function AngleBisectorTool() {
  return null;
}
