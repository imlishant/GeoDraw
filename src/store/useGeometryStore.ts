import { create } from 'zustand';
import type { GeoElement, Point, Line, Circle, Tool } from '../core/geometry/types';

interface GeometryState {
  elements: GeoElement[];
  selectedTool: Tool;
  selectedElementId: string | null;
  hoveredElementId: string | null;
  isDrawing: boolean;
  tempData: any;
  mousePos: { x: number; y: number };
  snapTarget: { x: number; y: number } | null;
  canUndo: boolean;
  canRedo: boolean;
  
  // Actions
  setSelectedTool: (tool: Tool) => void;
  setHoveredElementId: (id: string | null) => void;
  updateMousePosition: (pos: { x: number; y: number }, snap: { x: number; y: number } | null) => void;
  addElement: (element: GeoElement) => void;
  addElements: (elements: GeoElement[]) => void; // Batch add for single undo entry
  updateElement: (id: string, updates: Partial<GeoElement>) => void;
  removeElement: (id: string) => void;
  clearCanvas: () => void;
  undo: () => void;
  redo: () => void;
  startConstruction: (data: any) => void;
  completeConstruction: () => void;
}

// Simple history for undo/redo
let history: GeoElement[][] = [[]];
let historyIndex = 0;

function pushToHistory(elements: GeoElement[]) {
  history = history.slice(0, historyIndex + 1);
  history.push([...elements]);
  historyIndex++;
  if (history.length > 50) {
    history.shift();
    historyIndex--;
  }
}

export const useGeometryStore = create<GeometryState>((set, get) => ({
  elements: [],
  selectedTool: 'select',
  selectedElementId: null,
  hoveredElementId: null,
  isDrawing: false,
  tempData: null,
  mousePos: { x: 0, y: 0 },
  snapTarget: null,
  canUndo: false,
  canRedo: false,

  updateMousePosition: (pos, snap) => set({ mousePos: pos, snapTarget: snap }),
  setSelectedTool: (tool) => set({ selectedTool: tool }),
  setHoveredElementId: (id) => set({ hoveredElementId: id }),

  addElement: (element) => {
    const current = get().elements;
    const newElements = [...current, element];
    set({ elements: newElements });
    pushToHistory(newElements);
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  addElements: (elements) => {
    const current = get().elements;
    const newElements = [...current, ...elements];
    set({ elements: newElements });
    pushToHistory(newElements); // Single history entry for all elements
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  updateElement: (id, updates) => {
    const current = get().elements;
    const newElements = current.map(el => {
      if (el.id !== id) return el;

      // Narrow by discriminant so TypeScript knows which shape we're updating.
      if (el.type === 'point') {
        return { ...el, ...(updates as Partial<typeof el>) } as Point;
      }
      if (el.type === 'line') {
        return { ...el, ...(updates as Partial<typeof el>) } as Line;
      }
      if (el.type === 'circle') {
        return { ...el, ...(updates as Partial<typeof el>) } as Circle;
      }

      return el;
    });

    set({ elements: newElements });
    pushToHistory(newElements);
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  removeElement: (id) => {
    const current = get().elements;
    const newElements = current.filter(el => el.id !== id);
    set({ elements: newElements });
    pushToHistory(newElements);
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  clearCanvas: () => {
    set({ elements: [] });
    pushToHistory([]);
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  startConstruction: (data) => set({ isDrawing: true, tempData: data }),
  
  completeConstruction: () => set({ isDrawing: false, tempData: null }),

  undo: () => {
    if (historyIndex > 0) {
      historyIndex--;
      set({ elements: history[historyIndex] });
      set({
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
      });
    }
  },

  redo: () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      set({ elements: history[historyIndex] });
      set({
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
      });
    }
  },
}));