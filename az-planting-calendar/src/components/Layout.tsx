import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import { useTheme } from '../hooks/useTheme';
import { useZone } from '../hooks/useZone';
import type { ThemeMode } from '../theme';
import { AssistantPanel } from './AssistantPanel';
import { ZoneSelector } from './ZoneSelector';
import './Layout.css';

/**
 * Site chrome: sticky top bar + full-bleed content + multi-column footer.
 * Brand mark is the finalized cactus/seedling/calendar artwork (public/brand-mark.png).
 */
export function Layout() {
  const { mode, cycle } = useTheme();
  const themeLabel = themeModeLabel(mode);
  const { zone } = useZone();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="layout">
      <a className="skip-link" href="#main">
        {en.nav.skipToContent}
      </a>
      <header className={isHome ? 'topbar topbar--home' : 'topbar'}>
        <div className="topbar__brand">
          <Link to="/" className="topbar__logo" aria-label={en.appName}>
            <img
              className="topbar__mark"
              src="/brand-mark.png"
              alt=""
              width={96}
              height={96}
              aria-hidden="true"
              decoding="async"
            />
            <span className="topbar__name">{en.appName}</span>
          </Link>
        </div>
        {/* On home, zone lives in the full-width zone bar above search (Timeline + rail). */}
        {!isHome ? (
          <div className="topbar__zone-block">
            <span className="topbar__zone mono" data-testid="topbar-zone">
              {zone ? en.zone.contextLine(zone) : en.appTagline}
            </span>
            <ZoneSelector />
          </div>
        ) : (
          <div className="topbar__zone-block topbar__zone-block--home-tag">
            <span className="topbar__zone mono" data-testid="topbar-zone">
              {zone ? en.zone.contextLine(zone) : en.appTagline}
            </span>
          </div>
        )}
        <button
          type="button"
          className="topbar__menu-btn"
          aria-expanded={navOpen}
          aria-controls="primary-nav"
          onClick={() => setNavOpen((v) => !v)}
          data-testid="nav-menu-toggle"
        >
          {navOpen ? en.nav.menuClose : en.nav.menuOpen}
        </button>
        <nav
          id="primary-nav"
          className={navOpen ? 'topbar__nav topbar__nav--open' : 'topbar__nav'}
          aria-label="Primary"
        >
          <NavLink to="/" end className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.home}
          </NavLink>
          <NavLink to="/grid" className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.grid}
          </NavLink>
          <NavLink to="/about" className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.about}
          </NavLink>
          <NavLink to="/contact" className={navClass} onClick={() => setNavOpen(false)}>
            {en.nav.contact}
          </NavLink>
        </nav>
        <button
          type="button"
          className="theme-toggle"
          onClick={cycle}
          aria-label={en.nav.themeToggleAria(themeLabel)}
          title={`${en.nav.theme}: ${themeLabel}`}
          data-testid="theme-toggle"
          data-theme-mode={mode}
        >
          <ThemeToggleIcon mode={mode} />
          <span className="theme-toggle__sr-only">
            {en.nav.theme}: {themeLabel}
          </span>
        </button>
      </header>
      <main id="main" className="layout__main">
        <Outlet />
      </main>
      <footer className="site-footer shell">
        <div className="site-footer__inner">
          <div className="site-footer__grid">
            <section className="site-footer__col" aria-labelledby="footer-calendar">
              <h2 id="footer-calendar" className="site-footer__heading">
                {en.footer.colCalendar}
              </h2>
              <ul className="site-footer__list">
                <li>
                  <Link to="/">{en.footer.home}</Link>
                </li>
                <li>
                  <Link to="/grid">{en.footer.yearGrid}</Link>
                </li>
                <li>
                  <a href="/#plantable-now">{en.footer.plantable}</a>
                </li>
              </ul>
            </section>
            <section className="site-footer__col" aria-labelledby="footer-about">
              <h2 id="footer-about" className="site-footer__heading">
                {en.footer.colAbout}
              </h2>
              <ul className="site-footer__list">
                <li>
                  <Link to="/about">{en.footer.about}</Link>
                </li>
                <li>
                  <Link to="/contact">{en.footer.contact}</Link>
                </li>
                <li>
                  <a
                    href={en.footer.dataLinkHref}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {en.footer.dataLinkLabel}
                  </a>
                </li>
              </ul>
            </section>
            <section className="site-footer__col" aria-labelledby="footer-legal">
              <h2 id="footer-legal" className="site-footer__heading">
                {en.footer.colLegal}
              </h2>
              <ul className="site-footer__list">
                <li>
                  <Link to="/terms">{en.footer.terms}</Link>
                </li>
                <li>
                  <Link to="/privacy">{en.footer.privacy}</Link>
                </li>
              </ul>
            </section>
          </div>
          <p className="site-footer__note">{en.footer.rights}</p>
        </div>
      </footer>
      {/* Floating assistant only off home; home mounts an inline open-by-default panel. */}
      {!isHome ? <AssistantPanel defaultOpen={false} placement="floating" /> : null}
    </div>
  );
}

/**
 * @param args - NavLink className args.
 */
function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'topbar__link topbar__link--active' : 'topbar__link';
}

/**
 * Human label for the stored theme mode.
 *
 * @param mode - Stored preference.
 */
function themeModeLabel(mode: ThemeMode): string {
  if (mode === 'system') return en.nav.themeSystem;
  if (mode === 'light') return en.nav.themeLight;
  return en.nav.themeDark;
}

/**
 * Sun (light), moon (dark), or dual sun/moon (system) icon for the theme control.
 *
 * @param props - Current stored theme mode.
 */
function ThemeToggleIcon({ mode }: { mode: ThemeMode }) {
  if (mode === 'light') {
    return (
      <svg
        className="theme-toggle__icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        focusable="false"
      >
        <circle cx="12" cy="12" r="4" fill="currentColor" />
        <path
          fill="currentColor"
          d="M12 2.5a1 1 0 0 1 1 1V5a1 1 0 1 1-2 0V3.5a1 1 0 0 1 1-1zm0 14a1 1 0 0 1 1 1v1.5a1 1 0 1 1-2 0V17.5a1 1 0 0 1 1-1zM3.5 11a1 1 0 0 0 0 2H5a1 1 0 1 0 0-2H3.5zm14 0a1 1 0 1 0 0 2H19a1 1 0 1 0 0-2h-1.5zM5.64 5.64a1 1 0 0 1 1.41 0l1.06 1.06a1 1 0 1 1-1.41 1.41L5.64 7.05a1 1 0 0 1 0-1.41zm10.25 10.25a1 1 0 0 1 1.41 0l1.06 1.06a1 1 0 0 1-1.41 1.41l-1.06-1.06a1 1 0 0 1 0-1.41zM5.64 18.36a1 1 0 0 1 0-1.41l1.06-1.06a1 1 0 0 1 1.41 1.41L7.05 18.36a1 1 0 0 1-1.41 0zm10.25-10.25a1 1 0 0 1 0-1.41l1.06-1.06a1 1 0 1 1 1.41 1.41l-1.06 1.06a1 1 0 0 1-1.41 0z"
        />
      </svg>
    );
  }

  if (mode === 'dark') {
    return (
      <svg
        className="theme-toggle__icon"
        viewBox="0 0 24 24"
        width="22"
        height="22"
        aria-hidden="true"
        focusable="false"
      >
        <path
          fill="currentColor"
          d="M16.5 2.5a1 1 0 0 1 1.05.14 9 9 0 1 1-11.2 13.9 1 1 0 0 1 .95-1.64 7 7 0 0 0 8.7-9.3 1 1 0 0 1 .5-3.1z"
        />
      </svg>
    );
  }

  return (
    <svg
      className="theme-toggle__icon"
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="9" cy="12" r="3.25" fill="currentColor" />
      <path
        fill="currentColor"
        d="M9 4.25a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 9 4.25zm0 12a.75.75 0 0 1 .75.75v1a.75.75 0 0 1-1.5 0v-1A.75.75 0 0 1 9 16.25zM3.25 11.25a.75.75 0 0 0 0 1.5h1a.75.75 0 0 0 0-1.5h-1zm9.5 0a.75.75 0 0 0 0 1.5h1a.75.75 0 0 0 0-1.5h-1z"
      />
      <path
        fill="currentColor"
        d="M17.25 8.5a.75.75 0 0 1 .78.1 5.5 5.5 0 1 1-6.4 8.05.75.75 0 0 1 .7-1.22 4 4 0 0 0 5-5.35.75.75 0 0 1-.08-1.58z"
      />
    </svg>
  );
}
