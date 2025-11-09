import { useGeometryStore } from '../store/useGeometryStore';
import { useState, useEffect } from 'react';
import type { Point, Line, Circle } from '../core/geometry/types';

export default function PropertiesPanel() {
  const { elements, selectedElementId, removeElement } = useGeometryStore();
  const [selectedEl, setSelectedEl] = useState<Point | Line | Circle | null>(null);

  useEffect(() => {
    if (selectedElementId) {
      const el = elements.find(e => e.id === selectedElementId) || null;
      setSelectedEl(el as any);
    } else {
      setSelectedEl(null);
    }
  }, [selectedElementId, elements]);

  if (!selectedEl) return null;

  return (
    <div className="absolute top-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-64">
      <h3 className="font-semibold text-sm mb-3 text-gray-800 dark:text-gray-200">
        Properties: {selectedEl.type}
      </h3>
      
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-500 dark:text-gray-400">ID:</span>
          <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">{selectedEl.id.slice(0, 8)}...</span>
        </div>
        
        {selectedEl.type === 'point' && (
          <>
            <div>
              <span className="text-gray-500 dark:text-gray-400">X:</span>
              <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                {Math.round((selectedEl as Point).x)}
              </span>
            </div>
            <div>
              <span className="text-gray-500 dark:text-gray-400">Y:</span>
              <span className="ml-2 font-mono text-gray-700 dark:text-gray-300">
                {Math.round((selectedEl as Point).y)}
              </span>
            </div>
          </>
        )}
        
        {selectedEl.type === 'line' && (
          <div className="text-gray-500 dark:text-gray-400">Line segment</div>
        )}
        
        {selectedEl.type === 'circle' && (
          <div className="text-gray-500 dark:text-gray-400">Circle</div>
        )}
      </div>

      <button
        onClick={() => removeElement(selectedEl.id)}
        className="mt-4 w-full bg-red-500 hover:bg-red-600 text-white text-sm px-3 py-2 rounded"
      >
        Delete
      </button>
    </div>
  );
}