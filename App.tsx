

import React, { useState, useEffect, useCallback } from 'react';
import IDEView from './components/IDEView';
import ProjectDashboard from './components/ProjectDashboard';
import { FileNode } from './types';
import { INITIAL_PROJECT_STRUCTURE, unzipAndParse, buildStructureFromAiFiles, zipProject } from './lib/project-utils';
import { generateProjectFromIdea } from './lib/ai';
import { AiFile } from './lib/ai';
import { useToast } from './contexts/ToastContext';
import Icon from './components/Icon';

export interface Project {
  id: string;
  name: string;
  description: string;
  structure: FileNode[];
  lastModified: number;
}

export interface CreateProjectOptions {
  name: string;
  type: 'template' | 'idea' | 'upload' | 'repo';
  prompt?: string;
  file?: File;
  url?: string;
}

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const { addToast } = useToast();

  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem('codematic_projects');
      if (savedProjects) {
        const parsedProjects: Project[] = JSON.parse(savedProjects).map((p: any) => ({
          ...p,
          description: p.description || 'Contoh interaktif yang menunjukkan bagaimana file HTML, CSS, dan JavaScript bekerja sama',
        }));
        setProjects(parsedProjects);
      } else {
        const defaultProject: Project = {
          id: `proj_${Date.now()}`,
          name: 'Multi-File Demo',
          description: 'Contoh interaktif yang menunjukkan bagaimana file HTML, CSS, dan JavaScript bekerja sama',
          structure: JSON.parse(JSON.stringify(INITIAL_PROJECT_STRUCTURE)),
          lastModified: Date.now(),
        };
        setProjects([defaultProject]);
      }
      const savedActiveId = localStorage.getItem('codematic_active_project_id');
      setActiveProjectId(savedActiveId);
    } catch (error) {
      console.error("Failed to load projects from localStorage", error);
      localStorage.removeItem('codematic_projects');
      localStorage.removeItem('codematic_active_project_id');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isLoading) return;
    try {
      localStorage.setItem('codematic_projects', JSON.stringify(projects));
    } catch (error) {
      console.error("Failed to save projects to localStorage", error);
    }
  }, [projects, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    if (activeProjectId) {
      localStorage.setItem('codematic_active_project_id', activeProjectId);
    } else {
      localStorage.removeItem('codematic_active_project_id');
    }
  }, [activeProjectId, isLoading]);

  const handleUpdateProject = useCallback((id: string, updates: Partial<Project>) => {
    setProjects(prev =>
      prev.map(p => (p.id === id ? { ...p, ...updates, lastModified: Date.now() } : p))
    );
  }, []);

  const handleCreateProject = useCallback(async (options: CreateProjectOptions) => {
    setIsCreatingProject(true);
    try {
        let newProjectStructure: FileNode[] | null = null;
        
        switch (options.type) {
            case 'template':
                newProjectStructure = JSON.parse(JSON.stringify(INITIAL_PROJECT_STRUCTURE));
                break;
            
            case 'upload':
                if (!options.file) throw new Error("No file provided for upload.");
                addToast("Unzipping project...", "info");
                newProjectStructure = await unzipAndParse(options.file);
                break;
                
            case 'idea':
                if (!options.prompt) throw new Error("No prompt provided for AI creation.");
                addToast("AI is building your project... this may take a minute.", "info");
                const aiFiles: AiFile[] | null = await generateProjectFromIdea(options.prompt);
                if (!aiFiles || aiFiles.length === 0) throw new Error("AI failed to generate project files.");
                newProjectStructure = buildStructureFromAiFiles(aiFiles);
                break;
                
            case 'repo':
                addToast("Importing from Git repositories is coming soon!", "info");
                setIsCreatingProject(false);
                return;
        }

        if (newProjectStructure) {
            const newProject: Project = {
                id: `proj_${Date.now()}`,
                name: options.name,
                description: options.type === 'idea' 
                    ? `AI-generated project based on the prompt: "${options.prompt}"`
                    : 'A newly created project.',
                structure: newProjectStructure,
                lastModified: Date.now(),
            };
            setProjects(prev => [...prev, newProject]);
            setActiveProjectId(newProject.id);
            addToast(`Project "${options.name}" created successfully!`, 'success');
        }

    } catch (error) {
        console.error("Failed to create project:", error);
        addToast(error instanceof Error ? error.message : "An unknown error occurred.", 'error');
    } finally {
        setIsCreatingProject(false);
    }
  }, [addToast]);

  const handleDeleteProject = useCallback((id: string) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      setActiveProjectId(null);
    }
  }, [activeProjectId]);

  const handleDuplicateProject = useCallback((id: string) => {
    const projectToDuplicate = projects.find(p => p.id === id);
    if (!projectToDuplicate) return;

    const newProject: Project = {
        ...JSON.parse(JSON.stringify(projectToDuplicate)),
        id: `proj_${Date.now()}`,
        name: `${projectToDuplicate.name} (Copy)`,
        lastModified: Date.now(),
    };

    setProjects(prev => [...prev, newProject]);
    addToast(`Project "${projectToDuplicate.name}" duplicated.`, 'success');
  }, [projects, addToast]);

  const handleExportProjectAsZip = useCallback(async (project: Project) => {
      addToast("Zipping your project...", "info");
      try {
        await zipProject(project.structure, project.name);
      } catch (error) {
          console.error("Failed to export project as ZIP", error);
          addToast("Failed to create ZIP file.", "error");
      }
  }, [addToast]);
  
  const handleExportProjectAsJson = useCallback((project: Project) => {
    try {
      const jsonString = JSON.stringify(project, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${project.name}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch(error) {
       console.error("Failed to export project as JSON", error);
       addToast("Failed to create JSON file.", "error");
    }
  }, [addToast]);

  const handleSelectProject = (id: string) => {
    setActiveProjectId(id);
  };

  const handleExitIDE = () => {
    setActiveProjectId(null);
  };
  
  if (isLoading) {
    return (
      <div className="bg-slate-100 dark:bg-slate-900 min-h-screen flex items-center justify-center text-slate-800 dark:text-slate-200">
        <div className="text-center">
          <Icon name="draw" className="text-8xl text-blue-500 animate-pulse" />
          <h1 className="text-4xl font-bold mt-4">Codematic</h1>
          <p className="text-lg text-slate-600 dark:text-slate-400 mt-2">Loading projects...</p>
        </div>
      </div>
    );
  }
  
  const activeProject = projects.find(p => p.id === activeProjectId);

  if (activeProject) {
    return (
      <IDEView 
        key={activeProject.id}
        project={activeProject} 
        onExit={handleExitIDE}
        onUpdate={handleUpdateProject}
      />
    );
  }

  return (
    <div className="relative">
        {isCreatingProject && (
             <div className="absolute inset-0 bg-slate-800/80 flex items-center justify-center z-[10000] text-white flex-col gap-4 backdrop-blur-sm">
                <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                <div className="text-center">
                    <p className="text-lg font-semibold">Creating Your Project</p>
                    <p className="text-sm opacity-70">Please wait a moment...</p>
                </div>
            </div>
        )}
        <ProjectDashboard
          projects={projects}
          onCreateProject={handleCreateProject}
          onDeleteProject={handleDeleteProject}
          onSelectProject={handleSelectProject}
          onUpdateProject={handleUpdateProject}
          onDuplicateProject={handleDuplicateProject}
          onExportProjectAsZip={handleExportProjectAsZip}
          onExportProjectAsJson={handleExportProjectAsJson}
        />
    </div>
  );
};

export default App;