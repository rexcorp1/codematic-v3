

export interface FileNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  children?: FileNode[];
  content?: string;
}

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastMessage {
  id: number;
  text: string;
  type: ToastType;
}

export interface Attachment {
  name: string;
  mimeType: string;
  content: string; // For text, raw content. For images, base64 data URL.
}

export interface SearchMatch {
  lineNumber: number;
  content: string;
  matchRanges: { start: number; length: number }[];
}

export interface SearchResult {
  path: string;
  matches: SearchMatch[];
}

export interface ProjectError {
  message: string;
  stack?: string;
}
