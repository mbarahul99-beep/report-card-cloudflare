import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error interceptors to handle and silence common network cancellation and popup-closed exceptions
if (typeof window !== 'undefined') {
  // Utility to convert any error or object representation to a searchable string
  const getSearchableErrorString = (arg: any): string => {
    if (arg instanceof Error) {
      return String(arg.message || '') + ' ' + String(arg.stack || '');
    }
    if (arg && typeof arg === 'object') {
      const keys = ['message', 'code', 'reason', 'error', 'status', 'name'];
      let collected = '';
      for (const key of keys) {
        if (key in arg) {
          collected += ' ' + String(arg[key] || '');
        }
      }
      return collected || JSON.stringify(arg);
    }
    return String(arg || '');
  };

  // Monkeypatch console.error to safely catch and convert expected network/user aborts to console.warn warnings
  const originalConsoleError = console.error;
  console.error = (...args: any[]) => {
    const isAborted = args.some(arg => {
      const lower = getSearchableErrorString(arg).toLowerCase();
      return (
        lower.includes('abort') ||
        lower.includes('signal is') ||
        lower.includes('popup-closed') ||
        lower.includes('cancelled-popup') ||
        lower.includes('user-cancelled') ||
        lower.includes('closed-by-user') ||
        lower.includes('request-aborted')
      );
    });
    if (isAborted) {
      console.warn('Globally intercepted and gracefully silenced expected/aborted error:', ...args);
      return;
    }
    originalConsoleError(...args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const lower = getSearchableErrorString(reason).toLowerCase();
    if (
      lower.includes('abort') ||
      lower.includes('signal is') ||
      lower.includes('popup-closed') ||
      lower.includes('cancelled-popup') ||
      lower.includes('user-cancelled') ||
      lower.includes('closed-by-user') ||
      lower.includes('request-aborted')
    ) {
      console.warn('Globally intercepted and gracefully silenced expected/aborted request error:', reason);
      event.preventDefault(); // Prevent standard browser crash logging and uncaught exceptions
    }
  });

  window.addEventListener('error', (event) => {
    const error = event.error;
    const msg = event.message || '';
    const lowerMsg = msg.toLowerCase();
    const lowerError = getSearchableErrorString(error).toLowerCase();
    if (
      lowerMsg.includes('abort') ||
      lowerMsg.includes('signal is') ||
      lowerMsg.includes('user-cancelled') ||
      lowerMsg.includes('closed-by-user') ||
      lowerMsg.includes('request-aborted') ||
      lowerError.includes('abort') ||
      lowerError.includes('signal is') ||
      lowerError.includes('user-cancelled') ||
      lowerError.includes('closed-by-user') ||
      lowerError.includes('request-aborted')
    ) {
      console.warn('Globally intercepted and gracefully silenced expected/aborted error:', error || msg);
      event.preventDefault(); // Prevent standard browser crash logging and uncaught exceptions
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
