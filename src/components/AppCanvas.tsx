import { useRef, useEffect, useState } from 'react';
import { useGeometryStore } from '../store/useGeometryStore';
import { CanvasRenderer } from '../core/canvas/renderer';
import type { Vec2, Point, Line, Circle, GeoElement } from '../core/geometry/types';
import { generateId } from '../core/geometry/utils';
import LabelTool, { handleLabelClick } from './LabelTool';
import { handlePerpendicularBisectorClick } from './PerpendicularBisectorTool';
import PerpendicularBisectorTool from './PerpendicularBisectorTool';
import { findIntersections, type IntersectionPoint } from '../core/geometry/intersections';

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
  
  // Intersection tool state
  const [previewIntersections, setPreviewIntersections] = useState<{ x: number; y: number }[]>([]);
  const [hoveredIntersectionIndex, setHoveredIntersectionIndex] = useState<number | null>(null);
  
  // Select/Move tool state
  const [draggedPointId, setDraggedPointId] = useState<string | null>(null);
  const [draggedPointPos, setDraggedPointPos] = useState<Vec2 | null>(null);
  const [dragOriginalPos, setDragOriginalPos] = useState<Vec2 | null>(null);

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

  // Clear intersection selection when tool changes
  useEffect(() => {
    if (selectedTool !== 'intersect') {
      setPreviewIntersections([]);
      setHoveredIntersectionIndex(null);
    }
  }, [selectedTool]);

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
    
    // Create modified elements array if dragging a point or drawing with temp points
    let renderElements = elements;
    
    // If dragging a point with select tool, show temp position
    if (draggedPointId && draggedPointPos) {
      renderElements = elements.map(el => {
        if (el.id === draggedPointId && el.type === 'point') {
          return { ...el, x: draggedPointPos.x, y: draggedPointPos.y };
        }
        return el;
      });
    }
    
    // If drawing a line or circle, add temp first point to render
    if (isDrawing && tempData) {
      const tempPoint = (tempData.p1 || tempData.center) as Point | undefined;
      if (tempPoint) {
        renderElements = [...renderElements, tempPoint];
      }
    }
    
    renderer.render(renderElements, null, store.hoveredElementId);
    
    // Render preview intersections if in intersect tool mode
    if (selectedTool === 'intersect' && previewIntersections.length > 0) {
      previewIntersections.forEach((intersection, index) => {
        const isHovered = index === hoveredIntersectionIndex;
        renderer.drawIntersectionPreview(intersection, isHovered);
      });
    }
  }, [elements, canvasSize, snapTarget, isDrawing, zoom, pan, store.hoveredElementId, selectedTool, previewIntersections, hoveredIntersectionIndex, draggedPointId, draggedPointPos, tempData]);

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

    // Handle point dragging with select tool
    if (selectedTool === 'select' && draggedPointId) {
      // Update temporary drag position (doesn't affect store until mouseUp)
      setDraggedPointPos({ x: worldX, y: worldY });
      return;
    }

    // Simple snap detection
    const points = elements.filter(el => el.type === 'point') as Point[];
    const snap = findSnapTarget({ x: worldX, y: worldY }, points);
    setSnapTarget(snap);
    
    // Update hovered element for highlighting
    if (selectedTool === 'intersect' || selectedTool === 'select') {
      const hoveredEl = findClickedElement({ x: worldX, y: worldY });
      store.setHoveredElementId(hoveredEl?.id || null);
      
      // In intersect mode, show ALL intersections between hovered element and all other elements
      if (selectedTool === 'intersect' && hoveredEl && hoveredEl.type !== 'point') {
        const pointsMap = new Map<string, Point>();
        elements.forEach(el => {
          if (el.type === 'point') pointsMap.set(el.id, el);
        });
        
        // Find all intersections with other elements
        const allIntersections: IntersectionPoint[] = [];
        elements.forEach(el => {
          if (el.type !== 'point' && el.id !== hoveredEl.id) {
            const ints = findIntersections(hoveredEl, el, pointsMap);
            allIntersections.push(...ints);
          }
        });
        
        setPreviewIntersections(allIntersections);
        
        // Find which intersection is closest to mouse
        if (allIntersections.length > 0) {
          let closestIndex = 0;
          let closestDist = Infinity;
          allIntersections.forEach((int, idx) => {
            const dist = Math.hypot(int.x - worldX, int.y - worldY);
            if (dist < closestDist) {
              closestDist = dist;
              closestIndex = idx;
            }
          });
          // Only highlight if within reasonable distance (15px hit radius)
          if (closestDist < 15 / zoom) {
            setHoveredIntersectionIndex(closestIndex);
          } else {
            setHoveredIntersectionIndex(null);
          }
        } else {
          setHoveredIntersectionIndex(null);
        }
      } else {
        setPreviewIntersections([]);
        setHoveredIntersectionIndex(null);
      }
    } else {
      store.setHoveredElementId(null);
      setPreviewIntersections([]);
      setHoveredIntersectionIndex(null);
    }
  };

  // Only snap to existing points within SNAP_RADIUS; no grid snap
  const findSnapTarget = (mouse: Vec2, points: Point[]): Vec2 | null => {
    for (const point of points) {
      const dist = Math.hypot(point.x - mouse.x, point.y - mouse.y);
      if (dist < SNAP_RADIUS / zoom) {
        return { x: point.x, y: point.y };
      }
    }
    return null;
  };

  // Find which point is clicked for dragging (only free/fixed points)
  const findClickedPoint = (mouse: Vec2): Point | null => {
    const threshold = 10 / zoom;
    for (const el of elements) {
      if (el.type === 'point' && el.isFixed) { // Only drag man-made points
        const dist = Math.hypot(el.x - mouse.x, el.y - mouse.y);
        if (dist < threshold) {
          return el;
        }
      }
    }
    return null;
  };

  // Find which geometric element (line or circle) is clicked
  const findClickedElement = (mouse: Vec2): GeoElement | null => {
    const threshold = 10 / zoom; // Click threshold in world space
    
    // Check circles first
    for (const el of elements) {
      if (el.type === 'circle') {
        const center = elements.find(e => e.id === el.centerId) as Point;
        const radiusPoint = elements.find(e => e.id === el.radiusPointId) as Point;
        if (center && radiusPoint) {
          const radius = Math.hypot(radiusPoint.x - center.x, radiusPoint.y - center.y);
          const distToCenter = Math.hypot(mouse.x - center.x, mouse.y - center.y);
          if (Math.abs(distToCenter - radius) < threshold) {
            return el;
          }
        }
      }
    }
    
    // Check perpendicular bisectors
    for (const el of elements) {
      if (el.type === 'perpendicular_bisector') {
        const p1 = elements.find(e => e.id === el.p1Id) as Point;
        const p2 = elements.find(e => e.id === el.p2Id) as Point;
        if (p1 && p2) {
          // Calculate midpoint
          const bisectMidX = (p1.x + p2.x) / 2;
          const bisectMidY = (p1.y + p2.y) / 2;
          
          // Direction of segment line
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 1e-8) continue;
          
          // Perpendicular direction (rotated 90 degrees)
          const perpX = -dy / len;
          const perpY = dx / len;
          
          // Distance from mouse to perpendicular bisector line (infinite line through midpoint)
          // Using point-to-line distance formula: |ax + by + c| / sqrt(a^2 + b^2)
          // Line equation: perpY * (x - midX) - perpX * (y - midY) = 0
          const distToBisector = Math.abs(perpY * (mouse.x - bisectMidX) - perpX * (mouse.y - bisectMidY));
          
          if (distToBisector < threshold) {
            return el;
          }
        }
      }
    }
    
    // Check lines
    for (const el of elements) {
      if (el.type === 'line') {
        const p1 = elements.find(e => e.id === el.p1Id) as Point;
        const p2 = elements.find(e => e.id === el.p2Id) as Point;
        if (p1 && p2) {
          // Distance from point to line segment
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const len2 = dx * dx + dy * dy;
          if (len2 === 0) continue;
          
          // For lines, check the infinite extension (distance from point to infinite line)
          const distToInfiniteLine = Math.abs((dy * mouse.x - dx * mouse.y + p2.x * p1.y - p2.y * p1.x) / Math.sqrt(len2));
          
          if (distToInfiniteLine < threshold) {
            return el;
          }
        }
      }
    }
    
    return null;
  };

  // Helper: find existing point at (x, y) within epsilon
  const findExistingPoint = (x: number, y: number, epsilon = 1e-2) => {
    return (elements.find(
      el => el.type === 'point' && Math.hypot(el.x - x, el.y - y) < epsilon
    ) as Point | undefined);
  };



  const handleMouseDown = (e: React.MouseEvent) => {
    // Right-click to start panning
    if (e.button === 2) {
      e.preventDefault();
      setIsPanning(true);
      return;
    }
    
    // Handle select/move tool
    if (selectedTool === 'select') {
      // First, try to find a clicked point to drag
      const clickedPoint = findClickedPoint(mousePos);
      if (clickedPoint && clickedPoint.isFixed) {
        // Start dragging the point
        setDraggedPointId(clickedPoint.id);
        setDragOriginalPos({ x: clickedPoint.x, y: clickedPoint.y });
        setDraggedPointPos({ x: clickedPoint.x, y: clickedPoint.y });
        store.setSelectedElementId(clickedPoint.id);
        return;
      }
      
      // If no point, try to select any element (line, circle, perpendicular_bisector, etc.)
      const clickedElement = findClickedElement(mousePos);
      if (clickedElement) {
        store.setSelectedElementId(clickedElement.id);
      } else {
        store.setSelectedElementId(null);
      }
      // Allow panning (handled by right-click above)
      return;
    }
    
    // Handle intersection tool
    if (selectedTool === 'intersect') {
      // If user clicked near a preview intersection, create a permanent point there
      if (previewIntersections.length > 0 && hoveredIntersectionIndex !== null) {
        const intersection = previewIntersections[hoveredIntersectionIndex];
        
        // Check for existing point at intersection
        const existing = findExistingPoint(intersection.x, intersection.y, 1.5 / zoom);
        if (!existing) {
          // Create new intersection point
          const point: Point = {
            id: generateId(),
            type: 'point',
            x: intersection.x,
            y: intersection.y,
            isFixed: false // intersection points are derived, not fixed
          };
          store.addElement(point);
        }
        // Keep tool active - don't reset anything, ready for next intersection
      }
      return;
    }
    
    // Use snapped position if available, otherwise use exact mouse position (rounded)
    const pos = snapTarget || {
      x: Math.round(mousePos.x * 100) / 100,
      y: Math.round(mousePos.y * 100) / 100
    };

    if (selectedTool === 'point') {
      // Check if a point already exists at this position
      const existingPoint = findExistingPoint(pos.x, pos.y, 2 / zoom); // Small epsilon in world units
      if (existingPoint) {
        // Don't create duplicate - point already exists
        return;
      }
      
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
        // Check for existing point, or create new one
        let startPoint = findExistingPoint(pos.x, pos.y, 2 / zoom);
        const isNewPoint = !startPoint;
        
        if (!startPoint) {
          startPoint = {
            id: generateId(),
            type: 'point',
            x: pos.x,
            y: pos.y,
            isFixed: true
          };
        }
        
        // Store point in tempData, don't add to elements yet
        store.startConstruction({ 
          p1Id: startPoint.id, 
          p1: startPoint,
          p1IsNew: isNewPoint 
        });
      } else {
        // Check for existing point, or create new one
        let endPoint = findExistingPoint(pos.x, pos.y, 2 / zoom);
        const p1 = tempData.p1 as Point;
        const p1IsNew = tempData.p1IsNew as boolean;
        const isNewEndPoint = !endPoint;
        
        if (!endPoint) {
          endPoint = {
            id: generateId(),
            type: 'point',
            x: pos.x,
            y: pos.y,
            isFixed: true
          };
        }
        
        if (p1) {
          // Collect all new elements to add in one batch (single undo entry)
          const elementsToAdd: GeoElement[] = [];
          
          if (p1IsNew) {
            elementsToAdd.push(p1);
          }
          if (isNewEndPoint) {
            elementsToAdd.push(endPoint);
          }
          
          const line: Line = {
            id: generateId(),
            type: 'line',
            p1Id: p1.id,
            p2Id: endPoint.id,
            infinite: false
          };
          elementsToAdd.push(line);
          
          // Add all elements at once - creates single undo entry
          store.addElements(elementsToAdd);
        }
        store.completeConstruction();
      }
    } else if (selectedTool === 'circle') {
      if (!isDrawing) {
        // Check for existing point, or create new one
        let centerPoint = findExistingPoint(pos.x, pos.y, 2 / zoom);
        const isNewPoint = !centerPoint;
        
        if (!centerPoint) {
          centerPoint = {
            id: generateId(),
            type: 'point',
            x: pos.x,
            y: pos.y,
            isFixed: true
          };
        }
        
        // Store point in tempData, don't add to elements yet
        store.startConstruction({ 
          centerId: centerPoint.id,
          center: centerPoint,
          centerIsNew: isNewPoint
        });
      } else {
        // Check for existing point, or create new one
        let radiusPoint = findExistingPoint(pos.x, pos.y, 2 / zoom);
        const center = tempData.center as Point;
        const centerIsNew = tempData.centerIsNew as boolean;
        const isNewRadiusPoint = !radiusPoint;
        
        if (!radiusPoint) {
          radiusPoint = {
            id: generateId(),
            type: 'point',
            x: pos.x,
            y: pos.y,
            isFixed: true
          };
        }
        
        if (center) {
          // Collect all new elements to add in one batch (single undo entry)
          const elementsToAdd: GeoElement[] = [];
          
          if (centerIsNew) {
            elementsToAdd.push(center);
          }
          if (isNewRadiusPoint) {
            elementsToAdd.push(radiusPoint);
          }
          
          const circle: Circle = {
            id: generateId(),
            type: 'circle',
            centerId: center.id,
            radiusPointId: radiusPoint.id
          };
          elementsToAdd.push(circle);
          
          // Add all elements at once - creates single undo entry
          store.addElements(elementsToAdd);
        }
        store.completeConstruction();
      }
    } else if (selectedTool === 'perpendicular_bisector') {
      handlePerpendicularBisectorClick(pos.x, pos.y, elements, isDrawing, tempData, zoom, store);
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    if (e.button === 2) {
      setIsPanning(false);
      lastMousePosRef.current = null;
    }
    
    // Stop dragging and commit final position (only one undo entry)
    if (selectedTool === 'select' && draggedPointId && draggedPointPos && dragOriginalPos) {
      // Only update if the point actually moved
      const moved = Math.hypot(
        draggedPointPos.x - dragOriginalPos.x, 
        draggedPointPos.y - dragOriginalPos.y
      ) > 0.01;
      
      if (moved) {
        // Single update to store - creates one undo entry
        store.updateElement(draggedPointId, { 
          x: draggedPointPos.x, 
          y: draggedPointPos.y 
        });
      }
      
      setDraggedPointId(null);
      setDraggedPointPos(null);
      setDragOriginalPos(null);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent context menu on right-click
  };

  // Determine cursor style based on tool and hovered element
  const getCursorStyle = () => {
    if (isPanning) return 'cursor-grabbing';
    if (selectedTool === 'select') {
      const hoveredPoint = findClickedPoint(mousePos);
      if (hoveredPoint && hoveredPoint.isFixed) return 'cursor-move';
      return 'cursor-default';
    }
    return 'cursor-crosshair';
  };

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`w-screen h-screen bg-white dark:bg-gray-900 ${getCursorStyle()} block`}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onContextMenu={handleContextMenu}
        onClick={selectedTool === 'label' ? (e => handleLabelClick(e, elements)) : undefined}
      />
      {/* Attach LabelTool logic for click/double-click labeling */}
      {selectedTool === 'label' && <LabelTool />}
      {/* Attach PerpendicularBisectorTool logic */}
      {selectedTool === 'perpendicular_bisector' && <PerpendicularBisectorTool />}
    </>
  );
}