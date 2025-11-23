import type { GeoElement, Point, Line, Circle, PerpendicularBisector } from '../geometry/types';
import { distance } from '../geometry/utils';

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

  render(elements: GeoElement[], hoveredId: string | null, hoveredElementId: string | null = null) {
    this.applyTransform();
    const points = new Map<string, Point>();
    const lines: Line[] = [];
    const circles: Circle[] = [];
    const bisectors: PerpendicularBisector[] = [];

    elements.forEach(el => {
      if (el.type === 'point') points.set(el.id, el);
      else if (el.type === 'line') lines.push(el);
      else if (el.type === 'circle') circles.push(el);
      else if (el.type === 'perpendicular_bisector') bisectors.push(el);
    });

    lines.forEach(line => this.drawLine(line, points, line.id === hoveredElementId));
    circles.forEach(circle => this.drawCircle(circle, points, circle.id === hoveredElementId));
    bisectors.forEach(bisector => this.drawPerpendicularBisector(bisector, points, bisector.id === hoveredElementId));
    points.forEach(point => this.drawPoint(point, point.id === hoveredId));
  }
}