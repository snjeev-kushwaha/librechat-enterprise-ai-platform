import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';

// Global reset
const style = document.createElement('style');
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f1a; color: #e5e7eb; }
  ::-webkit-scrollbar { width: 5px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: #2d2d3f; border-radius: 3px; }
  select option { background: #1e1e2e; color: #e5e7eb; }
`;
document.head.appendChild(style);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
