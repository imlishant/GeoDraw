import type { Point, GeoElement, Line, PerpendicularBisector, PerpendicularLine, AngleBisector } from '../core/geometry/types';
import { generateId } from '../core/geometry/utils';
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
      let p1: Point | undefined;
      let p2: Point | undefined;

      if (el.type === 'line') {
        p1 = elements.find(e => e.id === el.p1Id) as Point | undefined;
        p2 = elements.find(e => e.id === el.p2Id) as Point | undefined;
      } else if (el.type === 'perpendicular_bisector') {
        p1 = elements.find(e => e.id === el.p1Id) as Point | undefined;
        p2 = elements.find(e => e.id === el.p2Id) as Point | undefined;
      } else if (el.type === 'perpendicular_line') {
        // For perpendicular lines, get the point and compute direction from reference line
        const point = elements.find(e => e.id === el.pointId) as Point | undefined;
        if (!point) continue;

        // Get the reference geometry (line or perpendicular_bisector)
        const refEl = elements.find(e => e.id === el.referenceLineId);
        if (!refEl) continue;

        let refP1: Point | undefined;
        let refP2: Point | undefined;

        if (refEl.type === 'line' || refEl.type === 'perpendicular_bisector') {
          refP1 = elements.find(e => e.id === refEl.p1Id) as Point | undefined;
          refP2 = elements.find(e => e.id === refEl.p2Id) as Point | undefined;
        } else if (refEl.type === 'perpendicular_line') {
          const refRefEl = elements.find(e => e.id === refEl.referenceLineId);
          if (refRefEl && (refRefEl.type === 'line' || refRefEl.type === 'perpendicular_bisector' || refRefEl.type === 'angle_bisector')) {
            refP1 = elements.find(e => e.id === refRefEl.p1Id) as Point | undefined;
            refP2 = elements.find(e => e.id === refRefEl.p2Id) as Point | undefined;
          }
        } else if (refEl.type === 'angle_bisector') {
          refP1 = elements.find(e => e.id === refEl.p1Id) as Point | undefined;
          refP2 = elements.find(e => e.id === refEl.p2Id) as Point | undefined;
        }

        if (refP1 && refP2) {
          // Get direction from reference line
          let refDx = refP2.x - refP1.x;
          let refDy = refP2.y - refP1.y;
          let refLen = Math.hypot(refDx, refDy);
          if (refLen < 1e-8) continue;

          // For perpendicular bisectors, the direction is perpendicular to the segment
          if (refEl.type === 'perpendicular_bisector') {
            const segDx = refDx;
            const segDy = refDy;
            refDx = -segDy;
            refDy = segDx;
            refLen = Math.hypot(refDx, refDy);
          } else if (refEl.type === 'angle_bisector') {
            // For angle bisector, compute direction from vertex and two rays
            const vertex = elements.find(e => e.id === refEl.vertexId) as Point | undefined;
            if (!vertex) continue;

            let ray1X = refP1.x - vertex.x;
            let ray1Y = refP1.y - vertex.y;
            const ray1Len = Math.hypot(ray1X, ray1Y);
            if (ray1Len < 1e-8) continue;
            ray1X /= ray1Len;
            ray1Y /= ray1Len;

            let ray2X = refP2.x - vertex.x;
            let ray2Y = refP2.y - vertex.y;
            const ray2Len = Math.hypot(ray2X, ray2Y);
            if (ray2Len < 1e-8) continue;
            ray2X /= ray2Len;
            ray2Y /= ray2Len;

            // Bisector direction is the average of the two normalized rays
            refDx = (ray1X + ray2X) / 2;
            refDy = (ray1Y + ray2Y) / 2;
            refLen = Math.hypot(refDx, refDy);
            if (refLen < 1e-8) continue;
          } else if (refEl.type === 'perpendicular_line') {
            // Handle nested perpendicular line - need to get the base reference element direction
            const refRefEl = elements.find(e => e.id === refEl.referenceLineId);
            if (refRefEl && (refRefEl.type === 'line' || refRefEl.type === 'perpendicular_bisector' || refRefEl.type === 'angle_bisector')) {
              const refRefP1 = elements.find(e => e.id === refRefEl.p1Id) as Point | undefined;
              const refRefP2 = elements.find(e => e.id === refRefEl.p2Id) as Point | undefined;
              if (refRefP1 && refRefP2) {
                let refRefDx = refRefP2.x - refRefP1.x;
                let refRefDy = refRefP2.y - refRefP1.y;
                const refRefLen = Math.hypot(refRefDx, refRefDy);
                if (refRefLen > 1e-8) {
                  // If perpendicular bisector, rotate to get bisector direction
                  if (refRefEl.type === 'perpendicular_bisector') {
                    const segDx = refRefDx;
                    const segDy = refRefDy;
                    refRefDx = -segDy;
                    refRefDy = segDx;
                  } else if (refRefEl.type === 'angle_bisector') {
                    const vertex = elements.find(e => e.id === refRefEl.vertexId) as Point | undefined;
                    if (vertex) {
                      let ray1X = refRefP1.x - vertex.x;
                      let ray1Y = refRefP1.y - vertex.y;
                      const ray1Len = Math.hypot(ray1X, ray1Y);
                      if (ray1Len > 1e-8) {
                        ray1X /= ray1Len;
                        ray1Y /= ray1Len;
                      }

                      let ray2X = refRefP2.x - vertex.x;
                      let ray2Y = refRefP2.y - vertex.y;
                      const ray2Len = Math.hypot(ray2X, ray2Y);
                      if (ray2Len > 1e-8) {
                        ray2X /= ray2Len;
                        ray2Y /= ray2Len;
                      }

                      refRefDx = (ray1X + ray2X) / 2;
                      refRefDy = (ray1Y + ray2Y) / 2;
                      const bisLen = Math.hypot(refRefDx, refRefDy);
                      if (bisLen > 1e-8) {
                        refRefDx /= bisLen;
                        refRefDy /= bisLen;
                      }
                    }
                  }
                  // The perpendicular to the perpendicular is the original direction
                  refDx = -refRefDy;
                  refDy = refRefDx;
                  refLen = Math.hypot(refDx, refDy);
                }
              }
            }
          }

          // Perpendicular direction (rotated 90 degrees)
          const perpX = -refDy / refLen;
          const perpY = refDx / refLen;

          // Distance from mouse to perpendicular line (infinite line through point)
          const dist = Math.abs(perpY * (worldX - point.x) - perpX * (worldY - point.y));

          if (dist < lineThreshold && dist < minLineDist) {
            closestLine = el;
            minLineDist = dist;
          }
        }
        continue;
      } else if (el.type === 'angle_bisector') {
        // For angle bisectors, get the vertex and compute direction from the two rays
        const vertex = elements.find(e => e.id === el.vertexId) as Point | undefined;
        const p1 = elements.find(e => e.id === el.p1Id) as Point | undefined;
        const p2 = elements.find(e => e.id === el.p2Id) as Point | undefined;

        if (!vertex || !p1 || !p2) continue;

        // Get rays from vertex to p1 and p2
        let ray1X = p1.x - vertex.x;
        let ray1Y = p1.y - vertex.y;
        const ray1Len = Math.hypot(ray1X, ray1Y);
        if (ray1Len < 1e-8) continue;
        ray1X /= ray1Len;
        ray1Y /= ray1Len;

        let ray2X = p2.x - vertex.x;
        let ray2Y = p2.y - vertex.y;
        const ray2Len = Math.hypot(ray2X, ray2Y);
        if (ray2Len < 1e-8) continue;
        ray2X /= ray2Len;
        ray2Y /= ray2Len;

        // Bisector direction is the average of the two normalized rays
        let bisectDx = (ray1X + ray2X) / 2;
        let bisectDy = (ray1Y + ray2Y) / 2;
        const bisectLen = Math.hypot(bisectDx, bisectDy);
        if (bisectLen < 1e-8) continue;
        bisectDx /= bisectLen;
        bisectDy /= bisectLen;

        // Distance from mouse to the bisector line (infinite line through vertex)
        const dist = Math.abs(bisectDy * (worldX - vertex.x) - bisectDx * (worldY - vertex.y));

        if (dist < lineThreshold && dist < minLineDist) {
          closestLine = el;
          minLineDist = dist;
        }
        continue;
      }

      if (p1 && p2) {
        // For perpendicular bisector, ONLY detect the perpendicular bisector line, NOT the segment
        if (el.type === 'perpendicular_bisector') {
          const bisectMidX = (p1.x + p2.x) / 2;
          const bisectMidY = (p1.y + p2.y) / 2;
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len > 1e-8) {
            // Perpendicular direction (the actual bisector line)
            const perpX = -dy / len;
            const perpY = dx / len;
            
            // Distance from click to the infinite bisector line through midpoint
            const dist = Math.abs(perpY * (worldX - bisectMidX) - perpX * (worldY - bisectMidY));
            
            // Select if click is close enough to the perpendicular bisector line
            if (dist < lineThreshold && dist < minLineDist) {
              closestLine = el;
              minLineDist = dist;
            }
          }
        } else {
          // For regular lines, detect the infinite line
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len2 = dx * dx + dy * dy;
          if (len2 > 0) {
            const dist = Math.abs((dy * worldX - dx * worldY + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(len2));
            if (dist < lineThreshold && dist < minLineDist) {
              closestLine = el;
              minLineDist = dist;
            }
          }
        }
      }
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
    // Check if perpendicular line already exists
    const perpLineExists = elements.some(el => {
      if (el.type !== 'perpendicular_line') return false;
      return el.pointId === selectedPoint.id && el.referenceLineId === closestLine!.id;
    });

    if (perpLineExists) {
      store.completeConstruction();
      return;
    }

    const perpLine = {
      id: generateId(),
      type: 'perpendicular_line' as const,
      pointId: selectedPoint.id,
      referenceLineId: closestLine.id
    };

    store.addElement(perpLine);
    store.completeConstruction();
    return;
  }

  // Case 2: First was a line, now selecting a point
  if (selectedLine && closestPoint && !selectedPoint) {
    // Check if perpendicular line already exists
    const perpLineExists = elements.some(el => {
      if (el.type !== 'perpendicular_line') return false;
      return el.pointId === closestPoint.id && el.referenceLineId === selectedLine.id;
    });

    if (perpLineExists) {
      store.completeConstruction();
      return;
    }

    const perpLine = {
      id: generateId(),
      type: 'perpendicular_line' as const,
      pointId: closestPoint.id,
      referenceLineId: selectedLine.id
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

