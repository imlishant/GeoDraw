import { useGeometryStore } from '../store/useGeometryStore';
import { useState, useEffect } from 'react';

export default function StatusBar() {
  const { selectedTool, elements } = useGeometryStore();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-8 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 flex justify-between items-center text-xs text-gray-600 dark:text-gray-400 z-20">
      <div className="flex gap-6">
        <span className="flex items-center gap-1">
          <span className="font-semibold">Tool:</span>
          <span className="font-mono text-gray-800 dark:text-gray-200">{selectedTool}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold">Elements:</span>
          <span className="font-mono text-gray-800 dark:text-gray-200">{elements.length}</span>
        </span>
      </div>
      
      <div className="flex gap-6">
        <span className="flex items-center gap-1">
          <span className="font-semibold">X:</span>
          <span className="font-mono text-gray-800 dark:text-gray-200">{Math.round(mousePos.x)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="font-semibold">Y:</span>
          <span className="font-mono text-gray-800 dark:text-gray-200">{Math.round(mousePos.y)}</span>
        </span>
      </div>
    </div>
  );
}