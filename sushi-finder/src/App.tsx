import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Privacy } from './pages/Privacy';
import { SushiDetailPage } from './pages/SushiDetailPage';
import { SushiFormPage } from './pages/SushiFormPage';
import { SushiListPage } from './pages/SushiListPage';
import { Terms } from './pages/Terms';

/**
 * App routes. All product routes are public (PRD F6).
 */
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="sushis" element={<SushiListPage />} />
        <Route path="sushis/new" element={<SushiFormPage mode="create" />} />
        <Route path="sushis/:id/edit" element={<SushiFormPage mode="edit" />} />
        <Route path="sushis/:id" element={<SushiDetailPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="terms" element={<Terms />} />
        <Route path="privacy" element={<Privacy />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
