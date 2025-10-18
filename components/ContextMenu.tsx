
import React, { useEffect, useRef } from 'react';
import Icon from './Icon';

export interface ContextMenuOption {
  label?: string;
  icon?: string;
  action?: () => void;
  disabled?: boolean;
  type?: 'option' | 'separator';
}

interface ContextMenuProps {
  x: number;
  y: number;
  options: ContextMenuOption[];
  onClose: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    top: `${y}px`,
    left: `${x}px`,
  };

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="fixed bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-lg z-50 text-slate-800 dark:text-slate-200 min-w-[180px] p-1"
      onContextMenu={(e) => e.preventDefault()}
    >
      <ul>
        {options.map((option, index) => {
          if (option.type === 'separator') {
            return <li key={`sep-${index}`} className="h-px bg-slate-200 dark:bg-slate-700 my-1"></li>;
          }
          return (
          <li key={index}>
            <button
              onClick={() => {
                if (!option.disabled && option.action) {
                  option.action();
                }
              }}
              disabled={option.disabled}
              className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <Icon name={option.icon || 'placeholder'} className="text-lg" />
              <span>{option.label}</span>
            </button>
          </li>
          )
        })}
      </ul>
    </div>
  );
};

export default ContextMenu;