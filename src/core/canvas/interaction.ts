import type { Vec2, GeoElement, Point, Line, Circle } from '../geometry/types';
import { findSnapTarget } from '../geometry/utils';

export interface InteractionState {
  isDragging: boolean;
  dragStart: Vec2 | null;
  selectedElementId: string | null;
  hoveredElementId: string | null;
}

export class CanvasInteractionHandler {
  private state: InteractionState = {
    isDragging: false,
    dragStart: null,
    selectedElementId: null,
    hoveredElementId: null,
  };

  constructor(
    private elements: GeoElement[],
    private onAddElement: (el: GeoElement) => void,
    private onUpdateElement: (id: string, updates: Partial<GeoElement>) => void,
    private onDeleteElement: (id: string) => void,
    private snapRadius: number = 15
  ) {}

  handleMouseMove(mousePos: Vec2): { snapTarget: Vec2 | null; hoveredId: string | null } {
    const points = this.elements.filter(el => el.type === 'point') as Point[];
    const lines = this.elements.filter(el => el.type === 'line') as Line[];
    const circles = this.elements.filter(el => el.type === 'circle') as Circle[];

    const snapTarget = findSnapTarget(
      mousePos,
      points,
      lines,
      circles,
      new Map(this.elements.map(el => [el.id, el])),
      this.snapRadius
    );

    // Find hovered element
    const hoveredPoint = points.find(p => 
      Math.hypot(p.x - mousePos.x, p.y - mousePos.y) < 8
    );
    
    return { snapTarget, hoveredId: hoveredPoint?.id || null };
  }

  handleMouseDown(mousePos: Vec2, tool: string, snapTarget: Vec2 | null): void {
    const targetPos = snapTarget || mousePos;

    if (tool === 'select') {
      // Check if clicking a point to start drag
      const points = this.elements.filter(el => el.type === 'point') as Point[];
      const clickedPoint = points.find(p => 
        Math.hypot(p.x - mousePos.x, p.y - mousePos.y) < 8
      );
      
      if (clickedPoint) {
        this.state.isDragging = true;
        this.state.dragStart = mousePos;
        this.state.selectedElementId = clickedPoint.id;
      }
    }
  }

  handleMouseUp(mousePos: Vec2, tool: string, snapTarget: Vec2 | null): void {
    if (tool === 'select' && this.state.isDragging) {
      this.state.isDragging = false;
      this.state.dragStart = null;
      this.state.selectedElementId = null;
    }
  }

  handleMouseDrag(currentPos: Vec2): void {
    if (!this.state.isDragging || !this.state.selectedElementId) return;

    const element = this.elements.find(el => el.id === this.state.selectedElementId);
    if (element?.type === 'point') {
      this.onUpdateElement(element.id, { x: currentPos.x, y: currentPos.y });
    }
  }

  handleDelete(key: string, selectedId: string | null): void {
    if (key === 'Delete' || key === 'Backspace') {
      if (selectedId) {
        this.onDeleteElement(selectedId);
      }
    }
  }

  getState(): InteractionState {
    return { ...this.state };
  }

  reset(): void {
    this.state = {
      isDragging: false,
      dragStart: null,
      selectedElementId: null,
      hoveredElementId: null,
    };
  }
}