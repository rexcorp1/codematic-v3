import React, { useRef, useEffect, useMemo, useCallback } from 'react';
import { FileNode, SearchMatch } from '../types';
import { FILE_ICONS, getLanguageForFile } from '../lib/project-utils';
import Icon from './Icon';
import Editor, { Monaco } from '@monaco-editor/react';
import { useTheme } from '../contexts/ThemeContext';
import * as monaco from 'monaco-editor';

interface CodeEditorProps {
  file: FileNode | null;
  projectStructure: FileNode[]; // New prop
  onChange?: (path: string, content: string) => void;
  matchesForFile?: SearchMatch[];
  activeMatch?: { path: string; lineNumber: number } | null;
  isLoadingAI?: boolean;
  onRequestRefactor?: (path: string, selectedCode: string) => void;
}

const FileIcon: React.FC<{ filename: string }> = ({ filename }) => {
    const extension = filename.split('.').pop() || '';
    const iconName = FILE_ICONS[extension] || 'description';
    return <Icon name={iconName} className="text-base text-blue-500 dark:text-blue-400" />;
};


const CodeEditor: React.FC<CodeEditorProps> & { FileIcon: typeof FileIcon } = ({ 
  file,
  projectStructure, 
  onChange, 
  matchesForFile, 
  activeMatch, 
  isLoadingAI, 
  onRequestRefactor 
}) => {
  const { resolvedTheme } = useTheme();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const extraLibsRef = useRef<Map<string, monaco.IDisposable>>(new Map());
  const decorationIdsRef = useRef<string[]>([]);
  const actionAddedRef = useRef(false);

  // --- START: New logic for project-wide intellisense ---

  const allFiles = useMemo(() => {
    const files = new Map<string, string>();
    const walk = (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (node.type === 'file' && typeof node.content === 'string') {
          files.set(node.path, node.content);
        }
        if (node.children) {
          walk(node.children);
        }
      }
    };
    walk(projectStructure);
    return files;
  }, [projectStructure]);

  const updateTypeScriptLibs = useCallback((filesToUpdate: Map<string, string>) => {
    const monacoInstance = monacoRef.current;
    if (!monacoInstance) return;

    const allFileUris = new Set<string>();
    filesToUpdate.forEach((_, path) => allFileUris.add(`file://${path}`));
    
    // Add or update libs
    for (const [path, content] of filesToUpdate.entries()) {
        const uri = `file://${path}`;
        const currentLib = extraLibsRef.current.get(uri);
        // Using `getScriptVersion` is a potential optimization, but `addExtraLib` handles updates internally.
        // For simplicity and robustness, we dispose and re-add.
        if (currentLib) {
            currentLib.dispose();
        }
        // FIX: The `content` from a file node might not be a string. This type guard
        // ensures we only pass string content to `addExtraLib`, fixing a potential type error.
        const newLib = monacoInstance.languages.typescript.typescriptDefaults.addExtraLib(content, uri);
        extraLibsRef.current.set(uri, newLib);
    }
    
    // Clean up libs for deleted files
    const currentLibUris = new Set(extraLibsRef.current.keys());
    for (const uri of currentLibUris) {
        if (!allFileUris.has(uri)) {
            extraLibsRef.current.get(uri)?.dispose();
            extraLibsRef.current.delete(uri);
        }
    }
  }, []);

  useEffect(() => {
    if (monacoRef.current) {
      updateTypeScriptLibs(allFiles);
    }
  }, [allFiles, updateTypeScriptLibs]);

  // Cleanup on unmount
  useEffect(() => {
    const libs = extraLibsRef.current;
    return () => {
        for (const lib of libs.values()) {
            lib.dispose();
        }
        libs.clear();
    };
  }, []);

  // --- END: New logic ---

  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !file) return;

    const newDecorations: monaco.editor.IModelDeltaDecoration[] = [];

    if (matchesForFile && matchesForFile.length > 0) {
      matchesForFile.forEach(match => {
        const isMatchActive = activeMatch?.path === file.path && match.lineNumber === activeMatch.lineNumber;
        match.matchRanges.forEach(range => {
          newDecorations.push({
            range: new monaco.Range(match.lineNumber, range.start + 1, match.lineNumber, range.start + range.length + 1),
            options: {
              className: isMatchActive ? 'active-search-result-highlight' : 'search-result-highlight',
              zIndex: isMatchActive ? 1 : 0,
            }
          });
        });
      });
    }

    decorationIdsRef.current = editor.deltaDecorations(decorationIdsRef.current, newDecorations);
    
    if (activeMatch && activeMatch.path === file.path) {
      editor.revealLineInCenter(activeMatch.lineNumber, monaco.editor.ScrollType.Smooth);
    }
  }, [file, matchesForFile, activeMatch]);

  const handleEditorDidMount = (editor: monaco.editor.IStandaloneCodeEditor, m: typeof monaco) => {
    editorRef.current = editor;
    monacoRef.current = m;

    m.languages.typescript.typescriptDefaults.setCompilerOptions({
        target: m.languages.typescript.ScriptTarget.ESNext,
        moduleResolution: m.languages.typescript.ModuleResolutionKind.NodeJs,
        jsx: m.languages.typescript.JsxEmit.ReactJSX,
        allowSyntheticDefaultImports: true,
        esModuleInterop: true,
        allowNonTsExtensions: true,
    });
    
    // Initial sync of files
    updateTypeScriptLibs(allFiles);

    if (onRequestRefactor && !actionAddedRef.current) {
        editor.addAction({
            id: 'codematic-refactor',
            label: 'Refactor with AI...',
            contextMenuGroupId: 'navigation',
            contextMenuOrder: 1.5,
            keybindings: [m.KeyMod.CtrlCmd | m.KeyMod.Shift | m.KeyCode.KeyR],
            precondition: 'editorHasSelection',
            run: (ed) => {
                const selection = ed.getSelection();
                const model = ed.getModel();
                if (selection && model && file) {
                    const selectedText = model.getValueInRange(selection);
                    onRequestRefactor(file.path, selectedText);
                }
            },
        });
        actionAddedRef.current = true;
    }
  };

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500">
        Select a file to view its content.
      </div>
    );
  }
  
  const handleEditorChange = (value: string | undefined) => {
    if (onChange && value !== undefined) {
      onChange(file.path, value);
    }
  };

  const language = getLanguageForFile(file.name);

  return (
    <Editor
      height="100%"
      path={`file://${file.path}`} // Use file URI for model
      defaultLanguage={language}
      defaultValue={file.content}
      onChange={handleEditorChange}
      onMount={handleEditorDidMount}
      theme={resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light'}
      options={{
        minimap: { enabled: false },
        fontSize: 14,
        wordWrap: 'on',
        scrollBeyondLastLine: false,
        automaticLayout: true,
        fontFamily: "'JetBrains Mono', monospace",
        readOnly: isLoadingAI,
        contextmenu: true,
      }}
      key={file.path} // Re-mount editor when file path changes to ensure correct model
    />
  );
};

CodeEditor.FileIcon = FileIcon;
export default CodeEditor;