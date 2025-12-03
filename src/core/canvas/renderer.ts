import type { GeoElement, Point, Line, Circle, PerpendicularBisector, PerpendicularLine, AngleBisector } from '../geometry/types';
import { distance, getElementDirection } from '../geometry/utils';

const THEME = {
  light: {
    canvas: '#ffffff',
    elementStroke: '#1e293b',  // slate-800
    elementFill: 'transparent',
    point: '#3b82f6',  // blue-500
    pointHovered: '#ef4444', // red-500
    grid: '#f1f5f9',   // slate-100
    highlight: '#3b82f6',  // blue-500 for highlighting
    fixedPointBorder: '#ef4444', // red for man-made points
    derivedPointBorder: '#9ca3af', // gray for intersection points
  },
  dark: {
    canvas: '#0f172a', // slate-900
    elementStroke: '#f8fafc',  // slate-50
    elementFill: 'transparent',
    point: '#60a5fa',  // blue-400
    pointHovered: '#f87171', // red-400
    grid: '#1e293b',   // slate-800
    highlight: '#60a5fa',  // blue-400 for highlighting
    fixedPointBorder: '#f87171', // red for man-made points
    derivedPointBorder: '#9ca3af', // gray for intersection points
  }
};

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private theme = THEME.dark; // Force dark for now
  private transform = {
    zoom: 1,
    panX: 0,
    panY: 0
  };

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas not supported');
    this.ctx = context;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    // Detect dark mode
    this.theme = document.documentElement.classList.contains('dark')
      ? THEME.dark
      : THEME.light;
  }

  setTransform(zoom: number, panX: number, panY: number) {
    this.transform = { zoom, panX, panY };
  }

  applyTransform() {
    this.ctx.setTransform(
      this.transform.zoom, 0,
      0, this.transform.zoom,
      this.transform.panX,
      this.transform.panY
    );
  }

  resetTransform() {
    this.ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  clear(width: number, height: number) {
    this.resetTransform();
    this.ctx.fillStyle = this.theme.canvas;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawGrid(width: number, height: number, gridSize: number = 20) {
    this.ctx.save();
    this.resetTransform();
    this.ctx.strokeStyle = this.theme.grid;
    this.ctx.lineWidth = 1;

    const scaledGridSize = gridSize * this.transform.zoom;
    const startX = (this.transform.panX % scaledGridSize + scaledGridSize) % scaledGridSize;
    const startY = (this.transform.panY % scaledGridSize + scaledGridSize) % scaledGridSize;

    for (let x = startX; x < width; x += scaledGridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let y = startY; y < height; y += scaledGridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(width, y);
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  drawPoint(point: Point, isHovered: boolean) {
    this.ctx.save();
    this.ctx.fillStyle = isHovered ? this.theme.pointHovered : this.theme.point;
    // Scale point size inversely with zoom to maintain constant screen size
    const radius = (isHovered ? 6 : 4) / this.transform.zoom;
    const innerBorderWidth = 1.5 / this.transform.zoom;
    const outerBorderWidth = 2 / this.transform.zoom;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    // Inner white border for visibility
    this.ctx.strokeStyle = this.theme.canvas;
    this.ctx.lineWidth = innerBorderWidth;
    this.ctx.stroke();
    // Outer colored border to differentiate point types
    this.ctx.strokeStyle = point.isFixed ? this.theme.fixedPointBorder : this.theme.derivedPointBorder;
    this.ctx.lineWidth = outerBorderWidth;
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, radius + innerBorderWidth / 2, 0, Math.PI * 2);
    this.ctx.stroke();

    // Draw label if present
    if (point.label) {
      this.ctx.save();
      // Parse label to separate main letter from subscript
      const labelMatch = point.label.match(/^([A-Z])(\d+)?$/);
      if (labelMatch) {
        const mainLabel = labelMatch[1];
        const subscript = labelMatch[2];

        // Font size is constant (not scaled by zoom)
        const fontSize = 18 / this.transform.zoom;
        const subscriptFontSize = 12 / this.transform.zoom;

        // Theme-adaptive label color: blue for light, orange for dark
        const isDark = document.documentElement.classList.contains('dark');
        const labelColor = isDark ? '#ffb347' : '#1a4fff';
        const outlineColor = isDark ? '#222' : '#fff';

        // Slightly smaller gap for better appearance
        const gap = radius + 1 / this.transform.zoom;

        // Draw main label with outline
        this.ctx.font = `bold ${fontSize}px 'Fira Mono', 'Menlo', 'Consolas', monospace`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillStyle = labelColor;
        this.ctx.strokeStyle = outlineColor;
        this.ctx.lineWidth = 2.5 / this.transform.zoom;

        // Get text width to position subscript
        const metrics = this.ctx.measureText(mainLabel);
        const textWidth = metrics.width;

        // Draw outline for main label
        this.ctx.strokeText(mainLabel, point.x - textWidth / 2, point.y - gap);
        // Draw main label
        this.ctx.fillText(mainLabel, point.x - textWidth / 2, point.y - gap);

        // Draw subscript if present
        if (subscript) {
          this.ctx.font = `bold ${subscriptFontSize}px 'Fira Mono', 'Menlo', 'Consolas', monospace`;
          this.ctx.textBaseline = 'top';
          // Position subscript directly adjacent to main label (minimal gap)
          const subscriptX = point.x - textWidth / 2 + textWidth + 0.5 / this.transform.zoom;
          const subscriptY = point.y - gap - 9 / this.transform.zoom;

          // Draw outline for subscript
          this.ctx.strokeText(subscript, subscriptX, subscriptY);
          // Draw subscript
          this.ctx.fillText(subscript, subscriptX, subscriptY);
        }
      }
      this.ctx.restore();
    }
    this.ctx.restore();
  }

  drawLine(line: Line, points: Map<string, Point>, isHighlighted: boolean = false) {
    const p1 = points.get(line.p1Id);
    const p2 = points.get(line.p2Id);
    if (!p1 || !p2) return;

    // Draw infinite extension (continuous, dull or highlighted)
    this.ctx.save();
    if (isHighlighted) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.globalAlpha = 0.4;
      this.ctx.lineWidth = 3 / this.transform.zoom;
    } else {
      this.ctx.strokeStyle = 'rgba(180,180,180,0.3)';
      this.ctx.lineWidth = 1.5 / this.transform.zoom;
    }
    this.ctx.setLineDash([]);

    // Calculate intersection with canvas bounds
    const { width, height } = this.ctx.canvas;
    // Direction vector
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    if (Math.abs(dx) < 1e-8 && Math.abs(dy) < 1e-8) {
      this.ctx.restore();
      return;
    }
    // Find two far points on the line that are well outside the canvas
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = dx / len;
    const uy = dy / len;
    const big = Math.max(width, height) * 2 / this.transform.zoom;
    const ex1 = p1.x - ux * big;
    const ey1 = p1.y - uy * big;
    const ex2 = p2.x + ux * big;
    const ey2 = p2.y + uy * big;
    this.ctx.beginPath();
    this.ctx.moveTo(ex1, ey1);
    this.ctx.lineTo(ex2, ey2);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw visible segment (solid)
    this.ctx.save();
    if (isHighlighted) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.lineWidth = 3 / this.transform.zoom;
    } else {
      this.ctx.strokeStyle = this.theme.elementStroke;
      this.ctx.lineWidth = 2 / this.transform.zoom;
    }
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawCircle(circle: Circle, points: Map<string, Point>, isHighlighted: boolean = false) {
    const center = points.get(circle.centerId);
    const radiusPoint = points.get(circle.radiusPointId);
    if (!center || !radiusPoint) return;

    const radius = distance(center, radiusPoint);

    this.ctx.save();
    if (isHighlighted) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.lineWidth = 3 / this.transform.zoom;
    } else {
      this.ctx.strokeStyle = this.theme.elementStroke;
      this.ctx.lineWidth = 2 / this.transform.zoom;
    }
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawPerpendicularBisector(bisector: PerpendicularBisector, points: Map<string, Point>, isHighlighted: boolean = false) {
    const p1 = points.get(bisector.p1Id);
    const p2 = points.get(bisector.p2Id);
    if (!p1 || !p2) return;

    // Calculate midpoint
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    // Direction vector from p1 to p2
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < 1e-8) return; // Points are too close

    // Perpendicular vector (rotated 90 degrees)
    const perpX = -dy / len;
    const perpY = dx / len;

    // Draw segment line (p1 to p2) as dotted
    this.ctx.save();
    this.ctx.strokeStyle = isHighlighted ? this.theme.highlight : 'rgba(180,180,180,0.5)';
    this.ctx.lineWidth = 1.5 / this.transform.zoom;
    this.ctx.setLineDash([4 / this.transform.zoom, 4 / this.transform.zoom]);
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw equal marks on segment (ticks to show equal halves)
    const tickPerp = 3 / this.transform.zoom;
    this.ctx.save();
    this.ctx.strokeStyle = isHighlighted ? this.theme.highlight : 'rgba(180,180,180,0.6)';
    this.ctx.lineWidth = 1 / this.transform.zoom;

    // Single tick mark at midpoint (perpendicular to segment)
    const tick1X = midX + perpX * tickPerp;
    const tick1Y = midY + perpY * tickPerp;
    const tick2X = midX - perpX * tickPerp;
    const tick2Y = midY - perpY * tickPerp;
    this.ctx.beginPath();
    this.ctx.moveTo(tick1X, tick1Y);
    this.ctx.lineTo(tick2X, tick2Y);
    this.ctx.stroke();

    // Second tick mark on left half
    const leftQuartX = (p1.x + midX) / 2;
    const leftQuartY = (p1.y + midY) / 2;
    const tick3X = leftQuartX + perpX * tickPerp;
    const tick3Y = leftQuartY + perpY * tickPerp;
    const tick4X = leftQuartX - perpX * tickPerp;
    const tick4Y = leftQuartY - perpY * tickPerp;
    this.ctx.beginPath();
    this.ctx.moveTo(tick3X, tick3Y);
    this.ctx.lineTo(tick4X, tick4Y);
    this.ctx.stroke();

    // Third tick mark on right half
    const rightQuartX = (midX + p2.x) / 2;
    const rightQuartY = (midY + p2.y) / 2;
    const tick5X = rightQuartX + perpX * tickPerp;
    const tick5Y = rightQuartY + perpY * tickPerp;
    const tick6X = rightQuartX - perpX * tickPerp;
    const tick6Y = rightQuartY - perpY * tickPerp;
    this.ctx.beginPath();
    this.ctx.moveTo(tick5X, tick5Y);
    this.ctx.lineTo(tick6X, tick6Y);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw perpendicular bisector line (infinite and solid)
    this.ctx.save();
    if (isHighlighted) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.globalAlpha = 0.4;
      this.ctx.lineWidth = 3 / this.transform.zoom;
    } else {
      this.ctx.strokeStyle = this.theme.elementStroke;
      this.ctx.lineWidth = 2 / this.transform.zoom;
    }
    this.ctx.setLineDash([]);

    // Calculate intersection with canvas bounds
    const { width, height } = this.ctx.canvas;
    const big = Math.max(width, height) * 2 / this.transform.zoom;
    const extStart1X = midX - perpX * big;
    const extStart1Y = midY - perpY * big;
    const extStart2X = midX + perpX * big;
    const extStart2Y = midY + perpY * big;

    this.ctx.beginPath();
    this.ctx.moveTo(extStart1X, extStart1Y);
    this.ctx.lineTo(extStart2X, extStart2Y);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw right angle indicator at midpoint
    const cornerSize = 8 / this.transform.zoom;
    const corner1X = midX + perpX * cornerSize;
    const corner1Y = midY + perpY * cornerSize;
    const corner2X = corner1X + (dx / len) * cornerSize;
    const corner2Y = corner1Y + (dy / len) * cornerSize;
    const corner3X = midX + (dx / len) * cornerSize;
    const corner3Y = midY + (dy / len) * cornerSize;

    this.ctx.save();
    this.ctx.strokeStyle = isHighlighted ? this.theme.highlight : 'rgba(180,180,180,0.7)';
    this.ctx.lineWidth = 1.5 / this.transform.zoom;
    this.ctx.beginPath();
    this.ctx.moveTo(corner1X, corner1Y);
    this.ctx.lineTo(corner2X, corner2Y);
    this.ctx.lineTo(corner3X, corner3Y);
    this.ctx.stroke();
    this.ctx.restore();
  }
  drawPerpendicularLine(perpLine: PerpendicularLine, points: Map<string, Point>, allElements: GeoElement[], isHighlighted: boolean = false) {
    const point = points.get(perpLine.pointId);
    if (!point) return;

    // Find the reference line (could be Line, PerpendicularBisector, or AngleBisector)
    const refElement = allElements.find(el => el.id === perpLine.referenceLineId);
    if (!refElement) return;

    // Create a map for the helper
    const elementsMap = new Map(allElements.map(e => [e.id, e]));
    // Add points to map
    points.forEach((p, id) => {
      if (!elementsMap.has(id)) elementsMap.set(id, p);
    });

    const refDir = getElementDirection(refElement.id, elementsMap);
    if (!refDir) return;

    const refDx = refDir.x;
    const refDy = refDir.y;
    const refLen = 1; // Normalized

    // We also need a point on the reference line to calculate intersection
    let refPoint: Point | undefined;
    if (refElement.type === 'line') {
      refPoint = points.get(refElement.p1Id);
    } else if (refElement.type === 'perpendicular_bisector') {
      const p1 = points.get(refElement.p1Id);
      const p2 = points.get(refElement.p2Id);
      if (p1 && p2) {
        refPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2, id: 'mid', type: 'point', isFixed: false };
      }
    } else if (refElement.type === 'angle_bisector') {
      refPoint = points.get(refElement.vertexId);
    } else if (refElement.type === 'perpendicular_line') {
      refPoint = points.get(refElement.pointId);
    }

    if (!refPoint) return;

    // Perpendicular direction (rotated 90 degrees)
    const perpX = -refDy / refLen;
    const perpY = refDx / refLen;

    // Draw the infinite perpendicular line through the point
    this.ctx.save();
    if (isHighlighted) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.globalAlpha = 0.4;
      this.ctx.lineWidth = 3 / this.transform.zoom;
    } else {
      this.ctx.strokeStyle = this.theme.elementStroke;
      this.ctx.lineWidth = 2 / this.transform.zoom;
    }
    this.ctx.setLineDash([]);

    // Calculate intersection with canvas bounds
    const { width, height } = this.ctx.canvas;
    const big = Math.max(width, height) * 2 / this.transform.zoom;
    const extStart1X = point.x - perpX * big;
    const extStart1Y = point.y - perpY * big;
    const extStart2X = point.x + perpX * big;
    const extStart2Y = point.y + perpY * big;

    this.ctx.beginPath();
    this.ctx.moveTo(extStart1X, extStart1Y);
    this.ctx.lineTo(extStart2X, extStart2Y);
    this.ctx.stroke();
    this.ctx.restore();

    // Find intersection point between reference line and perpendicular line
    // Reference line passes through p1 and p2 in direction (refDx, refDy)
    // Perpendicular line passes through point in direction (perpX, perpY)
    // We need to find where they intersect

    // Parametric equations:
    // Ref line: (p1.x + t1 * refDx, p1.y + t1 * refDy)
    // Perp line: (point.x + t2 * perpX, point.y + t2 * perpY)

    // Solve: p1.x + t1 * refDx = point.x + t2 * perpX
    //        p1.y + t1 * refDy = point.y + t2 * perpY

    const denom = refDx * perpY - refDy * perpX;
    if (Math.abs(denom) > 1e-8) {
      const t1 = ((point.x - refPoint.x) * perpY - (point.y - refPoint.y) * perpX) / denom;
      const intersectX = refPoint.x + t1 * refDx;
      const intersectY = refPoint.y + t1 * refDy;

      // Draw small right angle indicator at the intersection point
      const cornerSize = 8 / this.transform.zoom; // Increased from 6
      const corner1X = intersectX + perpX * cornerSize;
      const corner1Y = intersectY + perpY * cornerSize;
      const corner2X = corner1X + (refDx / refLen) * cornerSize;
      const corner2Y = corner1Y + (refDy / refLen) * cornerSize;
      const corner3X = intersectX + (refDx / refLen) * cornerSize;
      const corner3Y = intersectY + (refDy / refLen) * cornerSize;

      this.ctx.save();
      this.ctx.strokeStyle = isHighlighted ? this.theme.highlight : 'rgba(150,150,150,0.8)'; // More visible
      this.ctx.lineWidth = 1.8 / this.transform.zoom; // Slightly thicker
      this.ctx.beginPath();
      this.ctx.moveTo(corner1X, corner1Y);
      this.ctx.lineTo(corner2X, corner2Y);
      this.ctx.lineTo(corner3X, corner3Y);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  drawAngleBisector(bisector: AngleBisector, points: Map<string, Point>, allElements: GeoElement[] = [], isHighlighted: boolean = false) {
    const vertex = points.get(bisector.vertexId);
    const p1 = points.get(bisector.p1Id);
    const p2 = points.get(bisector.p2Id);
    if (!vertex || !p1 || !p2) return;

    // Ray 1: vertex → p1
    const ray1X = p1.x - vertex.x;
    const ray1Y = p1.y - vertex.y;
    const ray1Len = Math.hypot(ray1X, ray1Y);

    // Ray 2: vertex → p2
    const ray2X = p2.x - vertex.x;
    const ray2Y = p2.y - vertex.y;
    const ray2Len = Math.hypot(ray2X, ray2Y);

    if (ray1Len < 1e-8 || ray2Len < 1e-8) return;

    // Normalize rays
    const ray1NormX = ray1X / ray1Len;
    const ray1NormY = ray1Y / ray1Len;
    const ray2NormX = ray2X / ray2Len;
    const ray2NormY = ray2Y / ray2Len;

    // Bisector direction: average of normalized rays
    const bisectorX = ray1NormX + ray2NormX;
    const bisectorY = ray1NormY + ray2NormY;
    const bisectorLen = Math.hypot(bisectorX, bisectorY);

    if (bisectorLen < 1e-8) return; // Degenerate case (opposite rays)

    // Normalize bisector direction
    const bisectorNormX = bisectorX / bisectorLen;
    const bisectorNormY = bisectorY / bisectorLen;

    // Draw the infinite angle bisector line through the vertex
    this.ctx.save();
    if (isHighlighted) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.globalAlpha = 0.4;
      this.ctx.lineWidth = 3 / this.transform.zoom;
    } else {
      this.ctx.strokeStyle = this.theme.elementStroke;
      this.ctx.lineWidth = 2 / this.transform.zoom;
    }
    this.ctx.setLineDash([]);

    // Extend line far beyond vertex in both directions
    const { width, height } = this.ctx.canvas;
    const big = Math.max(width, height) * 2 / this.transform.zoom;
    const extStart1X = vertex.x - bisectorNormX * big;
    const extStart1Y = vertex.y - bisectorNormY * big;
    const extStart2X = vertex.x + bisectorNormX * big;
    const extStart2Y = vertex.y + bisectorNormY * big;

    this.ctx.beginPath();
    this.ctx.moveTo(extStart1X, extStart1Y);
    this.ctx.lineTo(extStart2X, extStart2Y);
    this.ctx.stroke();
    this.ctx.restore();

    // Draw dotted reference rays from vertex to p1 and p2 (if no lines exist)
    this.ctx.save();
    this.ctx.strokeStyle = 'rgba(180,180,180,0.5)';
    this.ctx.lineWidth = 1.2 / this.transform.zoom;
    this.ctx.setLineDash([4 / this.transform.zoom, 4 / this.transform.zoom]);

    // Check if line from vertex to p1 exists
    const line1Exists = allElements.some(el =>
      el.type === 'line' &&
      ((el.p1Id === bisector.vertexId && el.p2Id === bisector.p1Id) ||
        (el.p1Id === bisector.p1Id && el.p2Id === bisector.vertexId))
    );

    if (!line1Exists) {
      // Draw dotted ray from vertex to p1
      this.ctx.beginPath();
      this.ctx.moveTo(vertex.x, vertex.y);
      this.ctx.lineTo(p1.x, p1.y);
      this.ctx.stroke();
    }

    // Check if line from vertex to p2 exists
    const line2Exists = allElements.some(el =>
      el.type === 'line' &&
      ((el.p1Id === bisector.vertexId && el.p2Id === bisector.p2Id) ||
        (el.p1Id === bisector.p2Id && el.p2Id === bisector.vertexId))
    );

    if (!line2Exists) {
      // Draw dotted ray from vertex to p2
      this.ctx.beginPath();
      this.ctx.moveTo(vertex.x, vertex.y);
      this.ctx.lineTo(p2.x, p2.y);
      this.ctx.stroke();
    }

    this.ctx.restore();

    // Draw angle marks at vertex to show equal angles
    // Draw arc marks between the two rays
    this.ctx.save();
    this.ctx.strokeStyle = isHighlighted ? this.theme.highlight : 'rgba(180,180,180,0.7)';
    this.ctx.lineWidth = 1.2 / this.transform.zoom;
    this.ctx.setLineDash([]);

    // Calculate angles of rays and bisector
    const ray1Angle = Math.atan2(ray1NormY, ray1NormX);
    const ray2Angle = Math.atan2(ray2NormY, ray2NormX);
    const bisectorAngle = Math.atan2(bisectorNormY, bisectorNormX);

    // Arc radius
    const arcRadius = 12 / this.transform.zoom;

    // Normalize angle difference to [-PI, PI] range
    const normalizeAngleDiff = (from: number, to: number): number => {
      let diff = to - from;
      while (diff > Math.PI) diff -= 2 * Math.PI;
      while (diff < -Math.PI) diff += 2 * Math.PI;
      return diff;
    };

    const angle1To2 = normalizeAngleDiff(ray1Angle, ray2Angle);

    // Draw arcs based on which angle is smaller
    const drawSmallAngle = Math.abs(angle1To2) < Math.PI;

    if (drawSmallAngle) {
      // Draw between the two rays directly (smaller angle)
      if (angle1To2 > 0) {
        // ray2 is counterclockwise from ray1
        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, ray1Angle, bisectorAngle, false);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, bisectorAngle, ray2Angle, false);
        this.ctx.stroke();
      } else {
        // ray2 is clockwise from ray1
        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, ray1Angle, bisectorAngle, true);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, bisectorAngle, ray2Angle, true);
        this.ctx.stroke();
      }
    } else {
      // Draw the reflex angle (larger angle, >180°)
      if (angle1To2 > 0) {
        // ray2 is counterclockwise from ray1 (but >180°), so bisect the other way
        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, ray1Angle, bisectorAngle, true);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, bisectorAngle, ray2Angle, true);
        this.ctx.stroke();
      } else {
        // ray2 is clockwise from ray1 (but >180°), so bisect the other way
        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, ray1Angle, bisectorAngle, false);
        this.ctx.stroke();

        this.ctx.beginPath();
        this.ctx.arc(vertex.x, vertex.y, arcRadius, bisectorAngle, ray2Angle, false);
        this.ctx.stroke();
      }
    }

    this.ctx.restore();
  }

  drawSnapIndicator(pos: { x: number; y: number }) {
    this.ctx.save();
    this.ctx.strokeStyle = this.theme.pointHovered;
    // Scale snap indicator inversely with zoom to maintain constant screen size
    this.ctx.lineWidth = 1 / this.transform.zoom;
    const dashSize = 5 / this.transform.zoom;
    this.ctx.setLineDash([dashSize, dashSize]);
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, 10 / this.transform.zoom, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawIntersectionPreview(pos: { x: number; y: number }, isHovered: boolean) {
    this.ctx.save();

    // Draw base indicator
    this.ctx.strokeStyle = this.theme.highlight;
    this.ctx.globalAlpha = 0.6;
    this.ctx.lineWidth = 1.5 / this.transform.zoom;
    this.ctx.setLineDash([]);
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, 8 / this.transform.zoom, 0, Math.PI * 2);
    this.ctx.stroke();

    // Draw larger highlight if hovered
    if (isHovered) {
      this.ctx.strokeStyle = this.theme.highlight;
      this.ctx.globalAlpha = 0.8;
      this.ctx.lineWidth = 2 / this.transform.zoom;
      this.ctx.beginPath();
      this.ctx.arc(pos.x, pos.y, 15 / this.transform.zoom, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    this.ctx.restore();
  }

  render(
    elements: GeoElement[],
    hoveredId: string | null,
    hoveredElementId: string | null = null,
    selectedReferenceLineId: string | null = null
  ) {
    this.applyTransform();
    const points = new Map<string, Point>();
    const lines: Line[] = [];
    const circles: Circle[] = [];
    const bisectors: PerpendicularBisector[] = [];
    const perpLines: PerpendicularLine[] = [];
    const angleBisectors: AngleBisector[] = [];

    elements.forEach(el => {
      if (el.type === 'point') points.set(el.id, el);
      else if (el.type === 'line') lines.push(el);
      else if (el.type === 'circle') circles.push(el);
      else if (el.type === 'perpendicular_bisector') bisectors.push(el);
      else if (el.type === 'perpendicular_line') perpLines.push(el);
      else if (el.type === 'angle_bisector') angleBisectors.push(el);
    });

    // Draw non-highlighted elements first
    lines.forEach(line => {
      if (line.id !== hoveredElementId && line.id !== selectedReferenceLineId) {
        this.drawLine(line, points, false);
      }
    });
    circles.forEach(circle => {
      if (circle.id !== hoveredElementId) {
        this.drawCircle(circle, points, false);
      }
    });
    bisectors.forEach(bisector => {
      if (bisector.id !== hoveredElementId && bisector.id !== selectedReferenceLineId) {
        this.drawPerpendicularBisector(bisector, points, false);
      }
    });
    perpLines.forEach(perpLine => {
      if (perpLine.id !== hoveredElementId && perpLine.id !== selectedReferenceLineId) {
        this.drawPerpendicularLine(perpLine, points, elements, false);
      }
    });
    angleBisectors.forEach(bisector => {
      if (bisector.id !== hoveredElementId && bisector.id !== selectedReferenceLineId) {
        this.drawAngleBisector(bisector, points, elements, false);
      }
    });

    // Draw highlighted elements last (on top)
    lines.forEach(line => {
      if (line.id === hoveredElementId || line.id === selectedReferenceLineId) {
        this.drawLine(line, points, true);
      }
    });
    circles.forEach(circle => {
      if (circle.id === hoveredElementId) {
        this.drawCircle(circle, points, true);
      }
    });
    bisectors.forEach(bisector => {
      if (bisector.id === hoveredElementId || bisector.id === selectedReferenceLineId) {
        this.drawPerpendicularBisector(bisector, points, true);
      }
    });
    perpLines.forEach(perpLine => {
      if (perpLine.id === hoveredElementId || perpLine.id === selectedReferenceLineId) {
        this.drawPerpendicularLine(perpLine, points, elements, true);
      }
    });
    angleBisectors.forEach(bisector => {
      if (bisector.id === hoveredElementId || bisector.id === selectedReferenceLineId) {
        this.drawAngleBisector(bisector, points, elements, true);
      }
    });

    points.forEach(point => this.drawPoint(point, point.id === hoveredId));
  }
}