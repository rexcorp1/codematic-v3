import React, { useState, useCallback, useRef, useEffect } from 'react';
import { WebContainer, auth } from '@webcontainer/api';
import Sidebar from './Sidebar';
import MainHeader from './MainHeader';
import AssistantPanel from './AssistantPanel';
import EditorColumn from './EditorColumn';
import PreviewPanel from './PreviewPanel';
import TerminalPanel from './TerminalPanel';
import SearchPanel from './SearchPanel';
import { INITIAL_PROJECT_STRUCTURE, findFileByPath, addOrUpdateFileByPath, deleteNodeByPath, zipProject, findMentionedFiles, addNodeToTree, addFileToTree, searchInProject, getLanguageForFile, projectStructureToWebContainerFiles, getAllPaths } from '../lib/project-utils';
import { FileNode, Attachment, SearchResult, SearchMatch } from '../types';
import { generateCodeFromPrompt } from '../lib/ai';
import { AiResponse } from '../lib/ai';
import { useToast } from '../contexts/ToastContext';
import Icon from './Icon';
import SourceControlPanel from './SourceControlPanel';
import DeployPanel from './DeployPanel';
import { Project } from '../App';

type WebContainerStatus = 'booting' | 'installing' | 'starting-server' | 'ready' | 'error' | 'idle';

interface IDEViewProps {
    project: Project;
    onExit: () => void;
    onUpdate: (id: string, updates: Partial<Project>) => void;
}

const IDEView: React.FC<IDEViewProps> = ({ project, onExit, onUpdate }) => {
  const { addToast } = useToast();

  const [projectName, setProjectName] = useState<string>(project.name);
  const [projectStructure, setProjectStructure] = useState<FileNode[]>(project.structure);
  const [history, setHistory] = useState<FileNode[][]>([project.structure]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const [openFiles, setOpenFiles] = useState<FileNode[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [selectedNodePaths, setSelectedNodePaths] = useState<string[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  const [viewState, setViewState] = useState({
    activeLeftPanel: 'assistant' as 'assistant' | 'search' | 'source_control' | 'deploy' | 'none',
    editorVisible: true,
    previewVisible: true,
  });

  const [leftPanelWidth, setLeftPanelWidth] = useState(20);
  const [editorPreviewWidths, setEditorPreviewWidths] = useState([65, 35]);
  const [terminalHeight, setTerminalHeight] = useState(250);
  const [isTerminalCollapsed, setTerminalCollapsed] = useState(false);
  const [isPreviewFullscreen, setPreviewFullscreen] = useState(false);
  
  const [isLoadingAI, setIsLoadingAI] = useState(false);
  const [aiMessage, setAiMessage] = useState<string>("Hello! I'm your AI code assistant. What should we build or change today?");
  const [isRenamingProject, setIsRenamingProject] = useState(false);
  const [showNewProjectConfirm, setShowNewProjectConfirm] = useState(false);
  
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [activeMatch, setActiveMatch] = useState<{ path: string; lineNumber: number } | null>(null);
  const [searchQuery, setSearchQuery] = useState<{ query: string; options: { isCaseSensitive: boolean; isRegex: boolean; isWholeWord: boolean; } } | null>(null);
  const [lastSearchRegex, setLastSearchRegex] = useState<RegExp | null>(null);
  const [focusOnSearchPanel, setFocusOnSearchPanel] = useState<'search' | 'replace' | null>(null);
  const [showReplaceAllConfirm, setShowReplaceAllConfirm] = useState<{ results: SearchResult[], replaceText: string } | null>(null);
  
  const [isRefactorModalOpen, setIsRefactorModalOpen] = useState(false);
  const [refactorData, setRefactorData] = useState<{ path: string; selectedCode: string; } | null>(null);
  const [refactorPrompt, setRefactorPrompt] = useState('');

  const [nodesToDelete, setNodesToDelete] = useState<FileNode[] | null>(null);

  const [streamingFileOverrides, setStreamingFileOverrides] = useState<Record<string, string>>({});

  const webContainerRef = useRef<WebContainer | null>(null);
  const [wcStatus, setWcStatus] = useState<WebContainerStatus>('booting');
  const [wcStatusMessage, setWcStatusMessage] = useState('Initializing Environment...');
  const [previewUrl, setPreviewUrl] = useState('');
  const terminalWriteEmitterRef = useRef<((data: string) => void) | null>(null);
  const logQueue = useRef<string[]>([]);
  const [allLogs, setAllLogs] = useState('');

  const topLevelContentRef = useRef<HTMLDivElement>(null);
  const rightStackContentRef = useRef<HTMLDivElement>(null);
  const resizerTypeRef = useRef<'left-panel' | 'editor-preview' | 'terminal' | null>(null);
  const resizeStartDataRef = useRef<{
    initialMouseX: number;
    initialMouseY: number;
    initialLeftPanelWidth: number;
    initialEditorWidth: number;
    initialTerminalHeight: number;
  } | null>(null);
  const animationFrameId = useRef<number | null>(null);
  
  useEffect(() => {
    const boot = async () => {
      try {
        auth.init({
          clientId: 'wc_api_omniverse1.cloud_b66afb6473f0f9664ad2dcc56e22d006',
          scope: '',
        });

        setWcStatus('booting');
        setWcStatusMessage('Booting WebContainer...');
        const wc = await WebContainer.boot();
        webContainerRef.current = wc;

        wc.on('server-ready', (port, url) => {
          setWcStatus('ready');
          setPreviewUrl(url);
          setWcStatusMessage('Live preview is ready!');
          addToast('Vite server is running!', 'success');
        });

        wc.on('error', (err) => {
          setWcStatus('error');
          const errorMessage = `Error: ${err.message}`;
          setWcStatusMessage(errorMessage);
          addToast(`WebContainer Error: ${err.message}`, 'error');
          setAllLogs(prev => prev + `\n[WebContainer Error]: ${err.message}`);
        });
        
        setWcStatusMessage('Mounting project files...');
        const files = projectStructureToWebContainerFiles(projectStructure);
        await wc.mount(files);
        
        const pkgNode = findFileByPath(projectStructure, '/package.json');
        if (pkgNode && pkgNode.content) {
            await wc.fs.writeFile('/package.json', pkgNode.content);
        } else {
            throw new Error('Critical Error: Could not find package.json to mount.');
        }

        const handleProcessOutput = (data: string) => {
            setAllLogs(prev => prev + data);
            if (terminalWriteEmitterRef.current) {
                terminalWriteEmitterRef.current(data);
            } else {
                logQueue.current.push(data);
            }
        };

        setWcStatus('installing');
        setWcStatusMessage('Running npm install...');
        const installProcess = await wc.spawn('npm', ['install']);
        installProcess.output.pipeTo(new WritableStream({ write: handleProcessOutput }));
        const installExitCode = await installProcess.exit;
        if (installExitCode !== 0) {
          throw new Error(`Installation failed with exit code: ${installExitCode}`);
        }
        
        setWcStatus('starting-server');
        setWcStatusMessage('Starting development server...');
        const startProcess = await wc.spawn('npm', ['run', 'dev']);
        startProcess.output.pipeTo(new WritableStream({ write: handleProcessOutput }));

      } catch (err: unknown) {
        setWcStatus('error');
        const errorMessage = err instanceof Error ? err.message : String(err);
        setWcStatusMessage(`Error: ${errorMessage}`);
        addToast(`Initialization failed: ${errorMessage}`, 'error');
        setAllLogs(prev => prev + `\n[Initialization Error]: ${errorMessage}`);
      }
    };
    
    boot();
    
    return () => {
        webContainerRef.current?.teardown();
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id]); // Re-boots when project ID changes

    const handleOpenFile = useCallback((path: string) => {
        const file = findFileByPath(projectStructure, path);
        if (file && file.type === 'file') {
        setOpenFiles(prevOpenFiles => {
            if (prevOpenFiles.some(f => f.path === path)) {
            return prevOpenFiles;
            }
            return [...prevOpenFiles, file];
        });
        setActiveFilePath(path);
        setSelectedNodePaths([path]);
        setActiveMatch(null); 
        }
    }, [projectStructure]);

    useEffect(() => {
        onUpdate(project.id, { structure: projectStructure });
    }, [projectStructure]);

    useEffect(() => {
        onUpdate(project.id, { name: projectName });
    }, [projectName]);
  
    useEffect(() => {
        if (projectStructure.length > 0 && openFiles.length === 0) {
            const defaultFile = findFileByPath(projectStructure, '/src/App.tsx');
            if (defaultFile) {
                handleOpenFile(defaultFile.path);
            }
        }
    }, [projectStructure, openFiles, handleOpenFile]);
  
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey || e.metaKey) {
            if (e.key.toLowerCase() === 'f') {
            e.preventDefault();
            setViewState(prev => ({ ...prev, activeLeftPanel: 'search' }));
            setFocusOnSearchPanel('search');
            }
            if (e.key.toLowerCase() === 'h') {
            e.preventDefault();
            setViewState(prev => ({ ...prev, activeLeftPanel: 'search' }));
            setFocusOnSearchPanel('replace');
            }
        }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        return () => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        };
    }, []);
  
    useEffect(() => {
        setOpenFiles(prevOpenFiles =>
        prevOpenFiles.map(openedFile => findFileByPath(projectStructure, openedFile.path)).filter(Boolean) as FileNode[]
        );
    }, [projectStructure]);

    const pushHistory = useCallback((newStructure: FileNode[]) => {
        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(newStructure);
        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        setProjectStructure(newStructure);
    }, [history, historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex <= 0) return;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setProjectStructure(history[newIndex]);
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex >= history.length - 1) return;
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setProjectStructure(history[newIndex]);
    }, [history, historyIndex]);

    const canUndo = historyIndex > 0;
    const canRedo = historyIndex < history.length - 1;

    const handleTogglePanel = (panel: 'editor' | 'preview') => {
        const key = panel === 'editor' ? 'editorVisible' : 'previewVisible';
        setViewState(prev => ({ ...prev, [key]: !prev[key] }));
    };
    const handleSetLeftPanel = (panel: 'assistant' | 'search' | 'source_control' | 'deploy') => {
        setViewState(prev => ({ ...prev, activeLeftPanel: prev.activeLeftPanel === panel ? 'none' : panel }));
    }

    const handleTogglePreviewFullscreen = () => setPreviewFullscreen(prev => !prev);
    const handleToggleTerminal = () => setTerminalCollapsed(prev => !prev);

    const handleResize = useCallback((e: MouseEvent) => {
        e.preventDefault();
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        animationFrameId.current = requestAnimationFrame(() => {
        if (!resizerTypeRef.current || !resizeStartDataRef.current) return;
        const { clientX, clientY } = e;
        const startData = resizeStartDataRef.current;
        if (resizerTypeRef.current === 'left-panel') {
            if (!topLevelContentRef.current) return;
            const totalWidth = topLevelContentRef.current.offsetWidth;
            const newWidthPercent = ((startData.initialLeftPanelWidth + (clientX - startData.initialMouseX)) / totalWidth) * 100;
            if (newWidthPercent > 15 && newWidthPercent < 50) setLeftPanelWidth(newWidthPercent);
        } else if (resizerTypeRef.current === 'editor-preview') {
            if (!rightStackContentRef.current) return;
            const totalWidth = rightStackContentRef.current.offsetWidth;
            const newWidthPercent = ((startData.initialEditorWidth + (clientX - startData.initialMouseX)) / totalWidth) * 100;
            if (newWidthPercent > 10 && newWidthPercent < 90) setEditorPreviewWidths([newWidthPercent, 100 - newWidthPercent]);
        } else if (resizerTypeRef.current === 'terminal') {
            const newHeight = startData.initialTerminalHeight - (clientY - startData.initialMouseY);
            if (newHeight > 40 && newHeight < window.innerHeight - 200) setTerminalHeight(newHeight);
        }
        });
    }, []);

    const stopResizing = useCallback(() => {
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
        resizerTypeRef.current = null;
        resizeStartDataRef.current = null;
        window.removeEventListener('mousemove', handleResize);
        window.removeEventListener('mouseup', stopResizing);
        document.body.style.cursor = 'default';
        document.body.style.userSelect = 'auto';
    }, [handleResize]);

    const startResize = (e: React.MouseEvent, type: 'left-panel' | 'editor-preview' | 'terminal') => {
        e.preventDefault();
        resizerTypeRef.current = type;
        document.body.style.cursor = type === 'terminal' ? 'row-resize' : 'col-resize';
        document.body.style.userSelect = 'none';
        resizeStartDataRef.current = {
            initialMouseX: e.clientX,
            initialMouseY: e.clientY,
            initialLeftPanelWidth: viewState.activeLeftPanel !== 'none' && topLevelContentRef.current?.children[0] ? (topLevelContentRef.current.children[0] as HTMLElement).offsetWidth : 0,
            initialEditorWidth: viewState.editorVisible && rightStackContentRef.current?.children[0] ? (rightStackContentRef.current.children[0] as HTMLElement).offsetWidth : 0,
            initialTerminalHeight: terminalHeight,
        };
        window.addEventListener('mousemove', handleResize);
        window.addEventListener('mouseup', stopResizing);
    };

    const handleCloseFile = (path: string) => {
        const newOpenFiles = openFiles.filter(f => f.path !== path);
        if (activeFilePath === path) {
        const closingIndex = openFiles.findIndex(f => f.path === path);
        setActiveFilePath(newOpenFiles.length > 0 ? newOpenFiles[Math.max(0, closingIndex - 1)].path : null);
        }
        setOpenFiles(newOpenFiles);
    };
  
    const handleFileContentChange = useCallback(async (path: string, content: string) => {
        if(isLoadingAI) return;
        const wc = webContainerRef.current;
        if (wc && wcStatus === 'ready') {
        await wc.fs.writeFile(path, content);
        }
        const newStructure = addOrUpdateFileByPath(projectStructure, path, content);
        pushHistory(newStructure);
        setHasUnsavedChanges(true);
        return newStructure;
    }, [projectStructure, pushHistory, isLoadingAI, wcStatus]);

    const handleSaveProject = useCallback(() => {
        addToast('Project changes saved!', 'success');
        setHasUnsavedChanges(false);
    }, [addToast]);
    
    const handleNewProject = () => {
        setShowNewProjectConfirm(true);
    };

    const confirmNewProject = useCallback(() => {
        addToast('Creating new project... environment will reload.', 'success');
        onUpdate(project.id, {
            name: 'New-Codematic-App',
            structure: JSON.parse(JSON.stringify(INITIAL_PROJECT_STRUCTURE))
        });
        setShowNewProjectConfirm(false);
        // A full reload might be needed if state isn't perfectly reset
        setTimeout(() => window.location.reload(), 500);
    }, [addToast, onUpdate, project.id]);

    const cancelNewProject = () => {
        setShowNewProjectConfirm(false);
    };

    const handleToggleRenameProject = () => setIsRenamingProject(prev => !prev);

    const handleRenameProject = (newName: string) => {
        if(newName.trim()) {
            setProjectName(newName.trim());
            addToast('Project renamed successfully!', 'success');
        }
        setIsRenamingProject(false);
    };

    const handleDownloadProject = useCallback(async () => {
        if (projectStructure.length === 0) {
            addToast("Cannot download an empty project.", "warning");
            return;
        }
        addToast("Zipping your project... please wait.", "info");
        try {
            await zipProject(projectStructure, projectName);
        } catch (error) {
            console.error("Failed to zip project", error);
            addToast("Failed to create ZIP file.", "error");
        }
    }, [projectStructure, projectName, addToast]);
  
    const applyAiChanges = async (response: AiResponse) => {
        setAiMessage(""); // Clear "Thinking..."
        const summaryWords = response.summary.split(/(\s+)/); // Split by space, keeping spaces
        for (const word of summaryWords) {
            setAiMessage(prev => prev + word);
            await new Promise(res => setTimeout(res, 25));
        }

        const hasDeletions = response.filesToDelete && response.filesToDelete.length > 0;
        const hasUpdates = response.filesToUpdate && response.filesToUpdate.length > 0;
        
        if (!hasDeletions && !hasUpdates) {
            return;
        }

        let finalStructure = projectStructure;

        if (hasDeletions) {
            for (const file of response.filesToDelete!) {
            finalStructure = deleteNodeByPath(finalStructure, file.path);
            if (webContainerRef.current) {
                try {
                await webContainerRef.current.fs.rm(file.path, { recursive: true });
                } catch (e) {
                console.warn(`AI requested to delete a non-existent file: ${file.path}`, e);
                }
            }
            }
        }

        if (hasUpdates) {
            for (const fileToUpdate of response.filesToUpdate!) {
                if (webContainerRef.current) {
                    const parentDir = fileToUpdate.path.substring(0, fileToUpdate.path.lastIndexOf('/'));
                    if (parentDir) {
                        await webContainerRef.current.fs.mkdir(parentDir, { recursive: true });
                    }
                    await webContainerRef.current.fs.writeFile(fileToUpdate.path, fileToUpdate.content);
                }
                finalStructure = addOrUpdateFileByPath(finalStructure, fileToUpdate.path, fileToUpdate.content);
            }
        }
        
        pushHistory(finalStructure);

        if(hasUpdates) {
            response.filesToUpdate!.forEach(file => handleOpenFile(file.path));
        }

        addToast("AI changes applied successfully!", "success");
        setHasUnsavedChanges(true);
    };

    const handleSendPrompt = useCallback(async (prompt: string, attachments: Attachment[]) => {
        if ((!prompt && attachments.length === 0) || isLoadingAI) return;
        setIsLoadingAI(true);
        setAiMessage("Thinking... I'm analyzing the project and your request.");
        setStreamingFileOverrides({});
        
        const mentionedFiles = findMentionedFiles(prompt, projectStructure);
        let finalPrompt = prompt;

        if (mentionedFiles.length > 0 && !prompt.includes("The user wants to refactor")) {
            const filePaths = mentionedFiles.map(f => f.path);
            const focusMessage = `The user is specifically referencing these files: ${filePaths.join(', ')}. Please pay special attention to them when making changes. The original prompt is below.\n\n`;
            finalPrompt = focusMessage + prompt;
        }
        
        const aiResponse = await generateCodeFromPrompt(finalPrompt, projectStructure, attachments);
        if (aiResponse) {
            await applyAiChanges(aiResponse);
        } else {
            setAiMessage("Sorry, I encountered an error and couldn't process your request. Please check the console for details and try again.");
            addToast("AI request failed.", "error");
        }
        setIsLoadingAI(false);
    }, [projectStructure, isLoadingAI, addToast, handleOpenFile, pushHistory]);


    const handleRefreshPreview = useCallback(() => {
        addToast('Preview manually refreshed.', 'info');
        const iframe = document.querySelector('iframe');
        if(iframe) iframe.contentWindow?.location.reload();
    }, [addToast]);
  
    const handleRequestRefactor = useCallback((path: string, selectedCode: string) => {
        if(isLoadingAI) {
        addToast("Please wait for the current AI task to complete.", "warning");
        return;
        }
        setRefactorData({ path, selectedCode });
        setIsRefactorModalOpen(true);
    }, [isLoadingAI, addToast]);
  
    const handleConfirmRefactor = useCallback(async () => {
        if (!refactorData || !refactorPrompt.trim()) return;

        const { path, selectedCode } = refactorData;

        const finalPrompt = `The user wants to refactor a specific piece of code.

    **Context:** The request is for the file at path: \`${path}\`

    **User's Refactoring Instruction:** "${refactorPrompt}"

    **Code to be Refactored:**
    \`\`\`${getLanguageForFile(path)}
    ${selectedCode}
    \`\`\`

    Based on the instruction, please provide the new, complete, and refactored content for the entire file at \`${path}\`. Ensure your response modifies only this file and provides a summary of the changes.`;

        setIsRefactorModalOpen(false);
        setRefactorPrompt('');
        setRefactorData(null);
        await handleSendPrompt(finalPrompt, []);
    }, [refactorData, refactorPrompt, handleSendPrompt]);

    const handleRefreshWorkspace = useCallback(() => {
        addToast('Workspace refreshed. Reloading environment...', 'info');
        window.location.reload();
    }, [addToast]);

    const handleAddNode = useCallback(async (parentPath: string, nodeName: string, type: 'file' | 'folder') => {
        try {
            const newNodePath = parentPath === '/' ? `/${nodeName}` : `${parentPath}/${nodeName}`;
            if (webContainerRef.current) {
            if (type === 'folder') {
                await webContainerRef.current.fs.mkdir(newNodePath, { recursive: true });
            } else {
                await webContainerRef.current.fs.writeFile(newNodePath, '');
            }
            }
            
            const newProjectStructure = addNodeToTree(projectStructure, parentPath, nodeName, type);
            pushHistory(newProjectStructure);
            
            if (type === 'file') {
                handleOpenFile(newNodePath);
            }
            
            addToast(`${type === 'file' ? 'File' : 'Folder'} '${nodeName}' created successfully.`, 'success');
            setHasUnsavedChanges(true);
        } catch (error) {
            // FIX: Argument of type 'unknown' is not assignable to parameter of type 'string'.
            // Safely handle errors of type `unknown` from the catch block.
            if (error instanceof Error) {
                addToast(error.message, 'error');
            } else {
                addToast(String(error), 'error');
            }
        }
    }, [projectStructure, addToast, handleOpenFile, pushHistory]);

    const handleRequestDelete = useCallback((paths: string[]) => {
        if (paths.length === 0) return;

        const nodes = paths.map(p => findFileByPath(projectStructure, p)).filter(Boolean) as FileNode[];
        if (nodes.length === 0) return;

        const protectedItem = nodes.find(n => ['/package.json', '/src', '/public', '/index.html', '/vite.config.ts'].includes(n.path));
        if (protectedItem) {
            addToast(`Core item "${protectedItem.name}" cannot be deleted.`, "warning");
            return;
        }
        
        setNodesToDelete(nodes);
    }, [projectStructure, addToast]);

    const handleCancelDelete = () => {
        setNodesToDelete(null);
    };
  
    const handleConfirmDelete = useCallback(async () => {
        if (!nodesToDelete || nodesToDelete.length === 0) return;

        let tempStructure = projectStructure;
        let tempOpenFiles = [...openFiles];
        let tempActiveFile = activeFilePath;
        
        for (const node of nodesToDelete) {
            if (webContainerRef.current) {
                await webContainerRef.current.fs.rm(node.path, { recursive: true });
            }
            tempStructure = deleteNodeByPath(tempStructure, node.path);
            
            tempOpenFiles = tempOpenFiles.filter(f => !f.path.startsWith(node.path));
            if (tempActiveFile && tempActiveFile.startsWith(node.path)) {
                tempActiveFile = null;
            }
        }
        
        if (!tempActiveFile && tempOpenFiles.length > 0) {
            tempActiveFile = tempOpenFiles[tempOpenFiles.length - 1].path;
        }
        
        setOpenFiles(tempOpenFiles);
        setActiveFilePath(tempActiveFile);
        pushHistory(tempStructure);
        
        addToast(`${nodesToDelete.length} item(s) deleted.`, 'success');
        setHasUnsavedChanges(true);
        setSelectedNodePaths([]);
        setNodesToDelete(null);
    }, [projectStructure, openFiles, activeFilePath, addToast, pushHistory, nodesToDelete]);

    const handleRenameNode = useCallback(async (path: string, newName: string) => {
        if (isLoadingAI) {
        addToast("Please wait for the current AI task to complete.", "warning");
        return;
        }
        const node = findFileByPath(projectStructure, path);
        if (!node) {
        addToast(`Could not find node at path: ${path}`, 'error');
        return;
        }

        const parentPath = path.substring(0, path.lastIndexOf('/'));
        const newPath = `${parentPath}/${newName}`;

        const prompt = `I want to rename the ${node.type} at path "${path}" to "${newName}". Its new path will be "${newPath}". Please perform this rename and also update all import/export statements across the entire project that reference the old path to point to the new path. Provide the complete updated content for all affected files.`;

        addToast(`Asking AI to rename and refactor imports...`, 'info');
        await handleSendPrompt(prompt, []);
    }, [projectStructure, handleSendPrompt, addToast, isLoadingAI]);

    const handleMoveNode = useCallback(async (sourcePath: string, targetParentPath: string) => {
        if (isLoadingAI) {
        addToast("Please wait for the current AI task to complete.", "warning");
        return;
        }
        const node = findFileByPath(projectStructure, sourcePath);
        if (!node) {
        addToast(`Could not find node at path: ${sourcePath}`, 'error');
        return;
        }
        if (sourcePath === targetParentPath || (node.type === 'folder' && targetParentPath.startsWith(sourcePath + '/'))) {
            addToast("Invalid move operation: cannot move a folder into itself.", "warning");
            return;
        }

        const prompt = `I want to move the ${node.type} from its current location at "${sourcePath}" to the target directory "${targetParentPath}". You MUST update all import/export statements across the entire project to reflect the new location. Provide the complete updated content for all affected files.`;
        
        addToast(`Asking AI to move and refactor imports...`, 'info');
        await handleSendPrompt(prompt, []);
    }, [projectStructure, handleSendPrompt, addToast, isLoadingAI]);
  
    const handleUploadFiles = useCallback(async (parentPath: string, fileList: FileList) => {
        addToast(`Uploading ${fileList.length} file(s)...`, 'info');
        
        const filePromises = Array.from(fileList).map(file => {
            return new Promise<{name: string, content: string | ArrayBuffer}>((resolve, reject) => {
                const reader = new FileReader();
                // FIX: Safely handle FileReader result. `e.target.result` can be null.
                // This check ensures we only resolve the promise with non-null content.
                reader.onload = (e) => {
                    if (e.target?.result != null) {
                        resolve({ name: file.name, content: e.target.result });
                    } else {
                        reject(new Error(`Failed to read content of ${file.name}`));
                    }
                };
                reader.onerror = reject;

                if (file.type.startsWith('image/')) {
                    reader.readAsArrayBuffer(file);
                } else {
                    reader.readAsText(file);
                }
            });
        });

        try {
            const files = await Promise.all(filePromises);
            let tempStructure = projectStructure;
            for(const file of files) {
                const newPath = parentPath === '/' ? `/${file.name}` : `${parentPath}/${file.name}`;
                const content = file.content instanceof ArrayBuffer ? new Uint8Array(file.content) : file.content;
                if (webContainerRef.current) {
                    await webContainerRef.current.fs.writeFile(newPath, content);
                }
                tempStructure = addFileToTree(tempStructure, parentPath, { name: file.name, content: typeof content === 'string' ? content : '[binary data]' });
            }
            pushHistory(tempStructure);
            setHasUnsavedChanges(true);
            addToast('Upload complete!', 'success');
        } catch (error) {
            // FIX: Argument of type 'unknown' is not assignable to parameter of type 'string'.
            // Safely handle errors of type `unknown` from the catch block.
            if (error instanceof Error) {
                addToast(error.message, 'error');
            } else {
                addToast(String(error), 'error');
            }
            console.error(error);
        }

    }, [projectStructure, addToast, pushHistory]);

    const handleSearch = useCallback((query: string, options: { isCaseSensitive: boolean, isRegex: boolean, isWholeWord: boolean }) => {
        setSearchQuery({ query, options });
        if (!query) {
            setSearchResults([]);
            setActiveMatch(null);
            setLastSearchRegex(null);
            return;
        }
        
        let regex: RegExp;
        try {
            let pattern = options.isRegex ? query : query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
            if (!options.isRegex && options.isWholeWord) {
                pattern = `\\b${pattern}\\b`;
            }
            const flags = options.isCaseSensitive ? 'g' : 'gi';
            regex = new RegExp(pattern, flags);
        } catch (e) {
            addToast("Invalid regular expression.", "error");
            return;
        }
        setLastSearchRegex(regex);

        const results = searchInProject(projectStructure, query, options);
        setSearchResults(results);
        setActiveMatch(null);
    }, [projectStructure, addToast]);

    const handleResultClick = useCallback((path: string, lineNumber: number) => {
        const file = findFileByPath(projectStructure, path);
        if (file && file.type === 'file') {
        setOpenFiles(prevOpenFiles => {
            if (prevOpenFiles.some(f => f.path === path)) {
            return prevOpenFiles;
            }
            return [...prevOpenFiles, file];
        });
        setActiveFilePath(path);
        setSelectedNodePaths([path]);
        setActiveMatch({ path, lineNumber });
        }
    }, [projectStructure]);

    const handleReplaceOne = useCallback(async (path: string, match: SearchMatch, replaceText: string) => {
        if (!lastSearchRegex) return;

        const file = findFileByPath(projectStructure, path);
        if (!file || typeof file.content !== 'string') return;

        const lines = file.content.split('\n');
        const lineIndex = match.lineNumber - 1;

        if (lines[lineIndex] !== undefined) {
        const lineRegex = new RegExp(lastSearchRegex.source, lastSearchRegex.flags.replace('g', ''));
        lines[lineIndex] = match.content.replace(lineRegex, replaceText);
        
        const newContent = lines.join('\n');
        const newStructure = await handleFileContentChange(path, newContent);

        if (searchQuery && newStructure) {
            const newResults = searchInProject(newStructure, searchQuery.query, searchQuery.options);
            setSearchResults(newResults);
            const currentMatchIndex = newResults.flatMap(r => r.matches).findIndex(m => m.lineNumber > lineIndex);
            if (currentMatchIndex !== -1) {
                const nextMatch = newResults.flatMap(r => r.matches)[currentMatchIndex];
                setActiveMatch({path: path, lineNumber: nextMatch.lineNumber});
            }
        }
        }
    }, [lastSearchRegex, projectStructure, handleFileContentChange, searchQuery]);

    const confirmReplaceAll = useCallback(async () => {
        if (!showReplaceAllConfirm || !lastSearchRegex) return;

        const { results: resultsToReplace, replaceText } = showReplaceAllConfirm;

        let tempStructure = projectStructure;
        const filePathsWithChanges = [...new Set(resultsToReplace.map(r => r.path))];
        let totalReplaced = 0;

        for(const path of filePathsWithChanges) {
            const fileNode = findFileByPath(tempStructure, path);
            if (fileNode?.content) {
                const matches = fileNode.content.match(lastSearchRegex);
                totalReplaced += matches ? matches.length : 0;
                const newContent = fileNode.content.replace(lastSearchRegex, replaceText);
                if(webContainerRef.current) {
                    await webContainerRef.current.fs.writeFile(path, newContent);
                }
                tempStructure = addOrUpdateFileByPath(tempStructure, path, newContent);
            }
        }
        
        pushHistory(tempStructure);
        addToast(`${totalReplaced} occurrence(s) replaced across ${filePathsWithChanges.length} file(s).`, 'success');
        setSearchResults([]);
        setSearchQuery(null);
        setShowReplaceAllConfirm(null);
    }, [showReplaceAllConfirm, lastSearchRegex, projectStructure, addToast, pushHistory]);
  
    const cancelReplaceAll = () => {
        setShowReplaceAllConfirm(null);
    }

    const handleTerminalMount = useCallback((emitter: (data: string) => void) => {
        terminalWriteEmitterRef.current = emitter;
        if (logQueue.current.length > 0) {
            emitter(logQueue.current.join(''));
            logQueue.current = [];
        }
    }, []);

    const handleSelectNodes = useCallback((path: string, isToggle: boolean) => {
        setSelectedNodePaths(prev => {
            if (!isToggle) {
                return [path];
            }
            if (prev.includes(path)) {
                return prev.filter(p => p !== path);
            }
            return [...prev, path];
        });
    }, []);
  
    const handleSelectAllNodes = useCallback(() => {
        const allPaths = getAllPaths(projectStructure);
        setSelectedNodePaths(allPaths);
    }, [projectStructure]);

    if (isPreviewFullscreen) {
        return (
        <div className="h-screen w-screen bg-white dark:bg-[#0d1117]">
            <PreviewPanel 
                isPreviewFullscreen 
                onToggleFullscreen={handleTogglePreviewFullscreen} 
                onRefresh={handleRefreshPreview}
                status={wcStatus}
                url={previewUrl}
            />
        </div>
        );
    }

    return (
        <>
        {wcStatus !== 'ready' && wcStatus !== 'error' && (
            <div className="absolute inset-0 bg-slate-800/80 flex items-center justify-center z-[10000] text-white flex-col gap-4 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                <div className="text-center">
                <p className="text-lg font-semibold">{wcStatusMessage}</p>
                <p className="text-sm opacity-70">This might take a moment, especially on first load.</p>
                </div>
            </div>
        )}
        <div className="h-screen w-screen bg-white dark:bg-[#0d1117] text-slate-800 dark:text-slate-300 flex overflow-hidden">
            <Sidebar activePanel={viewState.activeLeftPanel} onSetPanel={handleSetLeftPanel} />
            <div className="flex flex-col flex-1">
            <MainHeader
                projectName={projectName}
                isRenaming={isRenamingProject}
                onToggleRename={handleToggleRenameProject}
                onRename={handleRenameProject}
                onNewProject={handleNewProject}
                onSaveProject={handleSaveProject}
                onDownloadProject={handleDownloadProject}
                panelVisibility={{
                    assistant: viewState.activeLeftPanel === 'assistant',
                    editor: viewState.editorVisible,
                    preview: viewState.previewVisible
                }}
                onTogglePanel={handleTogglePanel}
                hasUnsavedChanges={hasUnsavedChanges}
                onExitIDE={onExit}
            />
            <div ref={topLevelContentRef} className="flex-1 flex flex-row overflow-hidden">
                {viewState.activeLeftPanel !== 'none' && (
                    <div style={{ flexBasis: `${leftPanelWidth}%` }} className="h-full flex-shrink-0 min-w-[300px]">
                        {viewState.activeLeftPanel === 'assistant' && <AssistantPanel isLoading={isLoadingAI} message={aiMessage} onSend={handleSendPrompt} />}
                        {viewState.activeLeftPanel === 'search' && 
                            <SearchPanel 
                                onSearch={handleSearch} 
                                results={searchResults} 
                                onResultClick={handleResultClick} 
                                activeMatch={activeMatch}
                                onReplace={handleReplaceOne}
                                onReplaceAll={(results, replaceText) => {
                                    if(!replaceText.trim() || results.length === 0) return;
                                    setShowReplaceAllConfirm({ results, replaceText })
                                }}
                                focusOn={focusOnSearchPanel}
                                onFocusHandled={() => setFocusOnSearchPanel(null)}
                            />
                        }
                        {viewState.activeLeftPanel === 'source_control' && <SourceControlPanel />}
                        {viewState.activeLeftPanel === 'deploy' && <DeployPanel />}
                    </div>
                )}
                {viewState.activeLeftPanel !== 'none' && (viewState.editorVisible || viewState.previewVisible) && (
                    <div className="w-2 h-full cursor-col-resize flex justify-center items-center flex-shrink-0 group" onMouseDown={(e) => startResize(e, 'left-panel')}>
                        <div className="w-px h-full bg-slate-300 dark:bg-slate-700/50 group-hover:w-2 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-150 ease-in-out"></div>
                    </div>
                )}
                <div className="flex-1 flex flex-col overflow-hidden">
                    <main ref={rightStackContentRef} className="flex-1 flex flex-row overflow-hidden">
                        {viewState.editorVisible && (
                            <div style={{ flexBasis: viewState.previewVisible ? `${editorPreviewWidths[0]}%` : '100%' }} className="h-full min-w-0">
                                <EditorColumn 
                                    projectStructure={projectStructure} 
                                    openFiles={openFiles} 
                                    activeFilePath={activeFilePath} 
                                    onOpenFile={handleOpenFile} 
                                    onCloseFile={handleCloseFile} 
                                    onSelectTab={setActiveFilePath} 
                                    selectedNodePaths={selectedNodePaths}
                                    onSelectNodes={handleSelectNodes}
                                    onSelectAllNodes={handleSelectAllNodes}
                                    onClearSelection={() => setSelectedNodePaths([])}
                                    onFileContentChange={handleFileContentChange}
                                    onRefreshWorkspace={handleRefreshWorkspace}
                                    onAddNode={handleAddNode}
                                    onRequestDelete={handleRequestDelete}
                                    onRenameNode={handleRenameNode}
                                    onUploadFiles={handleUploadFiles}
                                    onMoveNode={handleMoveNode}
                                    onUndo={handleUndo}
                                    onRedo={handleRedo}
                                    canUndo={canUndo}
                                    canRedo={canRedo}
                                    searchResults={searchResults}
                                    activeMatch={activeMatch}
                                    streamingFileOverrides={streamingFileOverrides}
                                    isLoadingAI={isLoadingAI}
                                    onRequestRefactor={handleRequestRefactor}
                                />
                            </div>
                        )}
                        {viewState.editorVisible && viewState.previewVisible && (
                            <div className="w-2 h-full cursor-col-resize flex justify-center items-center flex-shrink-0 group" onMouseDown={(e) => startResize(e, 'editor-preview')}>
                                <div className="w-px h-full bg-slate-300 dark:bg-slate-700/50 group-hover:w-2 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-150 ease-in-out"></div>
                            </div>
                        )}
                        {viewState.previewVisible && (
                            <div style={{ flexBasis: viewState.editorVisible ? `${editorPreviewWidths[1]}%` : '100%' }} className="h-full min-w-0">
                                <PreviewPanel 
                                    isPreviewFullscreen={isPreviewFullscreen} 
                                    onToggleFullscreen={handleTogglePreviewFullscreen} 
                                    onRefresh={handleRefreshPreview}
                                    status={wcStatus}
                                    url={previewUrl}
                                />
                            </div>
                        )}
                    </main>
                    <div className="w-full h-2 cursor-row-resize flex justify-center items-center flex-shrink-0 group" onMouseDown={(e) => startResize(e, 'terminal')}>
                        <div className="h-px w-full bg-slate-300 dark:bg-slate-700/50 group-hover:h-2 group-hover:bg-blue-400 dark:group-hover:bg-blue-500 transition-all duration-150 ease-in-out"></div>
                    </div>
                    <div style={{ height: isTerminalCollapsed ? '36px' : `${terminalHeight}px` }} className="flex-shrink-0">
                        <TerminalPanel 
                            isCollapsed={isTerminalCollapsed} 
                            onToggle={handleToggleTerminal} 
                            webContainer={webContainerRef.current}
                            onMount={handleTerminalMount}
                            logs={allLogs}
                        />
                    </div>
                </div>
            </div>
            </div>
        </div>
        {showNewProjectConfirm && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                    <div className="sm:flex sm:items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                            <Icon name="warning" className="text-red-600 dark:text-red-400 text-2xl" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white" id="new-project-title">Create New Project</h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    This will replace the current project with a fresh Vite project. This action cannot be undone.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button 
                            type="button" 
                            onClick={confirmNewProject} 
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Create Project
                        </button>
                        <button 
                            type="button" 
                            onClick={cancelNewProject}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
        {showReplaceAllConfirm && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="replace-all-title">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                    <div className="sm:flex sm:items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                            <Icon name="warning" className="text-red-600 dark:text-red-400 text-2xl" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white" id="replace-all-title">Replace All</h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Are you sure you want to replace {showReplaceAllConfirm.results.reduce((sum, r) => sum + r.matches.length, 0)} occurrences in {showReplaceAllConfirm.results.length} files with "{showReplaceAllConfirm.replaceText}"? This action cannot be undone.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button 
                            type="button" 
                            onClick={confirmReplaceAll} 
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Replace All
                        </button>
                        <button 
                            type="button" 
                            onClick={cancelReplaceAll}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
        {isRefactorModalOpen && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="refactor-title">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-lg mx-4">
                    <div className="w-full">
                        <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white" id="refactor-title">Refactor with Code Assistant</h3>
                        <div className="mt-4">
                            <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                                Tell the assistant what you'd like to change about the selected code:
                            </p>
                            <textarea
                                value={refactorPrompt}
                                onChange={(e) => setRefactorPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleConfirmRefactor(); } }}
                                placeholder="e.g., Add comments, improve performance, convert to functional component..."
                                className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none text-slate-800 dark:text-slate-200 disabled:opacity-50"
                                rows={3}
                                autoFocus
                            />
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-6 sm:flex sm:flex-row-reverse gap-3">
                        <button 
                            type="button" 
                            onClick={handleConfirmRefactor}
                            disabled={!refactorPrompt.trim()}
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Refactor
                        </button>
                        <button 
                            type="button" 
                            onClick={() => setIsRefactorModalOpen(false)}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
        {nodesToDelete && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-node-title">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
                    <div className="sm:flex sm:items-start">
                        <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                            <Icon name="warning" className="text-red-600 dark:text-red-400 text-2xl" />
                        </div>
                        <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                            <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white" id="delete-node-title">
                                Delete {nodesToDelete.length} {nodesToDelete.length > 1 ? 'items' : 'item'}
                            </h3>
                            <div className="mt-2">
                                <p className="text-sm text-slate-600 dark:text-slate-400">
                                    Are you sure you want to delete {nodesToDelete.length > 1 ? `${nodesToDelete.length} selected items` : <strong className="font-semibold text-slate-700 dark:text-slate-200">{nodesToDelete[0].name}</strong>}?
                                    {nodesToDelete.some(n => n.type === 'folder') && ' Deleting a folder will remove all of its contents.'} This action cannot be undone.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
                        <button 
                            type="button" 
                            onClick={handleConfirmDelete} 
                            className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Delete
                        </button>
                        <button 
                            type="button" 
                            onClick={handleCancelDelete}
                            className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 sm:mt-0 sm:w-auto sm:text-sm dark:focus:ring-offset-slate-800"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
};

export default IDEView;