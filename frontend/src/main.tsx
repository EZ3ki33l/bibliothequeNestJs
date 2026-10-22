import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { BrowserRouter } from 'react-router';
import { AppErrorBoundary } from './components/layout/AppErrorBoundary';
import { ConfirmProvider } from './components/ui/ConfirmProvider';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AppErrorBoundary>
        <ConfirmProvider>
          <App />
        </ConfirmProvider>
      </AppErrorBoundary>
    </BrowserRouter>
  </StrictMode>,
);
