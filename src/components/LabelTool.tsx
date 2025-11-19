import { useGeometryStore } from '../store/useGeometryStore';

// Helper to get the next available label (A-Z)
function getNextLabel(usedLabels: string[]): string | null {
  for (let i = 0; i < 26; i++) {
    const letter = String.fromCharCode(65 + i); // 'A' = 65
    if (!usedLabels.includes(letter)) return letter;
  }
  return null;
}

// Store last click for double-click detection (module-level, not per component instance)
let lastClick: { id: string, time: number } | null = null;

// Static handler for canvas click
export function handleLabelClick(e: React.MouseEvent, elements: any[]) {
  const setElements = useGeometryStore.setState;
  // Get zoom and pan from the canvas transform (from AppCanvas state)
  // We'll read from the global store, which is always up to date
  const { mousePos } = useGeometryStore.getState();
  // Use the current mousePos (already in world coordinates)
  const worldX = mousePos.x;
  const worldY = mousePos.y;
  // Find closest point within threshold (in world units)
  const threshold = 12; // px, but we want to use world units, so scale by zoom
  const { width, height } = (e.currentTarget as HTMLCanvasElement);
  // Estimate zoom from canvas size and bounding rect (AppCanvas always sets canvas size to client size)
  const rect = (e.currentTarget as HTMLCanvasElement).getBoundingClientRect();
  const zoom = width / rect.width;
  const worldThreshold = threshold / zoom;
  let closest: any = null;
  let minDist = Infinity;
  for (const el of elements) {
    if (el.type === 'point') {
      const dx = el.x - worldX;
      const dy = el.y - worldY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < worldThreshold && dist < minDist) {
        closest = el;
        minDist = dist;
      }
    }
  }
  if (!closest) return;
  // Collect all used labels
  const usedLabels = elements
    .filter(el => el.type === 'point' && el.label)
    .map(el => el.label as string);
  // Double click detection
  const now = Date.now();
  if (lastClick && lastClick.id === closest.id && now - lastClick.time < 350) {
    // Remove label
    setElements(state => ({
      elements: state.elements.map(el =>
        el.id === closest.id ? { ...el, label: undefined } : el
      )
    }));
    lastClick = null;
    return;
  }
  // Add label if not already labelled and label available
  if (!closest.label) {
    const label = getNextLabel(usedLabels);
    if (!label) return; // No more labels available
    setElements(state => ({
      elements: state.elements.map(el =>
        el.id === closest.id ? { ...el, label } : el
      )
    }));
  }
  lastClick = { id: closest.id, time: now };
}

// No visible component needed
export default function LabelTool() { return null; }
