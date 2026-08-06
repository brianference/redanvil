import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { pathForPage } from './lib/routes';
import { ScrollToTop } from './components/ScrollToTop';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Contact } from './pages/Contact';

/** App router: composes the required pages from the shared route table. */
export function App(): JSX.Element {
  return (
    <BrowserRouter>
      {/* Inside the router: it reads the current location (R34). */}
      <ScrollToTop />
      <Routes>
        <Route path={pathForPage('Home') ?? '/'} element={<Home />} />
        <Route path={pathForPage('About') ?? '/about'} element={<About />} />
        <Route path={pathForPage('Terms') ?? '/terms'} element={<Terms />} />
        <Route path={pathForPage('Privacy') ?? '/privacy'} element={<Privacy />} />
        <Route path={pathForPage('Contact') ?? '/contact'} element={<Contact />} />
      </Routes>
    </BrowserRouter>
  );
}
