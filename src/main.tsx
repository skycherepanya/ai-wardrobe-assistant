import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { requestPersistentStorage } from './db/db';

// Request persistent storage on launch to protect IndexedDB on WebKit / iOS PWA
requestPersistentStorage()
  .then((persisted) => {
    if (persisted) {
      console.log('[Storage] Persistent storage granted');
    } else {
      console.log('[Storage] Persistent storage not granted or not supported');
    }
  })
  .catch((err) => {
    console.warn('[Storage] Error requesting persistent storage:', err);
  });

// Register Service Worker for offline PWA caching on iOS standalone mode
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  const registerServiceWorker = () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((registration) => {
        console.log('[SW] Service worker registered successfully with scope:', registration.scope);
      })
      .catch((error) => {
        console.warn('[SW] Service worker registration failed:', error);
      });
  };

  if (document.readyState === 'complete') {
    registerServiceWorker();
  } else {
    window.addEventListener('load', registerServiceWorker);
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
