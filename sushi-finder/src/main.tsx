import { App } from './App';
import { ScrollToTop } from './components/ScrollToTop';
import { mountApp } from '../../design-system/mountApp';
import './theme.css';

// Initial apply must NOT persist: writing here records a choice the visitor
// never made and pins the theme, making the OS preference unreachable.
mountApp(
  <>
    <ScrollToTop />
    <App />
  </>,
  { persistInitialTheme: false }
);
