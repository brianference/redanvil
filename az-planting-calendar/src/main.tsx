import { App } from './App';
import { ScrollToTop } from './components/ScrollToTop';
import { StructuredData } from './components/StructuredData';
import { ZoneProvider } from './hooks/useZone';
import { mountApp } from '../../design-system/mountApp';
import './theme.css';

mountApp(
  <>
    <ScrollToTop />
    <StructuredData />
    <ZoneProvider>
      <App />
    </ZoneProvider>
  </>
);
