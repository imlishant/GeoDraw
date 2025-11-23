import type { Point, GeoElement } from '../core/geometry/types';
import { generateId } from '../core/geometry/utils';
import type { GeometryState } from '../store/useGeometryStore';

/**
 * Perpendicular Bisector Tool
 * - Click to select first point
 * - Click to select second point
 * - Creates perpendicular bisector line through midpoint
 * - Prevents duplicate bisectors for the same point pair (regardless of order)
 */
export function handlePerpendicularBisectorClick(
  worldX: number,
  worldY: number,
  elements: GeoElement[],
  isDrawing: boolean,
  tempData: any,
  zoom: number,
  store: GeometryState
) {
  const threshold = 12 / zoom; // Click threshold in world units

  // Find closest point
  let closestPoint: Point | null = null;
  let minDist = Infinity;

  for (const el of elements) {
    if (el.type === 'point') {
      const dx = el.x - worldX;
      const dy = el.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < threshold && dist < minDist) {
        closestPoint = el;
        minDist = dist;
      }
    }
  }

  if (!closestPoint) return;

  if (!isDrawing) {
    // First point selected
    store.startConstruction({ p1Id: closestPoint.id, p1: closestPoint });
  } else {
    // Second point selected
    const p1Id = tempData.p1Id as string;

    if (p1Id === closestPoint.id) {
      // Same point clicked, cancel
      store.completeConstruction();
      return;
    }

    // Check if a bisector already exists for these two points (in any order)
    const bisectorExists = elements.some(el => {
      if (el.type !== 'perpendicular_bisector') return false;
      // Check both orderings to prevent duplicates (A→B and B→A are the same)
      return (
        (el.p1Id === p1Id && el.p2Id === closestPoint.id) ||
        (el.p1Id === closestPoint.id && el.p2Id === p1Id)
      );
    });

    if (bisectorExists) {
      // Bisector already exists, cancel
      store.completeConstruction();
      return;
    }

    // Create perpendicular bisector
    const bisector = {
      id: generateId(),
      type: 'perpendicular_bisector' as const,
      p1Id: p1Id,
      p2Id: closestPoint.id
    };

    store.addElement(bisector);
    store.completeConstruction();
  }
}

// No visible component needed
export default function PerpendicularBisectorTool() {
  return null;
}
