

import React, { useState, useCallback, useRef } from 'react';
import Icon from './Icon';
import { CreateProjectOptions } from '../App';

interface NewProjectModalProps {
  onClose: () => void;
  onCreate: (options: CreateProjectOptions) => void;
}

type CreationType = 'template' | 'idea' | 'upload' | 'repo';

const NewProjectModal: React.FC<NewProjectModalProps> = ({ onClose, onCreate }) => {
  const [creationType, setCreationType] = useState<CreationType>('template');
  const [projectName, setProjectName] = useState('My-Vite-App');
  const [prompt, setPrompt] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [repoUrl, setRepoUrl] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    onCreate({
      name: projectName.trim(),
      type: creationType,
      prompt: creationType === 'idea' ? prompt : undefined,
      file: creationType === 'upload' ? (file || undefined) : undefined,
      url: creationType === 'repo' ? repoUrl : undefined,
    });
    onClose();
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files && files.length > 0) {
      const selectedFile = files[0];
      if (selectedFile.type === 'application/zip' || selectedFile.name.endsWith('.zip')) {
        setFile(selectedFile);
        if (!projectName || projectName === 'My-Vite-App') {
            setProjectName(selectedFile.name.replace('.zip', ''));
        }
      } else {
        // You might want to show a toast message here
        alert('Please upload a .zip file.');
      }
    }
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  }, [projectName]);

  const options: { id: CreationType, icon: string, title: string, description: string }[] = [
    { id: 'template', icon: 'auto_awesome_motion', title: 'Start from template', description: 'Create a standard Vite + React project.' },
    { id: 'idea', icon: 'tips_and_updates', title: 'Create from an idea', description: 'Describe your app and let AI build it.' },
    { id: 'upload', icon: 'upload_file', title: 'Upload project', description: 'Upload a .zip file to start.' },
    { id: 'repo', icon: 'hub', title: 'Import repository', description: 'Import from a public Git repository.' },
  ];

  const renderContent = () => {
    switch(creationType) {
        case 'idea':
            return (
                <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">Describe the application you want to build. Be as specific as possible for the best results.</p>
                    <textarea
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                        placeholder="e.g., A simple to-do list app with a clean interface, or a weather dashboard that shows the 5-day forecast..."
                        className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200 resize-none"
                        rows={6}
                    />
                </div>
            );
        case 'upload':
            return (
                <div>
                    <input type="file" accept=".zip" ref={fileInputRef} className="hidden" onChange={(e) => handleFileSelect(e.target.files)} />
                    <div 
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${isDragging ? 'border-blue-500 bg-blue-500/10' : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500'}`}
                    >
                        {file ? (
                            <div className="text-slate-700 dark:text-slate-300">
                                <Icon name="check_circle" className="text-4xl text-green-500 mb-2" />
                                <p className="font-semibold">{file.name}</p>
                                <p className="text-xs">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                <button type="button" onClick={(e) => { e.stopPropagation(); setFile(null); }} className="mt-2 text-sm text-red-500 hover:underline">Remove</button>
                            </div>
                        ) : (
                             <div className="text-slate-500 dark:text-slate-400">
                                <Icon name="upload" className="text-4xl mb-2" />
                                <p className="font-semibold">Drag & drop a .zip file here</p>
                                <p className="text-sm">or click to browse</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        case 'repo':
            return (
                <div>
                     <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">Enter the URL of a public Git repository.</p>
                     <div className="relative">
                        <input
                            type="url"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            placeholder="https://github.com/username/repository.git"
                            className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                            disabled
                        />
                        <span className="absolute top-1/2 -translate-y-1/2 right-2 text-xs font-semibold bg-yellow-400/30 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-300 px-2 py-1 rounded-md">Coming Soon</span>
                     </div>
                </div>
            );
        case 'template':
        default:
            return <p className="text-sm text-slate-600 dark:text-slate-400">This will create a new project with a standard Vite + React + TypeScript setup, ready for you to start building.</p>;
    }
  }

  const isCreationDisabled = !projectName.trim() || 
    (creationType === 'idea' && !prompt.trim()) || 
    (creationType === 'upload' && !file) ||
    (creationType === 'repo' && !repoUrl.trim());

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl mx-4 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xl leading-6 font-bold text-slate-900 dark:text-white">Create New Project</h3>
            </div>
          
            <div className="flex flex-1 min-h-0">
                <div className="w-1/3 border-r border-slate-200 dark:border-slate-700 p-4 space-y-2 overflow-y-auto">
                    {options.map(opt => (
                        <button
                            key={opt.id}
                            type="button"
                            onClick={() => setCreationType(opt.id as CreationType)}
                            className={`w-full text-left p-3 rounded-lg transition-colors flex items-start gap-4 ${creationType === opt.id ? 'bg-blue-500/10 dark:bg-blue-500/20' : 'hover:bg-slate-100 dark:hover:bg-slate-700/50'}`}
                        >
                            <Icon name={opt.icon} className={`text-2xl mt-0.5 ${creationType === opt.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400'}`} />
                            <div>
                                <h4 className={`font-semibold ${creationType === opt.id ? 'text-slate-800 dark:text-slate-100' : 'text-slate-700 dark:text-slate-300'}`}>{opt.title}</h4>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{opt.description}</p>
                            </div>
                        </button>
                    ))}
                </div>
                <div className="w-2/3 p-6 overflow-y-auto">
                    <div className="mb-6">
                        <label htmlFor="project-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Project Name
                        </label>
                        <input
                        type="text"
                        id="project-name"
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        className="w-full bg-slate-100 dark:bg-slate-700/50 border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-800 dark:text-slate-200"
                        />
                    </div>
                    {renderContent()}
                </div>
            </div>

            <div className="p-6 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700">
                <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200"
                >
                Cancel
                </button>
                <button
                type="submit"
                disabled={isCreationDisabled}
                className="px-4 py-2 text-sm font-medium rounded-md border border-transparent bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400 dark:disabled:bg-slate-600 disabled:cursor-not-allowed flex items-center gap-2"
                >
                <Icon name="add" />
                Create Project
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default NewProjectModal;
