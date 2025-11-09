import { useGeometryStore } from '../store/useGeometryStore';
import ToolButton from './ToolButton';
import type { Tool } from '../core/geometry/types';

const tools: { id: Tool; label: string; icon: string }[] = [
  { id: 'select', label: 'Select (V)', icon: '↖' },
  { id: 'point', label: 'Point (P)', icon: '●' },
  { id: 'line', label: 'Line (L)', icon: '╱' },
  { id: 'circle', label: 'Circle (C)', icon: '○' },
];

export default function Toolbar() {
  const { selectedTool, setSelectedTool } = useGeometryStore();

  return (
    <div className="absolute top-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-2 flex flex-col gap-1 z-10">
      {tools.map(tool => (
        <ToolButton
          key={tool.id}
          tool={tool.id}
          label={tool.label}
          icon={tool.icon}
          isActive={selectedTool === tool.id}
          onClick={() => setSelectedTool(tool.id)}
        />
      ))}
    </div>
  );
}