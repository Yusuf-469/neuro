import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';

// Initialize FFT Worker
const fftWorker = new Worker(
  new URL('./workers/fft.worker.ts', import.meta.url),
  { type: 'module' }
);

// Store worker reference globally
(window as any).fftWorker = fftWorker;

// Handle worker messages
fftWorker.onmessage = (event) => {
  const { type, data } = event.data;
  
  if (type === 'processed') {
    // Import store dynamically to avoid circular dependency
    import('./stores').then(({ useEEGStore }) => {
      useEEGStore.getState().addEEGData(data);
    });
  }
};

fftWorker.onerror = (error) => {
  console.error('FFT Worker error:', error);
};

// Render app
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
