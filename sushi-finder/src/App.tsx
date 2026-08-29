import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { SavesProvider } from './hooks/useSaves';
import { SessionProvider } from './hooks/useSession';
import { AboutPage } from './pages/AboutPage';
import { AccountPage } from './pages/AccountPage';
import { ConfirmEmailPage } from './pages/ConfirmEmailPage';
import { ContactPage } from './pages/ContactPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { HomePage } from './pages/HomePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { Privacy } from './pages/Privacy';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { SignInPage } from './pages/SignInPage';
import { SignUpPage } from './pages/SignUpPage';
import { SushiDetailPage } from './pages/SushiDetailPage';
import { SushiFormPage } from './pages/SushiFormPage';
import { SushiListPage } from './pages/SushiListPage';
import { Terms } from './pages/Terms';

/**
 * App routes. Catalog stays public; /account redirects to /signin when unsigned.
 */
export function App() {
  return (
    <SessionProvider>
      <SavesProvider>
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
      </SavesProvider>
    </SessionProvider>
  );
}
