

import React, { useState, useRef, useEffect } from 'react';
import Icon from './Icon';
import SettingsMenu from './SettingsMenu';

type PanelType = 'assistant' | 'search' | 'source_control' | 'deploy';

interface SidebarProps {
  activePanel: PanelType | 'none';
  onSetPanel: (panel: PanelType) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePanel, onSetPanel }) => {
  const [isSettingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  const navItems = [
    { id: 'codematic', icon: 'draw', label: 'Codematic', isToggle: false },
    { id: 'assistant', icon: 'new_window', label: 'Code Assistant', isToggle: true },
    { id: 'search', icon: 'search', label: 'Search', isToggle: true },
    { id: 'source_control', icon: 'account_tree', label: 'Source Control', isToggle: true },
    { id: 'deploy', icon: 'rocket_launch', label: 'Deploy', isToggle: true },
  ] as const;
  
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <aside className="w-[60px] bg-slate-200 dark:bg-[#1e1e1e] flex flex-col items-center pt-[0.30rem] pb-4 text-slate-500 dark:text-slate-400 flex-shrink-0">
      <div className="flex-1 flex flex-col items-center space-y-2 w-full">
        {navItems.map((item) => {
            const isActive = activePanel === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.isToggle) {
                    onSetPanel(item.id);
                  }
                }}
                className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors duration-200 ${
                  isActive ? 'text-slate-900 dark:text-white' : 'hover:bg-slate-300 dark:hover:bg-slate-700/50'
                }`}
                data-tooltip={item.label}
              >
                <div className="w-6 h-6 flex items-center justify-center">
                  <Icon name={item.icon} className="text-2xl" />
                </div>
              </button>
            )
        })}
      </div>
      <div className="relative w-full flex flex-col items-center space-y-2" ref={settingsRef}>
        <button className="w-12 h-12 flex items-center justify-center rounded-lg transition-colors duration-200 hover:bg-slate-300 dark:hover:bg-slate-700/50" data-tooltip="Account">
          <div className="w-6 h-6 flex items-center justify-center">
            <Icon name="account_circle" className="text-2xl" />
          </div>
        </button>
        {isSettingsOpen && <SettingsMenu onClose={() => setSettingsOpen(false)} />}
        <button 
          onClick={() => setSettingsOpen(prev => !prev)}
          className={`w-12 h-12 flex items-center justify-center rounded-lg transition-colors duration-200 hover:bg-slate-300 dark:hover:bg-slate-700/50 ${isSettingsOpen ? 'bg-slate-300 dark:bg-slate-700' : ''}`}
          data-tooltip="Settings"
        >
          <div className="w-6 h-6 flex items-center justify-center">
            <Icon name="settings" className="text-2xl" />
          </div>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;