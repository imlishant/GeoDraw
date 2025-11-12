import { useGeometryStore } from '../store/useGeometryStore';

export default function UndoRedo() {
  const undo = useGeometryStore(s => s.undo);
  const redo = useGeometryStore(s => s.redo);
  const canUndo = useGeometryStore(s => s.canUndo);
  const canRedo = useGeometryStore(s => s.canRedo);

  return (
    <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex gap-1 z-10">
      <button
        onClick={undo}
        disabled={!canUndo}
        className={`p-2 rounded transition-colors ${canUndo ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'}`}
        title="Undo (Ctrl+Z)"
        aria-label="Undo"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Undo arrow - curved arrow pointing left */}
          <path 
            d="M 5 10 L 9 6 M 5 10 L 9 14 M 5 10 H 15 C 16.5 10 17 11 17 12.5 C 17 14 16.5 15 15 15 H 10" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
      <button
        onClick={redo}
        disabled={!canRedo}
        className={`p-2 rounded transition-colors ${canRedo ? 'hover:bg-gray-100 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'}`}
        title="Redo (Ctrl+Y)"
        aria-label="Redo"
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          {/* Redo arrow - curved arrow pointing right */}
          <path 
            d="M 15 10 L 11 6 M 15 10 L 11 14 M 15 10 H 5 C 3.5 10 3 11 3 12.5 C 3 14 3.5 15 5 15 H 10" 
            stroke="currentColor" 
            strokeWidth="1.5" 
            strokeLinecap="round" 
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      </button>
    </div>
  );
}
