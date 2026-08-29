import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { BedProvider } from './hooks/useBed';
import { SessionProvider } from './hooks/useSession';
import { AboutPage } from './pages/AboutPage';
import { AccountPage } from './pages/AccountPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ContactPage } from './pages/ContactPage';
import { CropDetailPage } from './pages/CropDetailPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { GridPage } from './pages/GridPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { TermsPage } from './pages/TermsPage';

/**
 * App routes. Home is the focus-hero planting calendar; /grid is the year grid.
 * Account routes sit inside the existing layout; /account redirects when signed out.
 */
export function App() {
  return (
    <SessionProvider>
      <BedProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="grid" element={<GridPage />} />
            <Route path="crop/:id" element={<CropDetailPage />} />
            <Route path="about" element={<AboutPage />} />
            <Route path="terms" element={<TermsPage />} />
            <Route path="privacy" element={<PrivacyPage />} />
            <Route path="contact" element={<ContactPage />} />
            <Route path="signin" element={<SignInPage />} />
            <Route path="signup" element={<SignUpPage />} />
            <Route path="forgot" element={<ForgotPasswordPage />} />
            <Route path="reset" element={<ResetPasswordPage />} />
            <Route path="confirm" element={<ConfirmEmailPage />} />
            <Route path="account" element={<AccountPage />} />
            <Route path="home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BedProvider>
    </SessionProvider>
  );
}
