import { Link, NavLink, Outlet } from 'react-router-dom';
import { en } from '../i18n/en';
import { useTheme } from '../hooks/useTheme';
import './Layout.css';

/**
 * Site chrome: compact top bar + full-bleed content (not a centered sticky shell).
 */
export function Layout() {
  const { mode, cycle } = useTheme();
  const themeLabel =
    mode === 'system'
      ? en.nav.themeSystem
      : mode === 'light'
        ? en.nav.themeLight
        : en.nav.themeDark;

  return (
    <div className="layout">
      <a className="skip-link" href="#main">
        {en.nav.skipToContent}
      </a>
      <header className="topbar">
        <div className="topbar__brand">
          <Link to="/" className="topbar__logo">
            <span className="topbar__mark" aria-hidden="true">
              AZ
            </span>
            <span className="topbar__name">{en.appName}</span>
          </Link>
          <span className="topbar__zone mono">{en.appTagline}</span>
        </div>
        <nav className="topbar__nav" aria-label="Primary">
          <NavLink to="/" end className={navClass}>
            {en.nav.home}
          </NavLink>
          <NavLink to="/about" className={navClass}>
            {en.nav.about}
          </NavLink>
          <NavLink to="/contact" className={navClass}>
            {en.nav.contact}
          </NavLink>
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={cycle}
          aria-label={`${en.nav.theme}: ${themeLabel}`}
          data-testid="theme-toggle"
        >
          <span className="theme-toggle__label">{en.nav.theme}</span>
          <span className="theme-toggle__value mono">{themeLabel}</span>
        </button>
      </header>
      <main id="main" className="layout__main">
        <Outlet />
      </main>
      <footer className="site-footer shell">
        <div className="site-footer__inner">
          <nav className="site-footer__nav" aria-label="Legal">
            <Link to="/about">{en.nav.about}</Link>
            <Link to="/terms">{en.nav.terms}</Link>
            <Link to="/privacy">{en.nav.privacy}</Link>
            <Link to="/contact">{en.nav.contact}</Link>
          </nav>
          <p className="site-footer__note">{en.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * @param args - NavLink className args.
 */
function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'topbar__link topbar__link--active' : 'topbar__link';
}
