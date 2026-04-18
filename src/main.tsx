import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ErrorBoundary } from './components/ErrorBoundary';
import { FirebaseProvider } from './components/FirebaseProvider';

// Monkey-patch ResizeObserver to prevent "ResizeObserver loop completed with undelivered notifications"
// This error is benign but triggers development overlays. Wrapping the callback in requestAnimationFrame
// ensures that the resize logic happens in the next frame, avoiding the loop detection.
const OriginalResizeObserver = window.ResizeObserver;
window.ResizeObserver = class ResizeObserver extends OriginalResizeObserver {
  constructor(callback: ResizeObserverCallback) {
    super((entries, observer) => {
      window.requestAnimationFrame(() => {
        if (Array.isArray(entries) && entries.length > 0) {
          callback(entries, observer);
        }
      });
    });
  }
};

// Suppress ResizeObserver loop errors which are benign but trigger dev overlays
const isResizeObserverError = (message: string) => {
  return message.includes('ResizeObserver loop') || 
         message.includes('ResizeObserver loop limit exceeded') ||
         message === 'Script error.';
};

window.addEventListener('error', (e) => {
  if (isResizeObserverError(e.message)) {
    // Hide the webpack dev server overlay if it exists
    const overlay = document.getElementById('webpack-dev-server-client-overlay-div');
    if (overlay) overlay.style.display = 'none';
    
    // Stop propagation and prevent default browser behavior
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

window.addEventListener('unhandledrejection', (e) => {
  const message = e.reason?.message || e.reason || '';
  if (typeof message === 'string' && isResizeObserverError(message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});

// Silence console logs in production for security and cleanliness
if (import.meta.env.PROD) {
  console.log = () => {};
  console.debug = () => {};
  console.info = () => {};
  // We keep console.warn and console.error slightly more visible or completely silent?
  // User said "no error or api or anything is seen in console logs" so we silence all.
  console.warn = () => {};
  console.error = () => {};
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <FirebaseProvider>
        <App />
      </FirebaseProvider>
    </ErrorBoundary>
  </StrictMode>,
);
