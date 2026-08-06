import { useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { SafeExternalLink } from '../../../design-system/SafeExternalLink';
import { en } from '../i18n/en';
import { useZone } from '../hooks/useZone';
import { AssistantPanel } from './AssistantPanel';
import { BrandLogo } from './BrandLogo';
import { Breadcrumbs } from './Breadcrumbs';
import { PrimaryNavLinks } from './PrimaryNavLinks';
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
            <BrandLogo
              className="topbar__logo"
              markClassName="topbar__mark"
              nameClassName="topbar__name"
            />
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
            <PrimaryNavLinks
              className={navClass}
              onNavigate={() => setNavOpen(false)}
            />
          </nav>
          <ThemeToggle />
        </header>
      ) : null}
      {!isHome ? <Breadcrumbs /> : null}
      {!isHome ? (
        <div className="layout__assistant-dock shell">
          <AssistantPanel defaultOpen={false} placement="floating" />
        </div>
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
              </ul>
            </section>
          </div>

          {/*
            Provenance promoted out of the link list and cited. This app's whole
            claim is that its windows come from a real extension publication, so
            burying that as the third bullet under a heading understated it.
          */}
          <aside className="site-footer__source" aria-labelledby="footer-source">
            <p id="footer-source" className="site-footer__source-label">
              {en.footer.sourceLabel}
            </p>
            <p className="site-footer__source-line">{en.footer.sourceLine}</p>
            <SafeExternalLink
              className="site-footer__source-link"
              href={en.footer.dataLinkHref}
            >
              {en.footer.dataLinkLabel}
            </SafeExternalLink>
          </aside>

          <div className="site-footer__bottom">
            <span className="site-footer__copyright">{en.footer.copyright}</span>
            <nav className="site-footer__legal" aria-label={en.footer.colLegal}>
              <Link to="/terms">{en.footer.terms}</Link>
              <Link to="/privacy">{en.footer.privacy}</Link>
            </nav>
          </div>
          <p className="site-footer__note">{en.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
}

/**
 * Topbar NavLink class names.
 *
 * @param args - Active state from react-router.
 */
function navClass(isActive: boolean): string {
  return isActive ? 'topbar__link topbar__link--active' : 'topbar__link';
}
