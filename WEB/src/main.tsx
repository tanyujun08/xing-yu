import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import 'tdesign-react/es/_util/react-19-adapter';
import 'tdesign-react/es/style/index.css';
import './styles/global.css';
import { App } from './app/App';
import { AppErrorBoundary } from './app/error-boundary/AppErrorBoundary';
import { AppProviders } from './app/providers/AppProviders';
import { bootstrapPreview } from './preview/engine';
import './preview/preview.css';

bootstrapPreview();

const root = document.getElementById('root');
if (root === null) {
  throw new Error('missing #root mount point');
}

createRoot(root).render(
  <StrictMode>
    <AppErrorBoundary>
      <AppProviders>
        <App />
      </AppProviders>
    </AppErrorBoundary>
  </StrictMode>,
);
