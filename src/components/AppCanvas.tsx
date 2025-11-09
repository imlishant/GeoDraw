import { useRef, useEffect, useState } from 'react';
import { useGeometryStore } from '../store/useGeometryStore';
import { CanvasRenderer } from '../core/canvas/renderer';
import type { Vec2, Point, Line, Circle } from '../core/geometry/types';
import { generateId } from '../core/geometry/utils';

export default function AppCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  
  const store = useGeometryStore();
  const elements = store.elements;
  const selectedTool = store.selectedTool;
  const isDrawing = store.isDrawing;
  const tempData = store.tempData;
  
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [mousePos, setMousePos] = useState<Vec2>({ x: 0, y: 0 });
  const [snapTarget, setSnapTarget] = useState<Vec2 | null>(null);

  // Initialize canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      setCanvasSize({ width: rect.width, height: rect.height });
    };

    resize();
    window.addEventListener('resize', resize);
    rendererRef.current = new CanvasRenderer(canvas);

    return () => window.removeEventListener('resize', resize);
  }, []);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const selectedId = useGeometryStore.getState().selectedElementId;
        if (selectedId) {
          store.removeElement(selectedId);
          store.setSelectedTool('select');
        }
      }
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          store.undo();
        }
        if (e.key === 'y' || (e.shiftKey && e.key === 'Z')) {
          e.preventDefault();
          store.redo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [store]);

  // Update store with mouse position
  useEffect(() => {
    store.updateMousePosition(mousePos, snapTarget);
  }, [mousePos, snapTarget]);

  // Render loop
  useEffect(() => {
    const renderer = rendererRef.current;
    if (!renderer) return;

    renderer.clear(canvasSize.width, canvasSize.height);
    renderer.drawGrid(canvasSize.width, canvasSize.height);
    
    if (snapTarget && isDrawing) {
      renderer.drawSnapIndicator(snapTarget);
    }
    
    renderer.render(elements, null);
  }, [elements, canvasSize, snapTarget, isDrawing]);

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    // Simple snap detection
    const points = elements.filter(el => el.type === 'point') as Point[];
    const snap = findSnapTarget({ x, y }, points);
    setSnapTarget(snap);
  };

  const findSnapTarget = (mouse: Vec2, points: Point[]): Vec2 | null => {
    const snapRadius = 15;
    for (const point of points) {
      const dist = Math.hypot(point.x - mouse.x, point.y - mouse.y);
      if (dist < snapRadius) {
        return { x: point.x, y: point.y };
      }
    }
    
    // Grid snap
    const gridSize = 20;
    const gridX = Math.round(mouse.x / gridSize) * gridSize;
    const gridY = Math.round(mouse.y / gridSize) * gridSize;
    if (Math.hypot(gridX - mouse.x, gridY - mouse.y) < snapRadius) {
      return { x: gridX, y: gridY };
    }
    
    return null;
  };

  const handleMouseDown = () => {
    const pos = snapTarget || mousePos;

    if (selectedTool === 'point') {
      const point: Point = {
        id: generateId(),
        type: 'point',
        x: pos.x,
        y: pos.y,
        isFixed: true
      };
      store.addElement(point);
    } else if (selectedTool === 'line') {
      if (!isDrawing) {
        const startPoint: Point = {
          id: generateId(),
          type: 'point',
          x: pos.x,
          y: pos.y,
          isFixed: true
        };
        store.startConstruction({ p1Id: startPoint.id });
        store.addElement(startPoint);
      } else {
        const endPoint: Point = {
          id: generateId(),
          type: 'point',
          x: pos.x,
          y: pos.y,
          isFixed: true
        };
        
        const p1 = elements.find(el => el.id === tempData.p1Id) as Point;
        if (p1) {
          store.addElement(endPoint);
          const line: Line = {
            id: generateId(),
            type: 'line',
            p1Id: p1.id,
            p2Id: endPoint.id,
            infinite: false
          };
          store.addElement(line);
        }
        store.completeConstruction();
      }
    } else if (selectedTool === 'circle') {
      if (!isDrawing) {
        const centerPoint: Point = {
          id: generateId(),
          type: 'point',
          x: pos.x,
          y: pos.y,
          isFixed: true
        };
        store.startConstruction({ centerId: centerPoint.id });
        store.addElement(centerPoint);
      } else {
        const radiusPoint: Point = {
          id: generateId(),
          type: 'point',
          x: pos.x,
          y: pos.y,
          isFixed: true
        };
        
        const center = elements.find(el => el.id === tempData.centerId) as Point;
        if (center) {
          store.addElement(radiusPoint);
          const circle: Circle = {
            id: generateId(),
            type: 'circle',
            centerId: center.id,
            radiusPointId: radiusPoint.id
          };
          store.addElement(circle);
        }
        store.completeConstruction();
      }
    }
  };

return (
    <canvas
      ref={canvasRef}
      className="w-screen h-screen bg-white dark:bg-gray-900 cursor-crosshair block"
  onMouseMove={handleMouseMove}
  onMouseDown={handleMouseDown}
    />
  );
}