import type { GeoElement, Point, Line, Circle } from '../geometry/types';
import { distance } from '../geometry/utils';

export class CanvasRenderer {
  private ctx: CanvasRenderingContext2D;

  constructor(canvas: HTMLCanvasElement) {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas not supported');
    this.ctx = context;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
  }

  clear(width: number, height: number) {
    this.ctx.clearRect(0, 0, width, height);
  }

  drawGrid(width: number, height: number, gridSize: number = 20) {
    this.ctx.save();
    this.ctx.strokeStyle = '#e5e7eb'; // Tail gray-200
    this.ctx.lineWidth = 0.5;

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
    this.ctx.fillStyle = isHovered ? '#ef4444' : '#3b82f6'; // Red when hovered
    this.ctx.beginPath();
    this.ctx.arc(point.x, point.y, isHovered ? 6 : 4, 0, Math.PI * 2);
    this.ctx.fill();
    
    // White border
    this.ctx.strokeStyle = 'white';
    this.ctx.lineWidth = 2;
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawLine(line: Line, points: Map<string, Point>) {
    const p1 = points.get(line.p1Id);
    const p2 = points.get(line.p2Id);
    if (!p1 || !p2) return;

    this.ctx.save();
    this.ctx.strokeStyle = '#1f2937'; // Gray-800
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
    this.ctx.strokeStyle = '#1f2937';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.stroke();
    this.ctx.restore();
  }

  drawSnapIndicator(pos: { x: number; y: number }) {
    this.ctx.save();
    this.ctx.strokeStyle = '#ef4444';
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

    // Separate elements by type
    elements.forEach(el => {
      if (el.type === 'point') points.set(el.id, el);
      else if (el.type === 'line') lines.push(el);
      else circles.push(el);
    });

    // Draw in proper order
    lines.forEach(line => this.drawLine(line, points));
    circles.forEach(circle => this.drawCircle(circle, points));
    points.forEach(point => this.drawPoint(point, point.id === hoveredId));
  }
}