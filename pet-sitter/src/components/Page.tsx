import { useState, type ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { en } from '../i18n/en';
import { ROUTES, type AppRoute } from '../lib/routes';
import { AssistantPanel } from './AssistantPanel';
import { BrandLogo } from './BrandLogo';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';

export interface PageProps {
  /**
   * Page title as the main h1. Omit when a layout architecture owns the fold
   * (Photos / Map / Dates each render their own h1).
   */
  title?: string;
  /** Page body. */
  children: ReactNode;
  /**
   * Full-bleed main: no shell padding. Used when Map owns the canvas.
   */
  fullBleed?: boolean;
  /**
   * Hide breadcrumbs (marketplace layouts open on their architecture, not a doc trail).
   */
  hideBreadcrumbs?: boolean;
}

/**
 * Localised label for a primary nav route.
 *
 * @param route - Canonical app route.
 * @returns Display string.
 */
function navLabel(route: AppRoute): string {
  switch (route.name) {
    case 'Home':
      return en.nav.home;
    case 'Sitters':
      return en.nav.sitters;
    case 'About':
      return en.nav.about;
    case 'Terms':
      return en.nav.terms;
    case 'Privacy':
      return en.nav.privacy;
    case 'Contact':
      return en.nav.contact;
    case 'Login':
      return en.nav.login;
    default:
      return route.name;
  }
}

/**
 * NavLink class names for topbar links.
 *
 * @param isActive - Whether the link matches the current location.
 * @returns Class string.
 */
function topbarLinkClass(isActive: boolean): string {
  return isActive ? 'topbar__link topbar__link--active' : 'topbar__link';
}

/** Shared page shell: sticky header, primary nav, optional breadcrumbs, footer, assistant. */
export function Page({
  title,
  children,
  fullBleed = false,
  hideBreadcrumbs = false
}: PageProps): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  // Home stays visible at 375; secondary chrome goes behind the menu control.
  const primaryRoutes = ROUTES.filter((route) => route.path === '/');
  const secondaryRoutes = ROUTES.filter((route) => route.path !== '/');

  /**
   * Close the mobile overflow menu after a secondary nav selection.
   */
  function closeMenu(): void {
    setMenuOpen(false);
  }

  const mainClass = fullBleed ? 'main main--bleed' : 'main';

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {en.nav.skipToContent}
      </a>
      <header className="topbar" data-testid="compact-header" data-measure="header">
        <BrandLogo className="brand" markClassName="brand__mark" nameClassName="brand__name" />
        <nav className="topbar__nav" aria-label={en.app.primaryNav} data-testid="primary-nav">
          <ul className="topbar__list topbar__list--primary">
            {primaryRoutes.map((route) => (
              <li key={route.path}>
                <NavLink
                  data-testid="nav-link"
                  to={route.path}
                  end
                  className={({ isActive }) => topbarLinkClass(isActive)}
                >
                  {navLabel(route)}
                </NavLink>
              </li>
            ))}
          </ul>
          <ul className="topbar__list topbar__list--desktop-secondary">
            {secondaryRoutes.map((route) => (
              <li key={route.path}>
                <NavLink
                  data-testid="nav-link"
                  to={route.path}
                  className={({ isActive }) => topbarLinkClass(isActive)}
                >
                  {navLabel(route)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="topbar__actions">
          <ThemeToggle />
          <button
            type="button"
            className="topbar__menu-btn"
            aria-expanded={menuOpen}
            aria-controls="topbar-menu"
            data-testid="nav-menu-toggle"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? en.nav.menuClose : en.nav.menuOpen}
          </button>
        </div>
        <nav
          id="topbar-menu"
          className={
            menuOpen
              ? 'topbar__menu topbar__menu--open'
              : 'topbar__menu'
          }
          aria-label={en.app.primaryNav}
          hidden={!menuOpen}
          data-testid="primary-nav-menu"
        >
          <ul className="topbar__list topbar__list--menu">
            {secondaryRoutes.map((route) => (
              <li key={route.path}>
                <NavLink
                  data-testid="nav-link"
                  to={route.path}
                  className={({ isActive }) => topbarLinkClass(isActive)}
                  onClick={closeMenu}
                >
                  {navLabel(route)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {hideBreadcrumbs ? null : <Breadcrumbs />}
      <main id="main" className={mainClass}>
        <div className="main__inner">
          {title ? <h1 className="main__title">{title}</h1> : null}
          {children}
        </div>
      </main>
      <AssistantPanel />
      <footer className="site-footer">
        <div className="site-footer__inner">
          <div className="site-footer__grid">
            <section className="site-footer__col" aria-labelledby="footer-explore">
              <h2 id="footer-explore" className="site-footer__heading">
                {en.footer.explore}
              </h2>
              <ul className="site-footer__list">
                <li>
                  <Link to="/">{en.nav.home}</Link>
                </li>
                <li>
                  <Link to="/sitters">{en.nav.sitters}</Link>
                </li>
                <li>
                  <Link to="/login">{en.nav.login}</Link>
                </li>
              </ul>
            </section>
            <section className="site-footer__col" aria-labelledby="footer-company">
              <h2 id="footer-company" className="site-footer__heading">
                {en.footer.company}
              </h2>
              <ul className="site-footer__list">
                <li>
                  <Link to="/about">{en.nav.about}</Link>
                </li>
                <li>
                  <Link to="/contact">{en.nav.contact}</Link>
                </li>
                <li>
                  <a
                    href="https://redanvil.pages.dev"
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {en.footer.siblingProduct}
                  </a>
                </li>
              </ul>
            </section>
            <section className="site-footer__col" aria-labelledby="footer-legal">
              <h2 id="footer-legal" className="site-footer__heading">
                {en.footer.legal}
              </h2>
              <ul className="site-footer__list">
                <li>
                  <Link to="/terms">{en.nav.terms}</Link>
                </li>
                <li>
                  <Link to="/privacy">{en.nav.privacy}</Link>
                </li>
              </ul>
            </section>
          </div>
          <p className="site-footer__copy">{en.app.footerCopyright}</p>
        </div>
      </footer>
    </div>
  );
}
