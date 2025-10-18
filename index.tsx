import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { loader } from '@monaco-editor/react';
import { ThemeProvider } from './contexts/ThemeContext';
import { ToastProvider } from './contexts/ToastContext';
import 'react-markdown'; // Ensure this is available for components

// Register service worker to enable cross-origin isolation for WebContainer
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
      // If the controller is not available, it means this is the first time the SW is being registered.
      // A reload is needed for the SW to take control of the page and apply the required headers.
      if (!navigator.serviceWorker.controller) {
        console.log("Service worker not in control, reloading to apply headers.");
        window.location.reload();
      }
    }).catch(error => {
      console.error('ServiceWorker registration failed: ', error);
    });
  });
}

// Configure Monaco Editor to load its assets from a CDN
loader.config({ paths: { vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.41.0/min/vs' } });

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ThemeProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>
);
