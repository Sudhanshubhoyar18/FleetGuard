import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.js';
import { ThemeProvider } from './contexts/ThemeContext.js';
import { AuthProvider } from './contexts/AuthContext.js';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
