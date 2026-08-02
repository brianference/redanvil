import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AboutPage } from './pages/AboutPage';
import { ContactPage } from './pages/ContactPage';
import { CropDetailPage } from './pages/CropDetailPage';
import { GridPage } from './pages/GridPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';

/**
 * App routes. Home is the focus-hero planting calendar; /grid is the year grid.
 */
export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="grid" element={<GridPage />} />
        <Route path="crop/:id" element={<CropDetailPage />} />
        <Route path="about" element={<AboutPage />} />
        <Route path="terms" element={<TermsPage />} />
        <Route path="privacy" element={<PrivacyPage />} />
        <Route path="contact" element={<ContactPage />} />
        <Route path="home" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
