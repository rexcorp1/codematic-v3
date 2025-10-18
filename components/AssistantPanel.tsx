import React, { useState, useRef } from 'react';
import Icon from './Icon';
import Markdown from 'react-markdown';
import { Attachment } from '../types';
import { useToast } from '../contexts/ToastContext';

interface AssistantPanelProps {
  isLoading: boolean;
  message: string;
  onSend: (prompt: string, attachments: Attachment[]) => void;
}

const MAX_FILE_SIZE_MB = 5;
const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

const AssistantPanel: React.FC<AssistantPanelProps> = ({ isLoading, message, onSend }) => {
  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addToast } = useToast();

  const handleSendClick = () => {
    if ((prompt.trim() || attachments.length > 0) && !isLoading) {
      onSend(prompt, attachments);
      setPrompt('');
      setAttachments([]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendClick();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    
    const files = Array.from(e.target.files);
    // FIX: Explicitly type `file` as `File` to help TypeScript's inference.
    files.forEach((file: File) => {
        if (file.size > MAX_FILE_SIZE_BYTES) {
            addToast(`File "${file.name}" is too large (max ${MAX_FILE_SIZE_MB}MB).`, 'error');
            return;
        }

        const reader = new FileReader();
        
        reader.onload = (loadEvent) => {
            const content = loadEvent.target?.result as string;
            if (content) {
                setAttachments(prev => [...prev, {
                    name: file.name,
                    mimeType: file.type,
                    content: content
                }]);
            }
        };

        reader.onerror = () => {
            addToast(`Error reading file "${file.name}".`, 'error');
        };
        
        if (file.type.startsWith('image/') || file.type === 'application/pdf') {
            reader.readAsDataURL(file);
        } else {
            reader.readAsText(file);
        }
    });
    
    if(e.target) e.target.value = '';
  };

  const removeAttachment = (indexToRemove: number) => {
    setAttachments(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  return (
    <div className="bg-white dark:bg-[#252526] h-full flex flex-col text-slate-700 dark:text-slate-300">
      <div className="bg-slate-100 dark:bg-[#252526] px-4 h-[37px] flex items-center border-b border-slate-300 dark:border-slate-700/50">
        <h3 className="font-medium text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wider">
          Code assistant
        </h3>
      </div>
      <div className="flex-1 p-4 overflow-y-auto text-sm">
        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3">
          <Markdown>{message}</Markdown>
        </div>
      </div>
      
      <div className="p-4">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Make changes, add new features, ask for anything..."
          className="w-full bg-transparent border border-slate-300 dark:border-slate-600 rounded-md py-2 px-3 text-sm placeholder-slate-500 dark:placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none text-slate-800 dark:text-slate-200 disabled:opacity-50"
          rows={4}
          disabled={isLoading}
        />
         {attachments.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {attachments.map((file, index) => (
              <div key={index} className="bg-slate-200 dark:bg-slate-700 rounded-md pl-1.5 pr-1 py-1 text-xs flex items-center gap-2 max-w-full">
                {file.mimeType.startsWith('image/') ? (
                    <img src={file.content} alt={file.name} className="w-6 h-6 object-cover rounded-sm flex-shrink-0" />
                ) : (
                    <Icon name={file.mimeType === 'application/pdf' ? 'picture_as_pdf' : 'article'} className="text-lg flex-shrink-0 ml-1 text-slate-600 dark:text-slate-300" />
                )}
                <span className="truncate" title={file.name}>{file.name}</span>
                <button 
                    onClick={() => removeAttachment(index)} 
                    className="flex-shrink-0 p-0.5 rounded-full hover:bg-slate-400/50"
                    aria-label={`Remove ${file.name}`}
                >
                  <Icon name="close" className="text-sm" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex justify-end items-center mt-2 gap-2">
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileChange}
            className="hidden" 
            multiple 
            accept="image/*,text/*,.js,.jsx,.ts,.tsx,.json,.md,.html,.css,application/pdf"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="w-8 h-8 flex items-center justify-center rounded-full text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-800 dark:hover:text-white disabled:opacity-50" 
            data-tooltip="Attach file"
            disabled={isLoading}
          >
            <Icon name="attach_file" className="text-xl" />
          </button>
          <button 
            onClick={handleSendClick}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white disabled:bg-slate-500" 
            data-tooltip="Send message"
            disabled={isLoading || (!prompt.trim() && attachments.length === 0)}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
            ) : (
              <Icon name="arrow_upward" className="text-xl" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssistantPanel;