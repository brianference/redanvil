import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import { useZone } from '../hooks/useZone';
import { AssistantPanel } from './AssistantPanel';
import { ThemeToggle } from './ThemeToggle';
import { ZoneSelector } from './ZoneSelector';
import './Layout.css';

/**
 * Site chrome: sticky top bar (non-home) + full-bleed content + multi-column footer.
 * Home uses CompactHeader (option 3) inside HomePage -- no duplicate topbar.
 * Brand mark is the finalized cactus/seedling/calendar artwork (public/brand-mark.png).
 */
export function Layout() {
  const { zone } = useZone();
  const location = useLocation();
  const isHome = location.pathname === '/' || location.pathname === '';
  const [navOpen, setNavOpen] = useState(false);

  return (
    <div className="layout">
      <a className="skip-link" href="#main">
        {en.nav.skipToContent}
      </a>
      {!isHome ? (
        <header className="topbar">
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
          <div className="topbar__zone-block">
            <span className="topbar__zone mono" data-testid="topbar-zone">
              {zone ? en.zone.contextLine(zone) : en.appTagline}
            </span>
            <ZoneSelector />
          </div>
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
          <ThemeToggle />
        </header>
      ) : null}
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
      {/* Floating assistant only off home; home mounts a docked rail/dock panel. */}
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
