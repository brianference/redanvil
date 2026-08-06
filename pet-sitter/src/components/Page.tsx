import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { en } from '../i18n/en';
import { ROUTES } from '../lib/routes';
import { AssistantPanel } from './AssistantPanel';
import { BrandLogo } from './BrandLogo';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Page body. */
  children: ReactNode;
}

/** Shared page shell: sticky header, primary nav, breadcrumbs, footer, assistant. */
export function Page({ title, children }: PageProps): JSX.Element {
  // Include Home so desktop audit on `/` still finds aria-current="page".
  const navRoutes = ROUTES;

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        {en.nav.skipToContent}
      </a>
      <header className="topbar" data-testid="compact-header" data-measure="header">
        <BrandLogo className="brand" markClassName="brand__mark" nameClassName="brand__name" />
        <nav className="topbar__nav" aria-label={en.app.primaryNav}>
          <ul className="topbar__list">
            {navRoutes.map((route) => (
              <li key={route.path}>
                <NavLink
                  data-testid="nav-link"
                  to={route.path}
                  end={route.path === '/'}
                  className={({ isActive }) =>
                    isActive ? 'topbar__link topbar__link--active' : 'topbar__link'
                  }
                >
                  {route.name === 'Home'
                    ? en.nav.home
                    : route.name === 'Sitters'
                      ? en.nav.sitters
                      : route.name === 'About'
                        ? en.nav.about
                        : route.name === 'Terms'
                          ? en.nav.terms
                          : route.name === 'Privacy'
                            ? en.nav.privacy
                            : route.name === 'Contact'
                              ? en.nav.contact
                              : route.name === 'Login'
                                ? en.nav.login
                                : route.name}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="topbar__actions">
          <ThemeToggle />
        </div>
      </header>
      <Breadcrumbs />
      <main id="main" className="main">
        <div className="main__inner">
          <h1 className="main__title">{title}</h1>
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
