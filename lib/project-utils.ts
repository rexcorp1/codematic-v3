

import { FileNode, SearchResult, SearchMatch } from '../types';
import JSZip from 'jszip';
import { AiFile } from './ai';

export const FILE_ICONS: { [key: string]: string } = {
  tsx: 'code',
  ts: 'code',
  json: 'data_object',
  html: 'html',
  js: 'javascript',
  css: 'css',
  md: 'article',
  svg: 'image',
  png: 'image',
  jpg: 'image',
  jpeg: 'image',
  gif: 'image',
  ico: 'image',
};

const VITE_INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;

const VITE_CONFIG_TS = `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'require-corp',
      'Cross-Origin-Opener-Policy': 'same-origin',
    },
    // Enable polling for file changes to ensure HMR works in WebContainers
    watch: {
      usePolling: true,
    },
  },
})`;

const VITE_TSCONFIG_JSON = `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`;

const VITE_TSCONFIG_NODE_JSON = `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}`;

const VITE_ENV_D_TS = `/// <reference types="vite/client" />`;

const VITE_MAIN_TSX = `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`;

const VITE_APP_TSX = `import React from 'react';
import './App.css';

function App() {
  return (
    <div className="container">
      <div className="shape lilac"></div>
      <div className="shape green"></div>
      <div className="shape yellow-circle"></div>
      <svg className="shape squiggle" width="121" height="90" viewBox="0 0 121 90" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M118.5 2C118.5 2 92.5 2 73 17.5C53.5 33 26 88.5 2.5 88.5" stroke="#4ade80" strokeWidth="4" strokeLinecap="round"/>
      </svg>

      <main className="content">
        <h1>Let's build your app</h1>
        <p>This is a live Vite environment running in your browser!</p>
        <div className="prompt-box">
          ... or type what you want to build
        </div>
      </main>
    </div>
  );
}

export default App;`;

const VITE_APP_CSS = `body, html, #root {
  margin: 0;
  padding: 0;
  width: 100%;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
}

.container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  position: relative;
  overflow: hidden;
  background-color: #f7f8fa;
  padding: 1rem;
  box-sizing: border-box;
}

.content {
  text-align: center;
  z-index: 10;
}

h1 {
  font-size: clamp(2.5rem, 5vw, 4rem);
  font-weight: 800;
  color: #1a202c;
  margin-bottom: 0.5rem;
}

p {
  font-size: clamp(1rem, 2vw, 1.25rem);
  color: #4a5568;
  margin-bottom: 2rem;
}

.prompt-box {
  background-color: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 0.5rem;
  padding: 1rem 1.5rem;
  font-size: 1.1rem;
  color: #718096;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

.shape {
  position: absolute;
  pointer-events: none;
}

.lilac {
  width: 300px;
  height: 300px;
  background: linear-gradient(45deg, #d3cce3, #e9e4f0);
  border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  top: -50px;
  left: -50px;
  animation: morph 8s ease-in-out infinite;
}

.green {
  width: 200px;
  height: 200px;
  background: linear-gradient(45deg, #a8e063, #56ab2f);
  border-radius: 50%;
  bottom: -50px;
  right: -50px;
  opacity: 0.7;
}

.yellow-circle {
  width: 80px;
  height: 80px;
  background-color: #ffeb3b;
  border-radius: 50%;
  top: 20%;
  right: 15%;
}

.squiggle {
  bottom: 25%;
  left: 10%;
}

@keyframes morph {
  0% {
    border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  }
  50% {
    border-radius: 60% 40% 30% 70% / 60% 70% 30% 40%;
  }
  100% {
    border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%;
  }
}`;

const VITE_INDEX_CSS = `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;

  color-scheme: light dark;
  color: rgba(255, 255, 255, 0.87);
  background-color: #242424;

  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}
`;


export const INITIAL_PROJECT_STRUCTURE: FileNode[] = [
    { name: 'index.html', type: 'file', path: '/index.html', content: VITE_INDEX_HTML },
    { name: 'package.json', type: 'file', path: '/package.json', content: JSON.stringify({
        "name": "vite-react-typescript-starter",
        "private": true,
        "version": "0.0.0",
        "type": "module",
        "scripts": {
            "dev": "vite",
            "build": "tsc && vite build",
            "preview": "vite preview"
        },
        "dependencies": {
            "react": "^18.3.1",
            "react-dom": "^18.3.1"
        },
        "devDependencies": {
            "@types/react": "^18.3.3",
            "@types/react-dom": "^18.3.0",
            "@vitejs/plugin-react": "^4.3.1",
            "typescript": "^5.4.5",
            "vite": "^5.2.0"
        }
    }, null, 2)},
    { name: 'vite.config.ts', type: 'file', path: '/vite.config.ts', content: VITE_CONFIG_TS },
    { name: 'tsconfig.json', type: 'file', path: '/tsconfig.json', content: VITE_TSCONFIG_JSON },
    { name: 'tsconfig.node.json', type: 'file', path: '/tsconfig.node.json', content: VITE_TSCONFIG_NODE_JSON },
    { name: 'src', type: 'folder', path: '/src', children: [
        { name: 'App.css', type: 'file', path: '/src/App.css', content: VITE_APP_CSS },
        { name: 'App.tsx', type: 'file', path: '/src/App.tsx', content: VITE_APP_TSX },
        { name: 'index.css', type: 'file', path: '/src/index.css', content: VITE_INDEX_CSS },
        { name: 'main.tsx', type: 'file', path: '/src/main.tsx', content: VITE_MAIN_TSX },
        { name: 'vite-env.d.ts', type: 'file', path: '/src/vite-env.d.ts', content: VITE_ENV_D_TS },
    ]},
];

export const findFileByPath = (nodes: FileNode[], path: string): FileNode | null => {
    for (const node of nodes) {
        if (node.path === path) {
            return node;
        }
        if (node.type === 'folder' && node.children && path.startsWith(node.path + '/')) {
            const found = findFileByPath(node.children, path);
            if (found) {
                return found;
            }
        }
    }
    return null;
};

export const addOrUpdateFileByPath = (nodes: FileNode[], path: string, newContent: string): FileNode[] => {
    const newStructure = JSON.parse(JSON.stringify(nodes)) as FileNode[];
    const pathParts = path.split('/').filter(p => p);
    const fileName = pathParts.pop();

    if (!fileName) {
        return newStructure;
    }

    let currentChildren = newStructure;
    let currentPath = '';

    for (const part of pathParts) {
        currentPath += `/${part}`;
        let folder = currentChildren.find(node => node.name === part && node.type === 'folder');
        if (!folder) {
            folder = { name: part, type: 'folder', path: currentPath, children: [] };
            currentChildren.push(folder);
        }
        
        if (!folder.children) {
            folder.children = [];
        }
        
        currentChildren = folder.children;
    }

    const fileIndex = currentChildren.findIndex(node => node.name === fileName);
    const fullPath = (currentPath ? currentPath : '') + `/${fileName}`;
    if (fileIndex > -1) {
        currentChildren[fileIndex].content = newContent;
    } else {
        currentChildren.push({ name: fileName, type: 'file', path: fullPath, content: newContent });
    }

    return newStructure;
};

export const deleteNodeByPath = (nodes: FileNode[], path: string): FileNode[] => {
    const newNodes = nodes.filter(node => node.path !== path);

    return newNodes.map(node => {
        if (node.type === 'folder' && node.children && path.startsWith(node.path + '/')) {
            return {
                ...node,
                children: deleteNodeByPath(node.children, path),
            };
        }
        return node;
    });
};

export const zipProject = async (nodes: FileNode[], projectName: string): Promise<void> => {
    const zip = new JSZip();

    const addFilesToZip = (folder: JSZip, files: FileNode[]) => {
        files.forEach(file => {
            if (file.type === 'file') {
                folder.file(file.name, file.content || '');
            } else if (file.type === 'folder' && file.children) {
                const subFolder = folder.folder(file.name);
                if (subFolder) {
                    addFilesToZip(subFolder, file.children);
                }
            }
        });
    };

    addFilesToZip(zip, nodes);

    const blob = await zip.generateAsync({ type: 'blob' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${projectName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
};

export const findMentionedFiles = (prompt: string, projectFiles: FileNode[]): FileNode[] => {
    const mentioned = new Set<FileNode>();
    const allFilePaths: { path: string, node: FileNode }[] = [];
    
    function collectPaths(nodes: FileNode[]) {
        for (const node of nodes) {
            if (node.type === 'file') {
                allFilePaths.push({ path: node.path, node });
            }
            if (node.children) {
                collectPaths(node.children);
            }
        }
    }
    collectPaths(projectFiles);

    allFilePaths.forEach(({ path, node }) => {
        if (prompt.includes(path) || prompt.includes(node.name)) {
            mentioned.add(node);
        }
    });

    return Array.from(mentioned);
};

export const addNodeToTree = (nodes: FileNode[], parentPath: string, nodeName: string, type: 'file' | 'folder'): FileNode[] => {
    const newStructure = JSON.parse(JSON.stringify(nodes));
    const newNodePath = parentPath === '/' ? `/${nodeName}` : `${parentPath}/${nodeName}`;

    if (findFileByPath(newStructure, newNodePath)) {
        throw new Error(`${type === 'file' ? 'File' : 'Folder'} with name "${nodeName}" already exists.`);
    }

    if (parentPath === '/') {
        newStructure.push({ name: nodeName, type, path: newNodePath, ...(type === 'folder' && { children: [] }), ...(type === 'file' && { content: '' }) });
        return newStructure;
    }

    const parentNode = findFileByPath(newStructure, parentPath) as FileNode | null;
    if (parentNode && parentNode.type === 'folder') {
        if (!parentNode.children) {
            parentNode.children = [];
        }
        parentNode.children.push({ name: nodeName, type, path: newNodePath, ...(type === 'folder' && { children: [] }), ...(type === 'file' && { content: '' }) });
    } else {
         throw new Error(`Parent directory "${parentPath}" not found.`);
    }

    return newStructure;
};

export const addFileToTree = (nodes: FileNode[], parentPath: string, file: { name: string; content: string }): FileNode[] => {
    const filePath = parentPath === '/' ? `/${file.name}` : `${parentPath}/${file.name}`;
    return addOrUpdateFileByPath(nodes, filePath, file.content);
};

export const searchInProject = (nodes: FileNode[], query: string, options: { isCaseSensitive: boolean, isRegex: boolean, isWholeWord: boolean }): SearchResult[] => {
    if (!query) return [];

    const results: SearchResult[] = [];
    let regex: RegExp;
    try {
        let pattern = options.isRegex ? query : query.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        if (!options.isRegex && options.isWholeWord) {
            pattern = `\\b${pattern}\\b`;
        }
        regex = new RegExp(pattern, options.isCaseSensitive ? 'g' : 'gi');
    } catch (e) {
        return [];
    }
    
    const searchInNode = (node: FileNode) => {
        if (node.type === 'file' && typeof node.content === 'string') {
            const matches: SearchMatch[] = [];
            const lines = node.content.split('\n');
            lines.forEach((line, index) => {
                const lineMatches: { start: number, length: number }[] = [];
                let match;
                const lineRegex = new RegExp(regex); // Reset regex for each line to avoid state issues with 'g' flag
                
                while ((match = lineRegex.exec(line)) !== null) {
                    lineMatches.push({ start: match.index, length: match[0].length });
                     if (!lineRegex.global) { // Prevent infinite loop for non-global regex
                        break;
                     }
                }

                if (lineMatches.length > 0) {
                    matches.push({
                        lineNumber: index + 1,
                        content: line,
                        matchRanges: lineMatches,
                    });
                }
            });

            if (matches.length > 0) {
                results.push({ path: node.path, matches });
            }
        } else if (node.type === 'folder' && node.children) {
            node.children.forEach(searchInNode);
        }
    };
    
    nodes.forEach(searchInNode);
    return results;
};

export const getLanguageForFile = (fileName: string): string => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
        case 'js':
        case 'jsx':
            return 'javascript';
        case 'ts':
        case 'tsx':
            return 'typescript';
        case 'css':
            return 'css';
        case 'json':
            return 'json';
        case 'html':
            return 'html';
        case 'md':
            return 'markdown';
        default:
            return 'plaintext';
    }
};

export const projectStructureToWebContainerFiles = (nodes: FileNode[]): any => {
    const root: any = {};
    const buildTree = (currentNodes: FileNode[], parentDir: any) => {
        for (const node of currentNodes) {
            const nodeName = node.name;
            if (node.type === 'file') {
                parentDir[nodeName] = {
                    file: {
                        contents: node.content || ''
                    }
                };
            } else if (node.type === 'folder') {
                parentDir[nodeName] = {
                    directory: {}
                };
                if (node.children) {
                    buildTree(node.children, parentDir[nodeName].directory);
                }
            }
        }
    };
    buildTree(nodes, root);
    return root;
};

export const formatProjectStructureForAI = (nodes: FileNode[]): string => {
    let structureString = 'This is the current project structure and content:\n\n';

    const buildString = (fileNodes: FileNode[], indent: string) => {
        fileNodes.sort((a, b) => {
            if (a.type === b.type) return a.name.localeCompare(b.name);
            return a.type === 'folder' ? -1 : 1;
        }).forEach(node => {
            if (node.type === 'folder') {
                structureString += `${indent}📁 ${node.name}/\n`;
                if (node.children) {
                    buildString(node.children, indent + '  ');
                }
            } else {
                 structureString += `${indent}📄 ${node.name}\n`;
            }
        });
    };
    
    const addFileContents = (fileNodes: FileNode[]) => {
      fileNodes.forEach(node => {
          if (node.type === 'file') {
              structureString += `\n--- START OF FILE: ${node.path} ---\n`;
              structureString += `${node.content || ''}\n`;
              structureString += `--- END OF FILE: ${node.path} ---\n`;
          } else if (node.type === 'folder' && node.children) {
              addFileContents(node.children);
          }
      });
    };

    buildString(nodes, '');
    structureString += '\n--- FILE CONTENTS ---\n';
    addFileContents(nodes);

    return structureString;
};

export const getAllPaths = (nodes: FileNode[]): string[] => {
    const paths: string[] = [];
    const walk = (items: FileNode[]) => {
        for (const item of items) {
            paths.push(item.path);
            if (item.type === 'folder' && item.children) {
                walk(item.children);
            }
        }
    };
    walk(nodes);
    return paths;
};


export const unzipAndParse = async (zipFile: File): Promise<FileNode[]> => {
    const zip = await JSZip.loadAsync(zipFile);
    const root: FileNode[] = [];
    const folders = new Map<string, FileNode>();

    const filePaths = Object.keys(zip.files).sort();

    for (const relativePath of filePaths) {
        const zipEntry = zip.files[relativePath];
        if (zipEntry.dir) continue; 
        if (relativePath.startsWith('__MACOSX') || relativePath.endsWith('.DS_Store')) continue;

        const pathParts = relativePath.split('/').filter(p => p);
        if (pathParts.length === 0) continue;

        let parentCollection = root;
        let currentPathPrefix = '';

        for (let i = 0; i < pathParts.length - 1; i++) {
            const part = pathParts[i];
            const currentPath = currentPathPrefix ? `${currentPathPrefix}/${part}` : `/${part}`;

            let folderNode = folders.get(currentPath);
            if (!folderNode) {
                folderNode = {
                    name: part,
                    type: 'folder',
                    path: currentPath,
                    children: []
                };
                parentCollection.push(folderNode);
                folders.set(currentPath, folderNode);
            }
            parentCollection = folderNode.children!;
            currentPathPrefix = currentPath;
        }

        const fileName = pathParts[pathParts.length - 1];
        const fileContent = await zipEntry.async('string');
        const filePath = `/${relativePath}`;
        
        parentCollection.push({
            name: fileName,
            type: 'file',
            path: filePath,
            content: fileContent,
        });
    }

    return root;
};


export const buildStructureFromAiFiles = (files: AiFile[]): FileNode[] => {
    const root: FileNode[] = [];
    const nodeMap = new Map<string, FileNode>();

    files.sort((a, b) => a.path.split('/').length - b.path.split('/').length);

    for (const file of files) {
        const pathParts = file.path.split('/').filter(p => p);
        let currentPath = '';
        let parentCollection = root;

        for (let i = 0; i < pathParts.length; i++) {
            const part = pathParts[i];
            currentPath += '/' + part;
            
            const isLastPart = i === pathParts.length - 1;

            if (isLastPart) {
                const fileNode: FileNode = {
                    name: part,
                    type: 'file',
                    path: file.path,
                    content: file.content
                };
                parentCollection.push(fileNode);
            } else {
                let dirNode = nodeMap.get(currentPath);
                if (!dirNode) {
                    dirNode = {
                        name: part,
                        type: 'folder',
                        path: currentPath,
                        children: []
                    };
                    parentCollection.push(dirNode);
                    nodeMap.set(currentPath, dirNode);
                }
                parentCollection = dirNode.children!;
            }
        }
    }
    return root;
};
