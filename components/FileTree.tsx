import React, { useState, useEffect, useRef } from 'react';
import { FileNode } from '../types';
import { FILE_ICONS } from '../lib/project-utils';
import Icon from './Icon';

interface NodeInputProps {
  type: 'file' | 'folder';
  onCommit: (name: string) => void;
  onCancel: () => void;
  defaultValue?: string;
}

const NodeInput: React.FC<NodeInputProps> = ({ type, onCommit, onCancel, defaultValue = '' }) => {
    const [name, setName] = useState(defaultValue);
    const inputRef = useRef<HTMLInputElement>(null);
    
    useEffect(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
    }, []);

    const handleSubmit = () => {
        if (name.trim() && !name.includes('/')) {
            onCommit(name.trim());
        } else {
            onCancel();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSubmit();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
        }
    };

    const iconName = type === 'folder' ? 'folder' : (FILE_ICONS[name.split('.').pop() || ''] || 'draft');
    const iconColor = type === 'folder' ? 'text-slate-500 dark:text-slate-400' : 'text-blue-500 dark:text-blue-400';

    return (
        <div className="flex items-center h-[22px] w-full">
            <div className="w-6 flex items-center justify-center shrink-0">
                 {/* Placeholder for chevron */}
            </div>
            <Icon name={iconName} className={`text-base mr-1.5 ${iconColor}`} />
            <input
                ref={inputRef}
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSubmit}
                className="bg-slate-100 dark:bg-slate-800 border border-blue-500 rounded-sm px-1 py-0 text-sm w-full h-[22px] focus:outline-none"
                placeholder={type === 'file' ? 'File name...' : 'Folder name...'}
            />
        </div>
    );
};

interface FileTreeProps {
  nodes: FileNode[];
  onSelectFile: (path: string) => void;
  selectedPaths: string[];
  onSelectNode: (path: string, isToggle: boolean) => void;
  creatingNodeInfo: { parentPath: string; type: 'file' | 'folder' } | null;
  onCommitCreation: (name: string) => void;
  onCancelCreation: () => void;
  renamingPath: string | null;
  onCommitRename: (name: string) => void;
  onCancelRename: () => void;
  onContextMenu: (event: React.MouseEvent, node: FileNode) => void;
  onMoveNode: (sourcePath: string, targetParentPath: string) => void;
}

const INDENT_WIDTH = 16; // in pixels

interface FileNodeComponentProps extends Omit<FileTreeProps, 'nodes' | 'level'> {
  node: FileNode;
  level: number;
}

const FileNodeComponent: React.FC<FileNodeComponentProps> = (props) => {
  const { node, onSelectFile, selectedPaths, level, onSelectNode, creatingNodeInfo, onCommitCreation, onCancelCreation, renamingPath, onCommitRename, onCancelRename, onContextMenu, onMoveNode } = props;
  const [isOpen, setIsOpen] = useState(true);
  const [isDragOver, setIsDragOver] = useState(false);
  
  const isFolder = node.type === 'folder';
  const extension = node.name.split('.').pop() || '';
  const iconName = isFolder ? 'folder' : (FILE_ICONS[extension] || 'draft');

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const isToggle = e.metaKey || e.ctrlKey;
    onSelectNode(node.path, isToggle);

    if (!isToggle) {
        if (isFolder) {
            setIsOpen(!isOpen);
        } else {
            onSelectFile(node.path);
        }
    }
  };

  const isSelected = selectedPaths.includes(node.path);
  const isRenaming = renamingPath === node.path;
  
  if (isRenaming) {
    return (
        <div style={{ paddingLeft: `${level * INDENT_WIDTH}px` }} className="pr-1">
             <NodeInput 
                type={node.type} 
                defaultValue={node.name} 
                onCommit={onCommitRename} 
                onCancel={onCancelRename} 
             />
        </div>
    )
  }
  
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/x-codematic-path', node.path);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const dragPath = e.dataTransfer.types.includes('application/x-codematic-path') ? e.dataTransfer.getData('application/x-codematic-path') : null;
      if (dragPath && dragPath !== node.path) {
        setIsDragOver(true);
      }
  };

  const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const sourcePath = e.dataTransfer.getData('application/x-codematic-path');
    if (!sourcePath || sourcePath === node.path) return;
    
    const targetParentPath = node.type === 'folder' 
        ? node.path 
        : (node.path.substring(0, node.path.lastIndexOf('/')) || '/');
        
    const sourceParentPath = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';
    if (sourcePath === targetParentPath || (node.type === 'folder' && targetParentPath.startsWith(sourcePath + '/'))) {
        // Prevent moving a folder into itself
        return;
    }
    if (sourceParentPath === targetParentPath && node.type !== 'folder') return; // no-op

    onMoveNode(sourcePath, targetParentPath);
  };


  return (
    <div>
      <div
        onClick={handleClick}
        onDoubleClick={() => { if(!isFolder) onSelectFile(node.path) }}
        onContextMenu={(e) => onContextMenu(e, node)}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        draggable
        className={`flex items-center h-[22px] pr-1 cursor-pointer rounded-[3px] text-sm transition-colors duration-100
        ${ isSelected ? 'bg-blue-600/20 dark:bg-slate-700/80' : 'hover:bg-slate-200/70 dark:hover:bg-slate-800/60'}
        ${isDragOver ? 'bg-blue-200/50 dark:bg-blue-800/40 ring-1 ring-blue-500/70' : ''}`}
      >
        <div style={{ width: `${level * INDENT_WIDTH}px` }} className="h-full shrink-0" />
        <div className="w-6 flex items-center justify-center shrink-0 text-slate-500 dark:text-slate-400">
          {isFolder && (
            <Icon name={isOpen ? 'expand_more' : 'chevron_right'} className="text-xl transition-transform" />
          )}
        </div>
        <Icon name={iconName} className={`text-base mr-1.5 ${isFolder ? 'text-slate-500 dark:text-slate-400' : 'text-blue-500 dark:text-blue-400'}`} />
        <span className="truncate pointer-events-none">{node.name}</span>
      </div>
      {isFolder && isOpen && (
        <div className="relative">
          <div 
            className="absolute top-0 bottom-0 w-px bg-slate-300/70 dark:bg-slate-600/50" 
            style={{ left: `${level * INDENT_WIDTH + 10}px` }}
          ></div>
          {node.children && node.children.map((child) => (
            <FileNodeComponent {...props} key={child.path} node={child} level={level + 1} />
          ))}
          {creatingNodeInfo?.parentPath === node.path && (
            <div style={{ paddingLeft: `${(level + 1) * INDENT_WIDTH}px` }} className="pr-1">
                <NodeInput 
                    type={creatingNodeInfo.type}
                    onCommit={onCommitCreation}
                    onCancel={onCancelCreation}
                />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const FileTree: React.FC<FileTreeProps> = (props) => {
  const { nodes, creatingNodeInfo, onCommitCreation, onCancelCreation, onMoveNode } = props;
  
  const handleDropOnRoot = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const sourcePath = e.dataTransfer.getData('application/x-codematic-path');
    if (!sourcePath) return;

    const sourceParent = sourcePath.substring(0, sourcePath.lastIndexOf('/')) || '/';
    if(sourceParent === '/') return; // Already in root

    onMoveNode(sourcePath, '/');
  };
  
  return (
    <div className="p-1 text-slate-800 dark:text-slate-200 h-full" onDragOver={e=>e.preventDefault()} onDrop={handleDropOnRoot}>
      {nodes.map((node) => (
        <FileNodeComponent {...props} key={node.path} node={node} level={0} />
      ))}
      {creatingNodeInfo?.parentPath === '/' && (
          <div style={{ paddingLeft: `0px` }} className="pr-1">
            <NodeInput
                type={creatingNodeInfo.type}
                onCommit={onCommitCreation}
                onCancel={onCancelCreation}
            />
          </div>
      )}
    </div>
  );
};

export default FileTree;