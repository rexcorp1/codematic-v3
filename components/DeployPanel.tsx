import React from 'react';
import Icon from './Icon';

const DeployPanel: React.FC = () => {
  return (
    <div className="bg-white dark:bg-[#252526] h-full flex flex-col text-slate-700 dark:text-slate-300">
      <div className="bg-slate-100 dark:bg-[#252526] px-4 h-[37px] flex items-center border-b border-slate-300 dark:border-slate-700/50">
        <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
          Deploy
        </h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto text-sm">
        <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 text-center">
            <Icon name="rocket_launch" className="text-5xl mb-4" />
            <h4 className="font-semibold text-lg mb-2 text-slate-700 dark:text-slate-300">Deployment</h4>
            <p>Deployment sekali klik ke berbagai platform akan segera hadir.</p>
        </div>
      </div>
    </div>
  );
};

export default DeployPanel;
