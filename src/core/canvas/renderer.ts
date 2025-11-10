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
  },
  dark: {
    canvas: '#0f172a', // slate-900
    elementStroke: '#f8fafc',  // slate-50
    elementFill: 'transparent',
    point: '#60a5fa',  // blue-400
    pointHovered: '#f87171', // red-400
    grid: '#1e293b',   // slate-800
  }
};

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;
  private theme = THEME.dark; // Force dark for now

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

  clear(width: number, height: number) {
    this.ctx.fillStyle = this.theme.canvas;
    this.ctx.fillRect(0, 0, width, height);
  }

  drawGrid(width: number, height: number, gridSize: number = 20) {
    this.ctx.save();
    this.ctx.strokeStyle = this.theme.grid;
    this.ctx.lineWidth = 1;

    for (let x = 0; x < width; x += gridSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, height);
      this.ctx.stroke();
    }

    for (let y = 0; y < height; y += gridSize) {
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
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, Math.PI * 2);
    this.ctx.fill();
    
    // White border for visibility
    this.ctx.strokeStyle = this.theme.canvas;
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawLine(line: Line, points: Map<string, Point>) {
    const p1 = points.get(line.p1Id);
    const p2 = points.get(line.p2Id);
    if (!p1 || !p2) return;

    this.ctx.save();
    this.ctx.strokeStyle = this.theme.elementStroke;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(p1.x, p1.y);
    this.ctx.lineTo(p2.x, p2.y);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawCircle(circle: Circle, points: Map<string, Point>) {
    const center = points.get(circle.centerId);
    const radiusPoint = points.get(circle.radiusPointId);
    if (!center || !radiusPoint) return;

    const radius = distance(center, radiusPoint);

    this.ctx.save();
    this.ctx.strokeStyle = this.theme.elementStroke;
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawSnapIndicator(pos: { x: number; y: number }) {
    this.ctx.save();
    this.ctx.strokeStyle = this.theme.pointHovered;
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.arc(pos.x, pos.y, 10, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  render(elements: GeoElement[], hoveredId: string | null) {
    const points = new Map<string, Point>();
    const lines: Line[] = [];
    const circles: Circle[] = [];

    elements.forEach(el => {
      if (el.type === 'point') points.set(el.id, el);
      else if (el.type === 'line') lines.push(el);
      else circles.push(el);
    });

    lines.forEach(line => this.drawLine(line, points));
    circles.forEach(circle => this.drawCircle(circle, points));
    points.forEach(point => this.drawPoint(point, point.id === hoveredId));
  }
}