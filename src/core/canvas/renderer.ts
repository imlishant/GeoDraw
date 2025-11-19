import type { GeoElement, Point, Line, Circle } from '../geometry/types';
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
      // Font size is constant (not scaled by zoom)
      const fontSize = 18 / this.transform.zoom;
      // Use Fira Mono, fallback to monospace
      this.ctx.font = `bold ${fontSize}px 'Fira Mono', 'Menlo', 'Consolas', monospace`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'bottom';
      // Theme-adaptive label color: blue for light, orange for dark
      const isDark = document.documentElement.classList.contains('dark');
      const labelColor = isDark ? '#ffb347' : '#1a4fff';
      const outlineColor = isDark ? '#222' : '#fff';
      this.ctx.fillStyle = labelColor;
      this.ctx.strokeStyle = outlineColor;
      this.ctx.lineWidth = 2.5 / this.transform.zoom;
      // Slightly smaller gap for better appearance
      const gap = radius + 6 / this.transform.zoom;
      // Draw outline for readability
      this.ctx.strokeText(point.label, point.x, point.y - gap);
      // Draw label text
      this.ctx.fillText(point.label, point.x, point.y - gap);
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

    elements.forEach(el => {
      if (el.type === 'point') points.set(el.id, el);
      else if (el.type === 'line') lines.push(el);
      else circles.push(el);
    });

    lines.forEach(line => this.drawLine(line, points, line.id === hoveredElementId));
    circles.forEach(circle => this.drawCircle(circle, points, circle.id === hoveredElementId));
    points.forEach(point => this.drawPoint(point, point.id === hoveredId));
  }
}