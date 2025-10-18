
import React, 'react';
import Icon from './Icon';

interface MainHeaderProps {
    projectName: string;
    isRenaming: boolean;
    onToggleRename: () => void;
    onRename: (newName: string) => void;
    onNewProject: () => void;
    onSaveProject: () => void;
    onDownloadProject: () => void;
    panelVisibility: {
        assistant: boolean;
        editor: boolean;
        preview: boolean;
    };
    onTogglePanel: (panel: 'editor' | 'preview') => void;
    hasUnsavedChanges: boolean;
    onExitIDE: () => void; // New prop to go back to dashboard
}

const MainHeader: React.FC<MainHeaderProps> = ({ 
    projectName, 
    isRenaming,
    onToggleRename,
    onRename,
    onNewProject,
    onSaveProject,
    onDownloadProject,
    panelVisibility, 
    onTogglePanel,
    hasUnsavedChanges,
    onExitIDE
}) => {
    const [name, setName] = React.useState(projectName);
    
    React.useEffect(() => {
        setName(projectName);
    }, [projectName]);

    const handleRenameSubmit = () => {
        onRename(name);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleRenameSubmit();
        } else if (e.key === 'Escape') {
            setName(projectName); // Revert changes
            onToggleRename(); // Exit renaming mode
        }
    };

  return (
    <header className="h-[50px] bg-slate-100 dark:bg-[#252526] flex items-center justify-between px-4 text-slate-700 dark:text-slate-300 border-b border-slate-300 dark:border-slate-700/50 shrink-0">
      <div className="flex items-center gap-4">
        <Icon name="dashboard" title="Back to Dashboard" className="cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={onExitIDE} />
        <div className="w-px h-6 bg-slate-300 dark:bg-slate-600"></div>
        {isRenaming ? (
            <input 
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
                className="bg-white dark:bg-slate-800 border border-blue-500 rounded-md px-2 py-0.5 text-lg font-semibold text-slate-900 dark:text-white focus:outline-none"
            />
        ) : (
            <h2 className="font-semibold text-lg text-slate-900 dark:text-white">{projectName}</h2>
        )}

        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
            <Icon name="edit" title="Rename Project" className="cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={onToggleRename} />
            <Icon name="note_add" title="New Project" className="cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={onNewProject} />
            <Icon 
              name="save" 
              title="Save Project" 
              className={hasUnsavedChanges ? 'cursor-pointer text-blue-500 hover:text-blue-400' : 'text-slate-500 cursor-not-allowed'} 
              onClick={hasUnsavedChanges ? onSaveProject : undefined}
            />
            <Icon name="download" title="Download as ZIP" className="cursor-pointer hover:text-slate-900 dark:hover:text-white" onClick={onDownloadProject} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-800/50 rounded-md">
             <button data-tooltip="Toggle Editor Panel" onClick={() => onTogglePanel('editor')} className={`p-1.5 rounded ${panelVisibility.editor ? 'bg-slate-300 dark:bg-slate-600/70 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700/50'}`}>
                <Icon name="code_blocks" className="text-base" />
            </button>
             <button data-tooltip="Toggle Preview Panel" onClick={() => onTogglePanel('preview')} className={`p-1.5 rounded ${panelVisibility.preview ? 'bg-slate-300 dark:bg-slate-600/70 text-slate-900 dark:text-white' : 'text-slate-500 dark:text-slate-400 hover:bg-slate-300 dark:hover:bg-slate-700/50'}`}>
                <Icon name="preview" className="text-base" />
            </button>
        </div>
      </div>
    </header>
  );
};

export default MainHeader;
