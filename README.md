# GeomeDraw

Geometric construction tool combining Excalidraw's speed with Euclidea's precision and GeoGebra's richness.

---

## Project Handoff Summary

### Project Purpose & Core Functionality

**GeomeDraw** is an interactive geometric construction tool inspired by Euclidea, Excalidraw, and GeoGebra. Its goal is to provide a fast, intuitive, and precise environment for creating, manipulating, and exploring geometric constructions, supporting both educational and creative use cases.

- Users can draw points, lines (with infinite extensions), circles, and intersection points.
- The interface supports zooming, panning, snapping, and robust undo/redo.
- The tool visually distinguishes between user-created (“man-made”) and derived (intersection) points.

---

### Key Technologies, Frameworks, and Libraries

- **React** (with functional components and hooks)
- **TypeScript** (strict typing throughout)
- **Zustand** (state management, including undo/redo history)
- **Vite** (development/build tooling)
- **Tailwind CSS** (styling)
- **Custom Canvas Renderer** (for performant, scalable drawing)
- **SVG** (for toolbar icons)

---

### Architecture & Component Structure

- `src/components/`
  - `AppCanvas.tsx`: Main canvas, handles all drawing, mouse events, and tool logic.
  - `Toolbar.tsx`: Tool selection UI with custom SVG icons.
  - `UndoRedo.tsx`: Undo/Redo controls, disabled when unavailable.
  - `ToolButton.tsx`: Individual tool button component.
  - `StatusBar.tsx`, `PropertiesPanel.tsx`: UI for status and element properties.
- `src/store/useGeometryStore.ts`: Zustand store for all geometry elements, tool state, and undo/redo history.
- `src/core/geometry/`: Types, intersection math, and geometry utilities.
- `src/core/canvas/renderer.ts`: Handles all canvas drawing logic.

---

### Major Features & Implementation Details

- **Zoom & Pan**: Mouse wheel zooms toward cursor; right-click drag pans the canvas.
- **Drawing Tools**:
  - **Point**: Adds a point, reuses existing if within epsilon.
  - **Line**: Infinite line through two points; both points are batched for undo.
  - **Circle**: Circle by center and radius point; both points batched for undo.
  - **Intersection**: Hover highlights all intersections between objects; click to add derived point (no duplicates).
- **Select/Move Tool**: Drag man-made points (isFixed=true) with live preview; only one undo entry per drag.
- **Undo/Redo**: Robust, atomic per-construction; buttons disabled when unavailable; history always initialized to empty baseline.
- **Duplicate Prevention**: All tools check for and reuse existing points to avoid overlap/duplication.
- **Visual Distinction**: Man-made points and derived points are styled differently.
- **Toolbar Icons**: Custom SVGs for clarity and accessibility.

---

### Known Issues, Limitations, or Technical Debt

- No persistent save/load of constructions yet.
- No constraint system (e.g., perpendicular, equal length) implemented.
- No export (SVG/PNG) or import functionality.
- No multi-select or group operations.
- No mobile/touch support.
- Undo/redo is per-construction, not per-action (by design, but may be revisited).
- Some UI/UX polish and accessibility improvements pending.

---

### Immediate Next Steps & Future Development Plans

- Add save/load functionality (local storage or file-based).
- Implement geometric constraints and validation.
- Add export/import (SVG, PNG, or custom format).
- Expand the set of construction tools (angle bisector, perpendicular line, perpendicular bisector, midpoint, parallel line, compass).
- Improve accessibility and keyboard navigation.
- Add multi-select and group manipulation.
- Enhance mobile/touch support.
- Add construction step-by-step playback.
- Add insert labels to the point selected sequentially(A to Z) to any existing points.
- Fix select tool, during free form point movement it must be able to move the derived/intersects point through its locus as well.

---

### Critical Design Decisions & Tradeoffs

- **Batch Construction**: All elements for a construction (e.g., both points and a line) are added in a single batch for atomic undo/redo. This ensures no orphaned elements and predictable history.
- **Zustand for State**: Chosen for simplicity, performance, and easy undo/redo implementation.
- **Canvas Rendering**: Chosen for performance and flexibility over SVG for complex, interactive scenes.
- **No Duplicates**: All tools check for and reuse existing points to keep constructions clean and avoid confusion.
- **Undo/Redo Granularity**: Undo/redo operates at the construction level, not per mouse event, for clarity and to match user expectations from geometric tools.

---

This summary should provide all essential context for any developer or AI assistant to continue work on GeomeDraw seamlessly. Update this section as the project evolves.

---

## Local Development
```bash
npm install
npm run dev
```