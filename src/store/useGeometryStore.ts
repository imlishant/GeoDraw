import { create } from 'zustand';
import type { GeoElement, Tool } from '../core/geometry/types';
import { DependencyGraph } from '../core/geometry/dependencyGraph';
import { recalculateElement } from '../core/geometry/utils';

export interface GeometryState {
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
  setSelectedElementId: (id: string | null) => void;
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

// Dependency Graph instance
const graph = new DependencyGraph();

function pushToHistory(elements: GeoElement[]) {
  history = history.slice(0, historyIndex + 1);
  history.push([...elements]);
  historyIndex++;
  if (history.length > 50) {
    history.shift();
    historyIndex--;
  }
}

// Helper to rebuild graph from elements (used in undo/redo)
function rebuildGraph(elements: GeoElement[]) {
  graph.clear();
  elements.forEach(el => {
    if (el.dependencies && el.dependencies.length > 0) {
      graph.addNode(el.id, el.dependencies);
    }
  });
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
  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setHoveredElementId: (id) => set({ hoveredElementId: id }),

  addElement: (element) => {
    const current = get().elements;
    const newElements = [...current, element];

    // Register dependencies
    if (element.dependencies && element.dependencies.length > 0) {
      graph.addNode(element.id, element.dependencies);
    }

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

    // Register dependencies
    elements.forEach(el => {
      if (el.dependencies && el.dependencies.length > 0) {
        graph.addNode(el.id, el.dependencies);
      }
    });

    set({ elements: newElements });
    pushToHistory(newElements); // Single history entry for all elements
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  updateElement: (id, updates) => {
    const current = get().elements;

    // 1. Update the target element
    let newElements = current.map(el => {
      if (el.id !== id) return el;
      return { ...el, ...updates } as GeoElement;
    });

    // 2. Find dependents that need updating
    const dependents = graph.getUpdateOrder([id]);

    // 3. Recalculate dependents
    if (dependents.length > 0) {
      // Create a map for fast lookup during recalculation
      const elementsMap = new Map(newElements.map(el => [el.id, el]));

      dependents.forEach(depId => {
        const el = elementsMap.get(depId);
        if (el) {
          const updatedEl = recalculateElement(el, elementsMap);
          elementsMap.set(depId, updatedEl);
        }
      });

      newElements = Array.from(elementsMap.values());
    }

    set({ elements: newElements });
    pushToHistory(newElements);
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  removeElement: (id) => {
    const current = get().elements;
    // Also remove dependents? For now, let's just remove the element and let dependents stay (maybe invalid state?)
    // Better: Remove element and its dependents recursively?
    // Or just remove the element and let the graph handle it (graph.removeNode doesn't cascade delete in our impl yet)

    // For now, simple removal.
    graph.removeNode(id);

    const newElements = current.filter(el => el.id !== id);
    set({ elements: newElements });
    pushToHistory(newElements);
    set({
      canUndo: historyIndex > 0,
      canRedo: historyIndex < history.length - 1,
    });
  },

  clearCanvas: () => {
    graph.clear();
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
      const restoredElements = history[historyIndex];
      rebuildGraph(restoredElements);
      set({ elements: restoredElements });
      set({
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
      });
    }
  },

  redo: () => {
    if (historyIndex < history.length - 1) {
      historyIndex++;
      const restoredElements = history[historyIndex];
      rebuildGraph(restoredElements);
      set({ elements: restoredElements });
      set({
        canUndo: historyIndex > 0,
        canRedo: historyIndex < history.length - 1,
      });
    }
  },
}));