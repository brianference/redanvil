import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Home } from './pages/Home';
import { About } from './pages/About';
import { Examples } from './pages/Examples';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { Contact } from './pages/Contact';
import { Saved } from './pages/Saved';
import { SavedPrd } from './pages/SavedPrd';
import { NotFound } from './pages/NotFound';

/** App router: composes the required pages. */
export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/examples" element={<Examples />} />
        <Route path="/about" element={<About />} />
        <Route path="/terms" element={<Terms />} />
        <Route path="/privacy" element={<Privacy />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/saved" element={<Saved />} />
        <Route path="/prd/:id" element={<SavedPrd />} />
        {/* Catch-all: an unmatched route used to render an empty document. */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
}
