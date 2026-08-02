import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ScrollToTop } from './components/ScrollToTop';
import { StructuredData } from './components/StructuredData';
import { ZoneProvider } from './hooks/useZone';
import { applyThemeMode, readThemeMode } from './theme';
import './theme.css';

applyThemeMode(readThemeMode());

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <StructuredData />
      <ZoneProvider>
        <App />
      </ZoneProvider>
    </BrowserRouter>
  </StrictMode>
);
