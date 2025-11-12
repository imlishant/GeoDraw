interface ToolButtonProps {
  tool: string;
  label: string;
  icon: string;
  customIcon?: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}

export default function ToolButton({ label, icon, customIcon, isActive, onClick }: ToolButtonProps) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`
        w-10 h-10 flex items-center justify-center text-2xl rounded-lg transition-all
        ${isActive 
          ? 'bg-blue-500 text-white shadow-md' 
          : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600'
        }
      `}
    >
      {customIcon || <span>{icon}</span>}
    </button>
  );
}