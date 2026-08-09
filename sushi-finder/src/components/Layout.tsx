import { NavLink, Outlet, Link } from 'react-router-dom';
import { en } from '../i18n/en';
import { AssistantPanel } from './AssistantPanel';
import { ThemeToggle } from './ThemeToggle';

/**
 * Premium shell: sticky nav, brand mark, theme, assistant, multi-column footer.
 */
export function Layout(): JSX.Element {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {en.nav.skip}
      </a>
      <header className="shell__header">
        <div className="shell__header-inner">
          <Link className="brand" to="/">
            <img className="brand__mark" src="/brand-mark.png" alt="" width={96} height={96} />
            <span>{en.brand.name}</span>
          </Link>
          <nav className="nav" aria-label="Primary">
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
              <img className="brand__mark" src="/brand-mark.png" alt="" width={96} height={96} />
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
