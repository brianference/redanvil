import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ScrollToTop } from './components/ScrollToTop';
import { applyThemeMode, readThemeMode } from './theme';
import './theme.css';

// Initial apply must NOT persist: writing here records a choice the visitor
// never made and pins the theme, making the OS preference unreachable.
applyThemeMode(readThemeMode(), false);

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Root element #root not found');
}

createRoot(rootEl).render(
  <StrictMode>
    <BrowserRouter>
      <ScrollToTop />
      <App />
    </BrowserRouter>
  </StrictMode>
);
