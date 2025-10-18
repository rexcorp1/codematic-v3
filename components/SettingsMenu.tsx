import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon';

interface SettingsMenuProps {
  onClose: () => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ onClose }) => {
  const { theme, setTheme } = useTheme();
  const options = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System Default' },
  ];

  return (
    <div className="absolute bottom-14 left-full ml-2 w-48 bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md shadow-lg z-50 text-slate-800 dark:text-slate-200">
      <div className="p-2 border-b border-slate-300 dark:border-slate-700">
        <h3 className="font-semibold text-sm">Theme</h3>
      </div>
      <div className="p-1">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => {
              setTheme(option.value as 'light' | 'dark' | 'system');
              onClose();
            }}
            className="w-full text-left px-3 py-1.5 text-sm flex items-center justify-between rounded-md hover:bg-slate-200 dark:hover:bg-slate-700"
          >
            <span>{option.label}</span>
            {theme === option.value && <Icon name="check" className="text-lg" />}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SettingsMenu;
