import React, { createContext, useState, useCallback, useContext, useEffect } from 'react';
import Icon from '../components/Icon';
import { ToastMessage, ToastType } from '../types';

interface ToastContextType {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

const Toast: React.FC<{ message: ToastMessage, onDismiss: (id: number) => void }> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(message.id);
    }, 5000); // Auto-dismiss after 5 seconds
    return () => clearTimeout(timer);
  }, [message.id, onDismiss]);

  const ICONS: Record<ToastType, string> = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning',
  };

  const BG_COLORS: Record<ToastType, string> = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
    warning: 'bg-yellow-500',
  };
  
  return (
    <div className={`flex items-center p-4 mb-4 text-white rounded-lg shadow-lg ${BG_COLORS[message.type]} animate-fade-in-right`}>
      <Icon name={ICONS[message.type]} className="text-xl mr-3" />
      <div className="flex-1 text-sm font-medium">{message.text}</div>
      <button onClick={() => onDismiss(message.id)} className="ml-4 -mr-2 p-1.5 rounded-md hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white">
        <Icon name="close" className="text-lg" />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = Date.now();
    setToasts(prevToasts => [...prevToasts, { id, text: message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="fixed top-5 right-5 z-[10000] w-full max-w-xs">
        {toasts.map(toast => (
          <Toast key={toast.id} message={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
