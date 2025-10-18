import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Project, CreateProjectOptions } from '../App';
import Icon from './Icon';
import NewProjectModal from './NewProjectModal';
import { FileNode } from '../types';

interface ProjectDashboardProps {
  projects: Project[];
  onCreateProject: (options: CreateProjectOptions) => void;
  onDeleteProject: (id: string) => void;
  onSelectProject: (id: string) => void;
  onUpdateProject: (id: string, updates: Partial<Project>) => void;
  onDuplicateProject: (id: string) => void;
  onExportProjectAsZip: (project: Project) => void;
  onExportProjectAsJson: (project: Project) => void;
}

// --- Helper Functions ---

const getProjectStats = (structure: FileNode[]) => {
  let fileCount = 0;
  let totalSize = 0;
  const fileTypes: Record<string, number> = {};

  const traverse = (nodes: FileNode[]) => {
    for (const node of nodes) {
      if (node.type === 'file') {
        fileCount++;
        totalSize += node.content?.length || 0;
        const extension = node.name.split('.').pop()?.toUpperCase() || 'unknown';
        
        const langMap: { [key: string]: string[] } = {
          'HTML': ['HTML'],
          'JS': ['JS', 'TSX', 'TS', 'JSX'],
          'CSS': ['CSS', 'SCSS', 'SASS'],
        };

        let mapped = false;
        for (const lang in langMap) {
          if (langMap[lang].includes(extension)) {
            fileTypes[lang] = (fileTypes[lang] || 0) + 1;
            mapped = true;
            break;
          }
        }
      } else if (node.children) {
        traverse(node.children);
      }
    }
  };

  traverse(structure);

  return { fileCount, totalSize, fileTypes };
};

const formatTimeAgo = (timestamp: number): string => {
  const now = Date.now();
  const seconds = Math.floor((now - timestamp) / 1000);

  if (seconds < 60) return `Updated just now`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Updated ${minutes} minute${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Updated about ${hours} hour${hours > 1 ? 's' : ''} ago`;
  
  const days = Math.floor(hours / 24);
  return `Updated ${days} day${days > 1 ? 's' : ''} ago`;
};

// --- Main Component ---

const ProjectDashboard: React.FC<ProjectDashboardProps> = (props) => {
  const { 
    projects, 
    onCreateProject, 
    onDeleteProject, 
    onSelectProject, 
    onUpdateProject,
    onDuplicateProject,
    onExportProjectAsZip,
    onExportProjectAsJson
  } = props;
  const [isNewProjectModalOpen, setNewProjectModalOpen] = useState(false);
  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingState, setEditingState] = useState<{ id: string; name: string; description: string; } | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const sortedProjects = useMemo(() => 
    [...projects].sort((a, b) => b.lastModified - a.lastModified),
    [projects]
  );

  const filteredProjects = useMemo(() =>
    sortedProjects.filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase())),
    [sortedProjects, searchQuery]
  );
  
  const handleMenuClick = (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    setOpenMenuId(prevId => (prevId === projectId ? null : projectId));
  };

  const handleDeleteClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setProjectToDelete(project);
    setOpenMenuId(null);
  };
  
  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
    setOpenMenuId(null);
  };

  const handleEditClick = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation();
    setEditingState({ id: project.id, name: project.name, description: project.description });
    setOpenMenuId(null);
  };

  const handleSaveEdit = () => {
    if (editingState) {
      const trimmedName = editingState.name.trim();
      if (!trimmedName) {
        setEditingState(null); // Or show an error toast
        return;
      }
      onUpdateProject(editingState.id, { name: trimmedName, description: editingState.description });
      setEditingState(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingState(null);
  };

  const confirmDelete = () => {
    if (projectToDelete) {
      onDeleteProject(projectToDelete.id);
      setProjectToDelete(null);
    }
  };
  
  const handleImportClick = () => {
    setNewProjectModalOpen(true);
  };

  const NAME_MAX_LENGTH = 50;
  const DESC_MAX_LENGTH = 200;

  return (
    <div className="bg-slate-50 dark:bg-[#202124] min-h-screen text-slate-800 dark:text-slate-200 font-sans">
      {isNewProjectModalOpen && (
        <NewProjectModal
          onClose={() => setNewProjectModalOpen(false)}
          onCreate={onCreateProject}
        />
      )}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl p-6 w-full max-w-md mx-4">
             <div className="sm:flex sm:items-start">
              <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100 dark:bg-red-900/30 sm:mx-0 sm:h-10 sm:w-10">
                <Icon name="warning" className="text-red-600 dark:text-red-400 text-2xl" />
              </div>
              <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left">
                <h3 className="text-lg leading-6 font-bold text-slate-900 dark:text-white">Delete Project</h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">
                    Are you sure you want to delete "{projectToDelete.name}"? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse gap-3">
              <button type="button" onClick={confirmDelete} className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 sm:w-auto sm:text-sm">
                Delete
              </button>
              <button type="button" onClick={() => setProjectToDelete(null)} className="mt-3 w-full inline-flex justify-center rounded-md border border-slate-300 dark:border-slate-600 shadow-sm px-4 py-2 bg-white dark:bg-slate-700 text-base font-medium sm:mt-0 sm:w-auto sm:text-sm">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <header className="bg-white dark:bg-[#202124] border-b border-slate-200 dark:border-slate-700/50">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-end items-center gap-4">
          <button
            onClick={() => setNewProjectModalOpen(true)}
            className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium py-2 px-4 rounded-md transition-colors text-sm"
          >
            <Icon name="add" className="text-lg" />
            New Project
          </button>
          <button onClick={handleImportClick} className="flex items-center gap-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-medium py-2 px-4 rounded-md transition-colors text-sm">
            <Icon name="upload" className="text-lg" />
            Import
          </button>
          <button className="p-2 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Icon name="settings" />
          </button>
        </div>
      </header>

      <main className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
        <div className="flex items-center gap-4 mb-6">
          <div className="relative flex-1">
            <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <input
              type="search"
              placeholder="Search projects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-md py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <div className="flex items-center gap-2 p-1 bg-slate-200 dark:bg-slate-800 rounded-md">
            <button className="flex items-center gap-2 text-sm px-3 py-1 rounded bg-white dark:bg-slate-700 shadow-sm">
              <Icon name="swap_vert" className="text-lg" />
              Last Updated
              <Icon name="expand_more" className="text-lg" />
            </button>
          </div>
          <div className="flex items-center p-1 bg-slate-200 dark:bg-slate-800 rounded-md text-slate-600 dark:text-slate-400">
            <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded ${viewMode === 'grid' ? 'bg-orange-500 text-white' : 'hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
              <Icon name="grid_view" />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-1.5 rounded ${viewMode === 'list' ? 'bg-orange-500 text-white' : 'hover:bg-slate-300 dark:hover:bg-slate-700'}`}>
              <Icon name="view_list" />
            </button>
          </div>
        </div>
        
        {filteredProjects.length > 0 ? (
          <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-1'}`}>
            {filteredProjects.map(project => {
              const { fileCount, totalSize, fileTypes } = getProjectStats(project.structure);
              const isEditing = editingState?.id === project.id;

              return (
                <div
                  key={project.id}
                  onClick={isEditing ? undefined : () => onSelectProject(project.id)}
                  className={`bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 transition-all duration-200 ${!isEditing && 'cursor-pointer group hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600'} ${isEditing ? 'ring-2 ring-orange-400' : ''}`}
                >
                  <div className="p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        {isEditing ? (
                            <div className='w-full'>
                                <div className="flex items-center gap-1.5 w-full">
                                    <input
                                        value={editingState.name}
                                        onChange={(e) => editingState && setEditingState({ ...editingState, name: e.target.value })}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') { e.preventDefault(); handleSaveEdit(); }
                                            if (e.key === 'Escape') handleCancelEdit();
                                        }}
                                        autoFocus
                                        maxLength={NAME_MAX_LENGTH}
                                        onClick={(e) => e.stopPropagation()}
                                        className="font-bold text-lg bg-transparent border-b-2 border-orange-400 rounded-none px-1 py-0.5 w-full -m-1 text-slate-900 dark:text-white focus:outline-none"
                                    />
                                    <button onClick={handleSaveEdit} className="p-1 rounded-full text-green-600 hover:bg-green-100 dark:hover:bg-green-900/50"><Icon name="check" /></button>
                                    <button onClick={handleCancelEdit} className="p-1 rounded-full text-red-600 hover:bg-red-100 dark:hover:bg-red-900/50"><Icon name="close" /></button>
                                </div>
                                <div className="text-xs text-right text-slate-500 dark:text-slate-400 mt-1">
                                    {editingState.name.length}/{NAME_MAX_LENGTH}
                                </div>
                            </div>
                        ) : (
                            <h3 className="font-bold text-lg text-slate-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">{project.name}</h3>
                        )}
                        {!isEditing && (
                             <div className="flex items-center text-slate-500 dark:text-slate-400 -mr-2">
                                <button onClick={(e) => handleEditClick(e, project)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity">
                                    <Icon name="edit" className="text-lg" />
                                </button>
                                <div className="relative" ref={openMenuId === project.id ? menuRef : null}>
                                <button onClick={(e) => handleMenuClick(e, project.id)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700">
                                    <Icon name="more_vert" />
                                </button>
                                {openMenuId === project.id && (
                                    <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg z-10 p-1">
                                        <button onClick={(e) => handleActionClick(e, () => onSelectProject(project.id))} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="visibility" className="text-lg" /> Preview</button>
                                        <button onClick={(e) => handleActionClick(e, () => onDuplicateProject(project.id))} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="file_copy" className="text-lg" /> Duplicate</button>
                                        <hr className="border-slate-200 dark:border-slate-700 my-1" />
                                        <button onClick={(e) => handleActionClick(e, () => onExportProjectAsZip(project))} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="archive" className="text-lg" /> Export as ZIP</button>
                                        <button onClick={(e) => handleActionClick(e, () => onExportProjectAsJson(project))} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"><Icon name="download" className="text-lg" /> Export as JSON</button>
                                        <hr className="border-slate-200 dark:border-slate-700 my-1" />
                                        <button onClick={(e) => handleDeleteClick(e, project)} className="w-full text-left px-3 py-1.5 text-sm flex items-center gap-3 text-red-600 dark:text-red-400 rounded-md hover:bg-red-50 dark:hover:bg-red-900/40"><Icon name="delete" className="text-lg" /> Delete</button>
                                    </div>
                                )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {isEditing ? (
                        <div className='w-full'>
                            <textarea
                                value={editingState.description}
                                onChange={(e) => editingState && setEditingState({ ...editingState, description: e.target.value })}
                                onKeyDown={(e) => { if (e.key === 'Escape') handleCancelEdit(); }}
                                onClick={(e) => e.stopPropagation()}
                                rows={3}
                                maxLength={DESC_MAX_LENGTH}
                                className="text-sm bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md px-2 py-1 w-full resize-none text-slate-600 dark:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
                            />
                             <div className="text-xs text-right text-slate-500 dark:text-slate-400 mt-1">
                                {editingState.description.length}/{DESC_MAX_LENGTH}
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 min-h-[2.5rem]">
                            {project.description}
                        </p>
                    )}

                    <hr className="border-slate-200 dark:border-slate-700" />
                    
                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400 items-center">
                        <span className="flex items-center gap-1.5"><Icon name="folder_open" className="text-lg" /> {fileCount} files</span>
                        <span className="flex items-center gap-1.5"><Icon name="storage" className="text-lg" /> {(totalSize / 1024).toFixed(1)} KB</span>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-500 dark:text-slate-400 items-center">
                      {Object.entries(fileTypes).map(([type, count]) => (
                        <span key={type} className="flex items-center gap-1.5">
                          <Icon name={type === 'HTML' ? 'html' : type === 'JS' ? 'javascript' : 'css'} className="text-lg" />
                          {type} ({count})
                        </span>
                      ))}
                    </div>
                    
                    <hr className="border-slate-200 dark:border-slate-700" />

                    <p className="text-xs text-slate-500 dark:text-slate-400">{formatTimeAgo(project.lastModified)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
            <Icon name="folder_off" className="text-6xl text-slate-400 dark:text-slate-500 mb-4" />
            <h3 className="text-xl font-semibold text-slate-700 dark:text-slate-300">No projects found</h3>
            <p className="text-slate-500 dark:text-slate-400 mt-2">
              {searchQuery ? 'Try adjusting your search.' : 'Click "New Project" to get started.'}
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProjectDashboard;