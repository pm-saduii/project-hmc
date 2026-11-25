import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App';
import './index.css';

// Pages load in separate files. After a new deploy, a tab opened earlier asks for files
// that no longer exist; reload once to pick up the new build instead of showing a blank page.
window.addEventListener('vite:preloadError', (event) => {
  const key = 'hmc-chunk-reload-at';
  let last = 0;
  try { last = Number(window.sessionStorage.getItem(key) || 0); } catch { /* storage unavailable */ }
  if (Date.now() - last < 10_000) return; // already retried just now; let the error surface
  try { window.sessionStorage.setItem(key, String(Date.now())); } catch { /* storage unavailable */ }
  event.preventDefault();
  window.location.reload();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
