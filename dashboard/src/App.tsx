import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Contact } from './pages/Contact';
import { RunDetail } from './pages/RunDetail';
import { NotFound } from './pages/NotFound';

/**
 * App router: composes the required pages plus run detail. Scroll reset on
 * navigation lives in the shared Page every route renders through.
 */
export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/run/:slug" element={<RunDetail />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/contact" element={<Contact />} />
        {/* Catch-all: an unmatched route gets a real 404 page, not an empty document. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
