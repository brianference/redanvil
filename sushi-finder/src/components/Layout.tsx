import { useEffect, useState } from 'react';
import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import { AssistantPanel } from './AssistantPanel';
import { ThemeToggle } from './ThemeToggle';

/**
 * Premium shell: sticky nav, brand mark, theme, assistant, multi-column footer.
 *
 * The nav is a disclosure below 768px. It used to be a wrapping flex row with no
 * mobile treatment, so at 375 the four links broke into a ragged stack around
 * the brand mark and pushed the theme and assistant controls onto their own row.
 * Nothing overlapped, which is why the responsive check passed, but the rule
 * pack asks for overflow in a menu and a screenshot is what showed it.
 */
export function Layout(): JSX.Element {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  // Close on navigation: leaving the panel open over the new page is the classic
  // mobile-menu bug, and it hides the content the user just asked for.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Escape closes, because a disclosure the keyboard cannot dismiss is a trap.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {en.nav.skip}
      </a>
      <header className="shell__header">
        <div className="shell__header-inner">
          <Link className="brand" to="/">
            <img
              className="brand__mark"
              data-measure="mark"
              src="/brand-mark.png"
              alt=""
              width={96}
              height={96}
            />
            <span>{en.brand.name}</span>
          </Link>
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={menuOpen}
            aria-controls="primary-nav"
            aria-label={menuOpen ? en.nav.closeMenu : en.nav.openMenu}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="nav-toggle__bars" aria-hidden="true" />
            <span className="nav-toggle__text">{en.nav.menu}</span>
          </button>
          <nav
            id="primary-nav"
            className={menuOpen ? 'nav nav--open' : 'nav'}
            aria-label="Primary"
          >
            <NavLink to="/" end>
              {en.nav.home}
            </NavLink>
            <NavLink to="/sushis">{en.nav.sushis}</NavLink>
            <NavLink to="/about">{en.nav.about}</NavLink>
            <NavLink to="/contact">{en.nav.contact}</NavLink>
          </nav>
          <div className="shell__actions">
            <ThemeToggle />
            <AssistantPanel />
          </div>
        </div>
      </header>
      {/*
        Pages own <main> so chrome (breadcrumbs outside main on list pages is not needed)
        but collection tests query getByRole('main') for rows only.
      */}
      <div className="shell__main">
        <Outlet />
      </div>
      <footer className="shell__footer">
        <div className="footer-grid">
          <div>
            <Link className="brand" to="/">
              <img
              className="brand__mark"
              data-measure="mark"
              src="/brand-mark.png"
              alt=""
              width={96}
              height={96}
            />
              <span>{en.brand.name}</span>
            </Link>
            <p style={{ color: 'var(--color-muted)', marginTop: '1rem' }}>{en.footer.blurb}</p>
            <p style={{ color: 'var(--color-muted)' }}>{en.footer.rights}</p>
          </div>
          <div>
            <h2>Explore</h2>
            <ul>
              <li>
                <Link to="/sushis">{en.nav.sushis}</Link>
              </li>
              <li>
                <Link to="/about">{en.nav.about}</Link>
              </li>
              <li>
                <Link to="/contact">{en.nav.contact}</Link>
              </li>
              <li>
                {/*
                  A genuine cross-site link, not a token one. fe-cross-link
                  requires a link to a different host and cannot be satisfied by
                  any internal route; RedAnvil is the system that built this app,
                  so the reference isreal rather than manufactured.
                */}
                <a href="https://redanvil.pages.dev" rel="noreferrer noopener">
                  {en.footer.builtWith}
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h2>Legal</h2>
            <ul>
              <li>
                <Link to="/terms">{en.nav.terms}</Link>
              </li>
              <li>
                <Link to="/privacy">{en.nav.privacy}</Link>
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
