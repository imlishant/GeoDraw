import type { Point, GeoElement, Line, PerpendicularBisector, PerpendicularLine, AngleBisector } from '../core/geometry/types';
import { generateId, getElementDirection } from '../core/geometry/utils';
import type { GeometryState } from '../store/useGeometryStore';

/**
 * Perpendicular Line Tool
 * - Click to select a point or line (order doesn't matter)
 * - Then click the other type to complete the perpendicular line
 * - Point: line passes through this point
 * - Line: the perpendicular line will be perpendicular to this line
 * 
 * Can handle: line, perpendicular_bisector, perpendicular_line, angle_bisector, and any future linear elements
 */
export function handlePerpendicularLineClick(
  worldX: number,
  worldY: number,
  elements: GeoElement[],
  isDrawing: boolean,
  tempData: any,
  zoom: number,
  store: GeometryState
) {
  const pointThreshold = 12 / zoom; // Click threshold for points
  const lineThreshold = 10 / zoom;  // Click threshold for lines

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

  // Find closest line-like element (line, perpendicular_bisector, perpendicular_line, angle_bisector, or future tools)
  let closestLine: (Line | PerpendicularBisector | PerpendicularLine | AngleBisector) | null = null;
  let minLineDist = Infinity;

  for (const el of elements) {
    if (el.type === 'line' || el.type === 'perpendicular_bisector' || el.type === 'perpendicular_line' || el.type === 'angle_bisector') {
      // Create a map for the helper
      const elementsMap = new Map(elements.map(e => [e.id, e]));
      const dir = getElementDirection(el.id, elementsMap);

      if (!dir) continue;

      // Get a point on the line to calculate distance
      let linePoint: Point | undefined;
      if (el.type === 'line') {
        linePoint = elements.find(e => e.id === el.p1Id) as Point;
      } else if (el.type === 'perpendicular_bisector') {
        const p1 = elements.find(e => e.id === el.p1Id) as Point;
        const p2 = elements.find(e => e.id === el.p2Id) as Point;
        if (p1 && p2) {
          linePoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, id: 'mid', type: 'point', isFixed: false };
        }
      } else if (el.type === 'angle_bisector') {
        linePoint = elements.find(e => e.id === el.vertexId) as Point;
      } else if (el.type === 'perpendicular_line') {
        linePoint = elements.find(e => e.id === el.pointId) as Point;
      }

      if (!linePoint) continue;

      // Distance from mouse to line defined by linePoint and dir
      // Line equation: (y - y0) * dx - (x - x0) * dy = 0
      // Distance = |(y - y0) * dx - (x - x0) * dy| / sqrt(dx^2 + dy^2)
      // Since dir is normalized, denominator is 1.
      // Normal vector is (-dir.y, dir.x)

      const dist = Math.abs(-dir.y * (worldX - linePoint.x) + dir.x * (worldY - linePoint.y));

      if (dist < lineThreshold && dist < minLineDist) {
        closestLine = el;
        minLineDist = dist;
      }
      continue;
    }
  }

  // First click: select either a point or a line
  if (!isDrawing) {
    if (closestPoint) {
      store.startConstruction({ selectedPoint: closestPoint });
    } else if (closestLine) {
      store.startConstruction({ selectedLine: closestLine });
    }
    return;
  }

  // Second click: select the other type
  const selectedPoint = tempData.selectedPoint as Point | undefined;
  const selectedLine = tempData.selectedLine as (Line | PerpendicularBisector | PerpendicularLine | AngleBisector) | undefined;

  // Case 1: First was a point, now selecting a line
  if (selectedPoint && closestLine && !selectedLine) {
    // Check if perpendicular line already exists (exact match)
    const perpLineExists = elements.some(el => {
      if (el.type !== 'perpendicular_line') return false;
      return el.pointId === selectedPoint.id && el.referenceLineId === closestLine!.id;
    });

    if (perpLineExists) {
      store.completeConstruction();
      return;
    }

    // Check for geometric coincidence (visually identical line)
    // 1. Calculate direction of the new perpendicular line
    const elementsMap = new Map(elements.map(e => [e.id, e]));
    const refDir = getElementDirection(closestLine.id, elementsMap);

    if (refDir) {
      // New line direction is perpendicular to reference
      const newDir = { x: -refDir.y, y: refDir.x };

      // 2. Check against all other linear elements
      const isCoincident = elements.some(el => {
        if (el.type !== 'line' && el.type !== 'perpendicular_bisector' && el.type !== 'perpendicular_line' && el.type !== 'angle_bisector') return false;

        const elDir = getElementDirection(el.id, elementsMap);
        if (!elDir) return false;

        // Check if parallel (dot product close to 1 or -1)
        const dot = newDir.x * elDir.x + newDir.y * elDir.y;
        if (Math.abs(Math.abs(dot) - 1) > 1e-6) return false;

        // Check if point lies on the element's infinite line
        // We know the new line passes through selectedPoint.
        // If selectedPoint also lies on 'el', and they are parallel, they are coincident.

        // Get a point on 'el'
        let pOnEl: Point | undefined;
        if (el.type === 'line') {
          pOnEl = elements.find(e => e.id === el.p1Id) as Point;
        } else if (el.type === 'perpendicular_bisector') {
          const p1 = elements.find(e => e.id === el.p1Id) as Point;
          const p2 = elements.find(e => e.id === el.p2Id) as Point;
          if (p1 && p2) pOnEl = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, id: 'mid', type: 'point', isFixed: false };
        } else if (el.type === 'angle_bisector') {
          pOnEl = elements.find(e => e.id === el.vertexId) as Point;
        } else if (el.type === 'perpendicular_line') {
          pOnEl = elements.find(e => e.id === el.pointId) as Point;
        }

        if (!pOnEl) return false;

        // Distance from selectedPoint to line 'el'
        // Normal vector to el is (-elDir.y, elDir.x)
        const dist = Math.abs(-elDir.y * (selectedPoint.x - pOnEl.x) + elDir.x * (selectedPoint.y - pOnEl.y));

        return dist < 1e-4; // Epsilon for coincidence
      });

      if (isCoincident) {
        store.completeConstruction();
        return;
      }
    }

    const perpLine = {
      id: generateId(),
      type: 'perpendicular_line' as const,
      pointId: selectedPoint.id,
      referenceLineId: closestLine.id,
      dependencies: [selectedPoint.id, closestLine.id]
    };

    store.addElement(perpLine);
    store.completeConstruction();
    return;
  }

  // Case 2: First was a line, now selecting a point
  if (selectedLine && closestPoint && !selectedPoint) {
    // Check if perpendicular line already exists (exact match)
    const perpLineExists = elements.some(el => {
      if (el.type !== 'perpendicular_line') return false;
      return el.pointId === closestPoint.id && el.referenceLineId === selectedLine.id;
    });

    if (perpLineExists) {
      store.completeConstruction();
      return;
    }

    // Check for geometric coincidence (visually identical line)
    const elementsMap = new Map(elements.map(e => [e.id, e]));
    const refDir = getElementDirection(selectedLine.id, elementsMap);

    if (refDir) {
      const newDir = { x: -refDir.y, y: refDir.x };

      const isCoincident = elements.some(el => {
        if (el.type !== 'line' && el.type !== 'perpendicular_bisector' && el.type !== 'perpendicular_line' && el.type !== 'angle_bisector') return false;

        const elDir = getElementDirection(el.id, elementsMap);
        if (!elDir) return false;

        const dot = newDir.x * elDir.x + newDir.y * elDir.y;
        if (Math.abs(Math.abs(dot) - 1) > 1e-6) return false;

        let pOnEl: Point | undefined;
        if (el.type === 'line') {
          pOnEl = elements.find(e => e.id === el.p1Id) as Point;
        } else if (el.type === 'perpendicular_bisector') {
          const p1 = elements.find(e => e.id === el.p1Id) as Point;
          const p2 = elements.find(e => e.id === el.p2Id) as Point;
          if (p1 && p2) pOnEl = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, id: 'mid', type: 'point', isFixed: false };
        } else if (el.type === 'angle_bisector') {
          pOnEl = elements.find(e => e.id === el.vertexId) as Point;
        } else if (el.type === 'perpendicular_line') {
          pOnEl = elements.find(e => e.id === el.pointId) as Point;
        }

        if (!pOnEl) return false;

        const dist = Math.abs(-elDir.y * (closestPoint.x - pOnEl.x) + elDir.x * (closestPoint.y - pOnEl.y));
        return dist < 1e-4;
      });

      if (isCoincident) {
        store.completeConstruction();
        return;
      }
    }

    const perpLine = {
      id: generateId(),
      type: 'perpendicular_line' as const,
      pointId: closestPoint.id,
      referenceLineId: selectedLine.id,
      dependencies: [closestPoint.id, selectedLine.id]
    };

    store.addElement(perpLine);
    store.completeConstruction();
    return;
  }

  // Cancel if same type clicked twice
  store.completeConstruction();
}

// No visible component needed
export default function PerpendicularLineTool() {
  return null;
}

