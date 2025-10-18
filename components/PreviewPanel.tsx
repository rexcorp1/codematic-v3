import React from 'react';
import Icon from './Icon';

interface PreviewPanelProps {
  isPreviewFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRefresh: () => void;
  status: 'booting' | 'installing' | 'starting-server' | 'ready' | 'error' | 'idle';
  url: string;
}

const PreviewPanel: React.FC<PreviewPanelProps> = ({ 
  isPreviewFullscreen, 
  onToggleFullscreen, 
  onRefresh,
  status,
  url,
}) => {

  const StatusDisplay: React.FC = () => {
    let icon = "hourglass_top";
    let message = "Initializing...";
    switch(status) {
        case 'booting':
            icon = "memory";
            message = "Booting WebContainer...";
            break;
        case 'installing':
            icon = "download";
            message = "Installing dependencies...";
            break;
        case 'starting-server':
            icon = "dns";
            message = "Starting dev server...";
            break;
        case 'error':
            icon = "error";
            message = "An error occurred.";
            break;
        case 'idle':
             icon = "widgets";
             message = "Workspace is Empty";
            break;
    }

    return (
      <div className="flex items-center justify-center h-full text-center text-slate-500 dark:text-slate-400 p-4">
          <div>
              <Icon name={icon} className="text-4xl mb-2" />
              <h4 className="font-semibold text-lg mb-1">{message}</h4>
              <p className="text-sm">The live preview will appear here once the server is running.</p>
          </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#0d1117] h-full flex flex-col border-l border-slate-300 dark:border-slate-700/50">
      <div className="bg-slate-100 dark:bg-[#252526] px-4 h-[37px] flex items-center justify-between border-b border-slate-300 dark:border-slate-700/50">
        <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Preview</h3>
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
          <Icon name="refresh" className="cursor-pointer hover:text-slate-900 dark:hover:text-white text-lg" onClick={onRefresh} />
          {url && <a href={url} target="_blank" rel="noopener noreferrer"><Icon name="open_in_new" className="cursor-pointer hover:text-slate-900 dark:hover:text-white text-lg" /></a>}
          <Icon 
            name={isPreviewFullscreen ? 'fullscreen_exit' : 'fullscreen'} 
            className="cursor-pointer hover:text-slate-900 dark:hover:text-white text-lg" 
            onClick={onToggleFullscreen}
          />
        </div>
      </div>
      
      <div className="flex-1 relative">
        {status === 'ready' && url ? (
          <iframe
              src={url}
              title="Live Preview"
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-presentation"
          />
        ) : (
          <StatusDisplay />
        )}
      </div>
    </div>
  );
};

export default PreviewPanel;