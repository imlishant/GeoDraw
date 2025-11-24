import { useGeometryStore } from '../store/useGeometryStore';
import ToolButton from './ToolButton';
import type { Tool } from '../core/geometry/types';

const tools: { id: Tool; label: string; icon: string; customIcon?: React.ReactNode }[] = [
  { id: 'select', label: 'Select (V)', icon: '↖' },
  { id: 'label', label: 'Label (A)', icon: 'A' },
  { 
    id: 'point', 
    label: 'Point (P)', 
    icon: '●',
    customIcon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Small hollow circle - just a point */}
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="2" fill="none"/>
      </svg>
    )
  },
  { id: 'line', label: 'Line (L)', icon: '╱' },
  { 
    id: 'circle', 
    label: 'Circle (C)', 
    icon: '○',
    customIcon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Larger circle with center dot */}
        <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        <circle cx="10" cy="10" r="1.5" fill="currentColor"/>
      </svg>
    )
  },
  { 
    id: 'perpendicular_bisector', 
    label: 'Perp. Bisector (B)', 
    icon: '⊥',
    customIcon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal segment line (dull) */}
        <line x1="2" y1="10" x2="18" y2="10" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
        {/* Vertical bisector (bold, centered with equal spacing) */}
        <line x1="10" y1="1" x2="10" y2="19" stroke="currentColor" strokeWidth="2.5"/>
        {/* Two points at ends of segment */}
        <circle cx="2" cy="10" r="1.2" fill="currentColor"/>
        <circle cx="18" cy="10" r="1.2" fill="currentColor"/>
      </svg>
    )
  },
  { 
    id: 'perpendicular_line', 
    label: 'Perp. Line (P)', 
    icon: '⊥',
    customIcon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Horizontal reference line at bottom (dull) */}
        <line x1="2" y1="19" x2="18" y2="19" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
        {/* Vertical perpendicular line (solid, thick) - extends from bottom */}
        <line x1="10" y1="1" x2="10" y2="19" stroke="currentColor" strokeWidth="2.5"/>
        {/* Point at intersection */}
        {/* <circle cx="10" cy="14" r="1.5" fill="currentColor"/> */}
      </svg>
    )
  },
  { 
    id: 'angle_bisector', 
    label: 'Angle Bisector (A)', 
    icon: '∠',
    customIcon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Sleeping V shape (Pacman mouth opening to left) - upper ray */}
        <line x1="19" y1="2" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        {/* Sleeping V shape - lower ray */}
        <line x1="19" y1="18" x2="2" y2="10" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        {/* Horizontal angle bisector line (solid, bisecting the V, extends full width) */}
        <line x1="1" y1="10" x2="19" y2="10" stroke="currentColor" strokeWidth="2.5"/>
        {/* Angle arc mark on upper side */}
        <path d="M 15 5 Q 14 5 13 7" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7"/>
        {/* Angle arc mark on lower side */}
        <path d="M 15 15 Q 14 15 13 13" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7"/>
      </svg>
    )
  },
  { 
    id: 'intersect', 
    label: 'Intersect (I)', 
    icon: '⨯',
    customIcon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top-left to bottom-right arc (dashed) */}
        <path d="M 3 3 Q 6.5 6.5 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2,2" fill="none"/>
        {/* Bottom-right continuation (dashed) */}
        <path d="M 10 10 Q 13.5 13.5 17 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2,2" fill="none"/>
        {/* Top-right to bottom-left arc (dashed) */}
        <path d="M 17 3 Q 13.5 6.5 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2,2" fill="none"/>
        {/* Bottom-left continuation (dashed) */}
        <path d="M 10 10 Q 6.5 13.5 3 17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="2,2" fill="none"/>
        {/* Hollow center circle */}
        <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      </svg>
    )
  },
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
          customIcon={tool.customIcon}
          isActive={selectedTool === tool.id}
          onClick={() => setSelectedTool(tool.id)}
        />
      ))}
    </div>
  );
}