import { useRef, useEffect, useState } from 'react';
import { useGeometryStore } from '../store/useGeometryStore';
import { CanvasRenderer } from '../core/canvas/renderer';
import type { Vec2, Point, Line, Circle } from '../core/geometry/types';
import { generateId } from '../core/geometry/utils';

// Snapping radius in pixels for magnetic point snapping
const SNAP_RADIUS = 15;

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
  
  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

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

    // Handle mouse wheel zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Calculate zoom delta
      const delta = -Math.sign(e.deltaY) * 0.1;
      const newZoom = Math.min(Math.max(zoom + delta, 0.1), 10);
      
      // Zoom toward mouse position
      const scale = newZoom / zoom;
      const newPanX = mouseX - (mouseX - pan.x) * scale;
      const newPanY = mouseY - (mouseY - pan.y) * scale;
      
      setZoom(newZoom);
      setPan({ x: newPanX, y: newPanY });
    };
    
    canvas.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, pan]);

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

    renderer.setTransform(zoom, pan.x, pan.y);
    renderer.clear(canvasSize.width, canvasSize.height);
    renderer.drawGrid(canvasSize.width, canvasSize.height);
    
    if (snapTarget && isDrawing) {
      renderer.drawSnapIndicator(snapTarget);
    }
    
    renderer.render(elements, null);
  }, [elements, canvasSize, snapTarget, isDrawing, zoom, pan]);

  // Mouse handlers
  const handleMouseMove = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    // Handle panning
    if (isPanning && lastMousePosRef.current) {
      const dx = e.clientX - lastMousePosRef.current.x;
      const dy = e.clientY - lastMousePosRef.current.y;
      setPan(prev => ({
        x: prev.x + dx,
        y: prev.y + dy
      }));
    }
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    
    // Convert screen coordinates to world coordinates
    const worldX = (screenX - pan.x) / zoom;
    const worldY = (screenY - pan.y) / zoom;
    setMousePos({ x: worldX, y: worldY });

    // Simple snap detection
    const points = elements.filter(el => el.type === 'point') as Point[];
    const snap = findSnapTarget({ x: worldX, y: worldY }, points);
    setSnapTarget(snap);
  };

  // Only snap to existing points within SNAP_RADIUS; no grid snap
  const findSnapTarget = (mouse: Vec2, points: Point[]): Vec2 | null => {
    for (const point of points) {
      const dist = Math.hypot(point.x - mouse.x, point.y - mouse.y);
      if (dist < SNAP_RADIUS) {
        return { x: point.x, y: point.y };
      }
    }
    return null;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    // Right-click to start panning
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      return;
    }
    
    // Use snapped position if available, otherwise use exact mouse position (rounded)
    const pos = snapTarget || {
      x: Math.round(mousePos.x * 100) / 100,
      y: Math.round(mousePos.y * 100) / 100
    };

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

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
      setIsPanning(false);
      lastMousePosRef.current = null;
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu on right-click
  };

return (
    <canvas
      ref={canvasRef}
      className="w-screen h-screen bg-white dark:bg-gray-900 cursor-crosshair block"
  onMouseMove={handleMouseMove}
  onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onContextMenu={handleContextMenu}
    />
  );
}