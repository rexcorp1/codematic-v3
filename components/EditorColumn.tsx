import React, { useEffect, useRef } from 'react';
import FileTree from './FileTree';
import CodeEditor from './CodeEditor';
import { FileNode, SearchResult, SearchMatch } from '../types';
import Icon from './Icon';
import { findFileByPath, getAllPaths } from '../lib/project-utils';
import ContextMenu, { ContextMenuOption } from './ContextMenu';

interface EditorColumnProps {
  projectStructure: FileNode[];
  openFiles: FileNode[];
  activeFilePath: string | null;
  onOpenFile: (path: string) => void;
  onCloseFile: (path: string) => void;
  onSelectTab: (path: string) => void;
  onFileContentChange: (path: string, content: string) => void;
  selectedNodePaths: string[];
  onSelectNodes: (path: string, isToggle: boolean) => void;
  onSelectAllNodes: () => void;
  onClearSelection: () => void;
  onRefreshWorkspace: () => void;
  onAddNode: (parentPath: string, nodeName: string, type: 'file' | 'folder') => void;
  onRequestDelete: (paths: string[]) => void;
  onRenameNode: (path: string, newName: string) => void;
  onUploadFiles: (parentPath: string, files: FileList) => void;
  onMoveNode: (sourcePath: string, targetParentPath: string) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  searchResults: SearchResult[];
  activeMatch: { path: string; lineNumber: number } | null;
  streamingFileOverrides: Record<string, string>;
  isLoadingAI: boolean;
  onRequestRefactor: (path: string, selectedCode: string) => void;
}

const EditorColumn: React.FC<EditorColumnProps> = ({ 
    projectStructure, 
    openFiles, 
    activeFilePath,
    onOpenFile,
    onCloseFile,
    onSelectTab,
    onFileContentChange,
    selectedNodePaths,
    onSelectNodes,
    onSelectAllNodes,
    onClearSelection,
    onRefreshWorkspace,
    onAddNode,
    onRequestDelete,
    onRenameNode,
    onUploadFiles,
    onMoveNode,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
    searchResults,
    activeMatch,
    streamingFileOverrides,
    isLoadingAI,
    onRequestRefactor
}) => {
  const [isTreeCollapsed, setTreeCollapsed] = React.useState(false);
  const [panelHeights, setPanelHeights] = React.useState([40, 60]);
  const [creatingNodeInfo, setCreatingNodeInfo] = React.useState<{ parentPath: string; type: 'file' | 'folder' } | null>(null);
  const [renamingPath, setRenamingPath] = React.useState<string | null>(null);
  const [contextMenu, setContextMenu] = React.useState<{ x: number; y: number; node: FileNode } | null>(null);
  const [uploadTarget, setUploadTarget] = React.useState<string>('/');

  const editorColRef = React.useRef<HTMLDivElement>(null);
  const workspacePanelRef = React.useRef<HTMLDivElement>(null);
  const fileTreeContainerRef = React.useRef<HTMLDivElement>(null);
  const uploadInputRef = React.useRef<HTMLInputElement>(null);
  const resizeStartDataRef = React.useRef<{
    initialMouseY: number;
    initialTopPanelHeight: number;
  } | null>(null);
  const animationFrameId = React.useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  useEffect(() => {
    const container = fileTreeContainerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodePaths.length > 0) {
            e.preventDefault();
            onRequestDelete(selectedNodePaths);
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
            e.preventDefault();
            onSelectAllNodes();
        }
    };
    
    container.addEventListener('keydown', handleKeyDown);
    return () => container.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodePaths, onRequestDelete, onSelectAllNodes]);

  const handleMouseMove = React.useCallback((e: MouseEvent) => {
    e.preventDefault();
    const clientY = e.clientY;

    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }

    animationFrameId.current = requestAnimationFrame(() => {
      if (!resizeStartDataRef.current || !editorColRef.current) return;

      const startData = resizeStartDataRef.current;
      const totalHeight = editorColRef.current.offsetHeight;
      
      const deltaY = clientY - startData.initialMouseY;
      const newTopPanelHeight = startData.initialTopPanelHeight + deltaY;
      
      const minPanelHeight = 50; // min height in pixels
      if (newTopPanelHeight > minPanelHeight && totalHeight - newTopPanelHeight > minPanelHeight) {
          const newTopPercent = (newTopPanelHeight / totalHeight) * 100;
          setPanelHeights([newTopPercent, 100 - newTopPercent]);
      }
    });
  }, []);

  const handleMouseUp = React.useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
    }
    resizeStartDataRef.current = null;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'default';
    document.body.style.userSelect = 'auto';
  }, [handleMouseMove]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!workspacePanelRef.current) return;
    e.preventDefault();
    
    resizeStartDataRef.current = {
        initialMouseY: e.clientY,
        initialTopPanelHeight: workspacePanelRef.current.offsetHeight,
    };

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };
  
  const showVerticalResizer = !isTreeCollapsed;
  
  let activeFile = openFiles.find(f => f.path === activeFilePath) || null;
  if (activeFile && streamingFileOverrides[activeFile.path] !== undefined) {
    activeFile = {
        ...activeFile,
        content: streamingFileOverrides[activeFile.path],
    };
  }
  
  const matchesForActiveFile = searchResults.find(r => r.path === activeFilePath)?.matches || [];

  const getParentPathForNewNode = (): string => {
    if (selectedNodePaths.length === 0) return '/';
    const lastSelectedPath = selectedNodePaths[selectedNodePaths.length - 1];
    const selectedNode = findFileByPath(projectStructure, lastSelectedPath);
    if (!selectedNode) return '/';
    if (selectedNode.type === 'folder') return selectedNode.path;
    return lastSelectedPath.substring(0, lastSelectedPath.lastIndexOf('/')) || '/';
  };
  
  const handleCommitCreation = (name: string) => {
      if (creatingNodeInfo) {
          onAddNode(creatingNodeInfo.parentPath, name, creatingNodeInfo.type);
          setCreatingNodeInfo(null);
      }
  };
  
  const handleCancelCreation = () => {
      setCreatingNodeInfo(null);
  };

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault();
    e.stopPropagation();
    if (!selectedNodePaths.includes(node.path)) {
      onSelectNodes(node.path, false);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const handleCloseContextMenu = () => setContextMenu(null);

  const handleRenameRequest = () => {
    if(contextMenu) setRenamingPath(contextMenu.node.path);
    handleCloseContextMenu();
  };

  const handleDeleteRequest = () => {
    if(contextMenu) onRequestDelete(selectedNodePaths);
    handleCloseContextMenu();
  };

  const handleCommitRename = (newName: string) => {
    if(renamingPath && newName) {
        onRenameNode(renamingPath, newName);
    }
    setRenamingPath(null);
  };
  
  const handleUploadClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const parentPath = getParentPathForNewNode();
    setUploadTarget(parentPath);
    uploadInputRef.current?.click();
  };

  const handleUploadRequestFromContextMenu = () => {
    if (contextMenu) {
        const parentPath = contextMenu.node.type === 'folder' 
            ? contextMenu.node.path 
            : (contextMenu.node.path.substring(0, contextMenu.node.path.lastIndexOf('/')) || '/');
        setUploadTarget(parentPath);
        uploadInputRef.current?.click();
    }
    handleCloseContextMenu();
  };

  const handleFileUploaded = (e: React.ChangeEvent<HTMLInputElement>) => {
      if(e.target.files && e.target.files.length > 0) {
          onUploadFiles(uploadTarget, e.target.files);
      }
      if (e.target) e.target.value = ''; // Reset for next upload
  }

  const getContextMenuOptions = (): ContextMenuOption[] => {
    if (!contextMenu) return [];
    const { node } = contextMenu;
    const isProtected = selectedNodePaths.some(p => ['/package.json', '/public', '/src', '/index.html', '/vite.config.ts'].includes(p));

    const options: ContextMenuOption[] = [
        { label: 'New File', icon: 'note_add', action: () => {
            const parentPath = node.type === 'folder' ? node.path : (node.path.substring(0, node.path.lastIndexOf('/')) || '/');
            setCreatingNodeInfo({ parentPath, type: 'file' });
            handleCloseContextMenu();
        } },
        { label: 'New Folder', icon: 'create_new_folder', action: () => {
            const parentPath = node.type === 'folder' ? node.path : (node.path.substring(0, node.path.lastIndexOf('/')) || '/');
            setCreatingNodeInfo({ parentPath, type: 'folder' });
            handleCloseContextMenu();
        } },
    ];
    if (node.type === 'folder' || selectedNodePaths.length === 0) {
      options.push({ label: 'Upload Files', icon: 'upload_file', action: handleUploadRequestFromContextMenu });
    }
    
    options.push({ type: 'separator' });
    
    options.push({ label: 'Select All', icon: 'select_all', action: () => {
        onSelectAllNodes();
        handleCloseContextMenu();
    } });
    
    options.push({ type: 'separator' });

    options.push({ label: 'Rename', icon: 'edit', action: handleRenameRequest, disabled: isProtected || selectedNodePaths.length > 1 });
    const deleteLabel = selectedNodePaths.length > 1 ? `Delete ${selectedNodePaths.length} items` : 'Delete';
    options.push({ label: deleteLabel, icon: 'delete', action: handleDeleteRequest, disabled: isProtected });
    
    return options;
  };

  return (
    <div ref={editorColRef} className="h-full flex flex-col bg-slate-100 dark:bg-[#1e1e1e] overflow-hidden">
      <input type="file" multiple ref={uploadInputRef} onChange={handleFileUploaded} className="hidden" />
      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={getContextMenuOptions()} onClose={handleCloseContextMenu} />}
      
      {/* Workspace Panel */}
      <div ref={workspacePanelRef} className="flex flex-col" style={{ height: isTreeCollapsed ? 'auto' : `${panelHeights[0]}%`, minHeight: '37px' }}>
        <div 
          className="bg-slate-100 dark:bg-[#252526] px-4 h-[37px] flex items-center justify-between border-b border-slate-300 dark:border-slate-700/50 cursor-pointer flex-shrink-0"
          onClick={() => setTreeCollapsed(!isTreeCollapsed)}
        >
          <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">Workspace</h3>
          <div className="flex items-center gap-1 text-slate-600 dark:text-slate-400">
            <button disabled={!canUndo} onClick={(e) => { e.stopPropagation(); onUndo(); }} data-tooltip="Undo" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed">
              <Icon name="undo" className="text-lg" />
            </button>
            <button disabled={!canRedo} onClick={(e) => { e.stopPropagation(); onRedo(); }} data-tooltip="Redo" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50 disabled:opacity-40 disabled:cursor-not-allowed">
              <Icon name="redo" className="text-lg" />
            </button>
            <button onClick={handleUploadClick} data-tooltip="Upload Files" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50">
              <Icon name="upload_file" className="text-lg" />
            </button>
            <button onClick={(e) => { e.stopPropagation(); onRefreshWorkspace(); }} data-tooltip="Refresh Workspace" className="p-1.5 rounded hover:bg-slate-200 dark:hover:bg-slate-700/50">
              <Icon name="refresh" className="text-lg" />
            </button>
            <Icon name={isTreeCollapsed ? 'expand_more' : 'expand_less'} />
          </div>
        </div>
        {!isTreeCollapsed && (
          <div 
            ref={fileTreeContainerRef} 
            tabIndex={-1} 
            className="flex-1 overflow-y-auto bg-white dark:bg-[#1e1e1e] focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClearSelection();
                }
                (e.currentTarget as HTMLDivElement).focus();
            }}
          >
            <FileTree 
                nodes={projectStructure} 
                onSelectFile={onOpenFile} 
                selectedPaths={selectedNodePaths}
                onSelectNode={onSelectNodes}
                creatingNodeInfo={creatingNodeInfo}
                onCommitCreation={handleCommitCreation}
                onCancelCreation={handleCancelCreation}
                renamingPath={renamingPath}
                onCommitRename={handleCommitRename}
                onCancelRename={() => setRenamingPath(null)}
                onContextMenu={handleContextMenu}
                onMoveNode={onMoveNode}
            />
          </div>
        )}
      </div>

      {showVerticalResizer && (
         <div
            className="h-2 w-full cursor-row-resize flex justify-center items-center flex-shrink-0 group"
            onMouseDown={handleMouseDown}
          >
            <div className="h-px w-full bg-slate-300 dark:bg-slate-700/50 group-hover:h-2 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-150 ease-in-out"></div>
          </div>
      )}

      {/* Code Editor Panel */}
       <div className="flex flex-col flex-1" style={{ minHeight: '50px' }}>
        <div className="bg-slate-100 dark:bg-[#252526] flex items-center justify-between border-y border-slate-300 dark:border-slate-700/50 shrink-0">
            <div className="flex-1 flex items-center overflow-x-auto">
                {openFiles.map(file => (
                    <button
                        key={file.path}
                        onClick={() => onSelectTab(file.path)}
                        className={`flex items-center gap-2 px-3 py-2 border-r border-slate-300 dark:border-slate-700/50 text-sm whitespace-nowrap transition-colors ${
                            activeFilePath === file.path 
                            ? 'bg-white dark:bg-[#1e1e1e] text-slate-900 dark:text-white'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-[#3a3d41]'
                        }`}
                    >
                        <CodeEditor.FileIcon filename={file.name} />
                        <span>{file.name}</span>
                        <Icon 
                            name="close" 
                            className="text-base p-0.5 rounded-full hover:bg-slate-400/50 dark:hover:bg-slate-500/50"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCloseFile(file.path);
                            }}
                        />
                    </button>
                ))}
            </div>
        </div>
        <div className="flex-1 overflow-auto bg-white dark:bg-[#1e1e1e]">
          <CodeEditor 
            projectStructure={projectStructure}
            file={activeFile} 
            onChange={onFileContentChange} 
            matchesForFile={matchesForActiveFile}
            activeMatch={activeMatch}
            isLoadingAI={isLoadingAI}
            onRequestRefactor={onRequestRefactor}
          />
        </div>
      </div>
    </div>
  );
};

export default EditorColumn;