import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { SessionProvider } from './hooks/useSession';
import { ShortlistProvider } from './hooks/useShortlist';
import { About } from './pages/About';
import { Account } from './pages/Account';
import { Confirm } from './pages/Confirm';
import { Contact } from './pages/Contact';
import { Forgot } from './pages/Forgot';
import { Home } from './pages/Home';
import { NotFound } from './pages/NotFound';
import { Privacy } from './pages/Privacy';
import { Reset } from './pages/Reset';
import { SignIn } from './pages/SignIn';
import { SignUp } from './pages/SignUp';
import { SitterDetail } from './pages/SitterDetail';
import { Sitters } from './pages/Sitters';
import { Terms } from './pages/Terms';

/** App router: marketplace + required shell pages. */
export function App(): JSX.Element {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ShortlistProvider>
          <ScrollToTop />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/sitters" element={<Sitters />} />
            <Route path="/sitters/:id" element={<SitterDetail />} />
            <Route path="/about" element={<About />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/signin" element={<SignIn />} />
            <Route path="/signup" element={<SignUp />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset" element={<Reset />} />
            <Route path="/confirm" element={<Confirm />} />
            <Route path="/account" element={<Account />} />
            <Route path="/login" element={<Navigate to="/signin" replace />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ShortlistProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
