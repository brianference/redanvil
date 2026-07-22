import { useState, type CSSProperties, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { Breadcrumbs } from './Breadcrumbs';
import { ThemeToggle } from './ThemeToggle';

export interface PageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** Optional hero subtitle under the h1. */
  subtitle?: string;
  /** Optional breadcrumb current-page label (inner pages only). */
  breadcrumb?: string;
  /** Page body. */
  children: ReactNode;
}

const APP_URL = 'https://redanvil.pages.dev';
const DASHBOARD_URL = 'https://redanvil-dashboard.pages.dev';
const GITHUB_URL = 'https://github.com/brianference/redanvil';

const LOGO_HEIGHT = 96;

const shell: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  background: `radial-gradient(1200px 600px at 50% -200px, ${theme.color.surface}, ${theme.color.bg})`,
  color: theme.color.text,
  fontFamily: theme.type.family
};

const bar: CSSProperties = {
  position: 'sticky',
  top: 0,
  zIndex: 10,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  background: `color-mix(in srgb, ${theme.color.surface} 80%, transparent)`,
  borderBottom: `1px solid ${theme.color.border}`
};

const container: CSSProperties = {
  width: '100%',
  maxWidth: '68rem',
  margin: '0 auto',
  padding: `0 ${theme.space.lg}px`
};

// Note: no `display` here on purpose — the `.ra-menu-btn` class owns
// visibility (hidden on desktop, inline-flex at ≤560px). An inline
// `display` would beat the class and leak the hamburger onto desktop.
const iconButton: CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 44,
  minHeight: 44,
  padding: theme.space.sm,
  margin: 0,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.sm,
  background: theme.color.surface,
  color: theme.color.text,
  cursor: 'pointer',
  fontSize: theme.type.scale[2],
  lineHeight: 1,
  fontFamily: theme.type.family
};

/** Site logo: optimized lockup. Header uses ~2× prior size; footer stays compact. */
function Logo({ height = LOGO_HEIGHT }: { height?: number }): JSX.Element {
  const width = Math.round((107 / 56) * height);
  return (
    <a href={APP_URL} style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}>
      <img
        src="/logo-sm.png"
        alt="RedAnvil — forge apps from a prompt"
        width={width}
        height={height}
        style={{ height, width: 'auto', display: 'block', borderRadius: theme.radius.sm }}
      />
    </a>
  );
}

/**
 * Whether a primary nav item is the current page (for active styles).
 */
function isNavActive(pathname: string, key: 'builder' | 'saved'): boolean {
  if (key === 'builder') return pathname === '/';
  return pathname === '/saved' || pathname.startsWith('/prd/');
}

/** Shared page shell: sticky blurred header, optional breadcrumbs, hero title, footer. */
export function Page({ title, subtitle, breadcrumb, children }: PageProps): JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const builderActive = isNavActive(location.pathname, 'builder');
  const savedActive = isNavActive(location.pathname, 'saved');

  return (
    <div style={shell}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }
        .ra-nav-link {
          color: ${theme.color.muted};
          text-decoration: none;
          font-size: ${theme.type.scale[1]}px;
          font-weight: 400;
          padding: ${theme.space.sm}px ${theme.space.sm}px;
          border-radius: ${theme.radius.sm}px;
          white-space: nowrap;
          border-bottom: 2px solid transparent;
          transition: color 0.15s ease, opacity 0.15s ease, border-color 0.15s ease;
        }
        .ra-nav-link:hover {
          opacity: 0.85;
          text-decoration: underline;
          text-underline-offset: 4px;
        }
        .ra-nav-link.is-active {
          color: ${theme.color.accent};
          font-weight: 600;
          border-bottom-color: ${theme.color.accent};
          text-decoration: none;
          opacity: 1;
        }
        .ra-nav-link.is-active:hover {
          text-decoration: none;
          opacity: 1;
        }
        .ra-desktop-nav { display: flex; align-items: center; gap: 0; }
        .ra-menu-btn { display: none; }
        .ra-mobile-panel { display: none; }
        @media (max-width: 560px) {
          .ra-h1 { font-size: 1.9rem !important; }
          .ra-desktop-nav { display: none !important; }
          .ra-menu-btn { display: inline-flex !important; }
          .ra-mobile-panel[data-open="true"] {
            display: block !important;
            padding: ${theme.space.sm}px ${theme.space.md}px ${theme.space.md}px;
            border-top: 1px solid ${theme.color.border};
          }
          .ra-mobile-panel nav {
            display: flex;
            flex-direction: column;
            gap: ${theme.space.xs}px;
          }
          .ra-mobile-panel .ra-nav-link {
            min-height: 44px;
            display: inline-flex;
            align-items: center;
            width: 100%;
          }
        }
      `}</style>
      <header style={bar}>
        <div
          style={{
            ...container,
            padding: `0 ${theme.space.md}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.space.sm,
            minHeight: LOGO_HEIGHT + theme.space.md
          }}
        >
          <Logo />
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm, flexShrink: 0 }}>
            <nav className="ra-desktop-nav" aria-label={en.app.primaryNav}>
              <a href={APP_URL} className={`ra-nav-link${builderActive ? ' is-active' : ''}`} aria-current={builderActive ? 'page' : undefined}>
                {en.app.navBuilder}
              </a>
              <a href={DASHBOARD_URL} className="ra-nav-link">
                {en.app.navDashboard}
              </a>
              <Link to="/saved" className={`ra-nav-link${savedActive ? ' is-active' : ''}`} aria-current={savedActive ? 'page' : undefined}>
                {en.app.navSaved}
              </Link>
              <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="ra-nav-link">
                {en.app.navGitHub}
              </a>
            </nav>
            <ThemeToggle />
            <button
              type="button"
              className="ra-menu-btn"
              style={iconButton}
              aria-expanded={menuOpen}
              aria-controls="ra-mobile-nav"
              aria-label={menuOpen ? en.app.menuClose : en.app.menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open);
              }}
            >
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
        <div
          id="ra-mobile-nav"
          className="ra-mobile-panel"
          data-open={menuOpen ? 'true' : 'false'}
          hidden={!menuOpen}
        >
          <nav aria-label={en.app.primaryNav}>
            <a
              href={APP_URL}
              className={`ra-nav-link${builderActive ? ' is-active' : ''}`}
              aria-current={builderActive ? 'page' : undefined}
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              {en.app.navBuilder}
            </a>
            <a
              href={DASHBOARD_URL}
              className="ra-nav-link"
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              {en.app.navDashboard}
            </a>
            <Link
              to="/saved"
              className={`ra-nav-link${savedActive ? ' is-active' : ''}`}
              aria-current={savedActive ? 'page' : undefined}
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              {en.app.navSaved}
            </Link>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noreferrer"
              className="ra-nav-link"
              onClick={() => {
                setMenuOpen(false);
              }}
            >
              {en.app.navGitHub}
            </a>
          </nav>
        </div>
      </header>

      <main style={{ ...container, flex: 1, padding: `${theme.space.xl}px ${theme.space.lg}px` }}>
        {breadcrumb !== undefined && <Breadcrumbs current={breadcrumb} />}
        <h1 className="ra-h1" style={{ fontSize: theme.type.scale[5], margin: 0, letterSpacing: '-0.02em' }}>
          {title}
        </h1>
        {subtitle !== undefined && (
          <p style={{ color: theme.color.muted, fontSize: theme.type.scale[3], maxWidth: '40rem', marginTop: theme.space.sm }}>
            {subtitle}
          </p>
        )}
        <div style={{ marginTop: theme.space.xl }}>{children}</div>
      </main>

      <footer style={{ borderTop: `1px solid ${theme.color.border}`, background: `color-mix(in srgb, ${theme.color.surface} 50%, transparent)`, marginTop: theme.space.xl }}>
        <div
          style={{
            ...container,
            padding: `${theme.space.xl}px ${theme.space.lg}px`,
            display: 'grid',
            gap: theme.space.lg,
            gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))'
          }}
        >
          <div>
            <Logo height={56} />
            <p style={{ color: theme.color.muted, fontSize: theme.type.scale[0], marginTop: theme.space.sm, maxWidth: '18rem' }}>
              Forge a full-stack app from one prompt. Every app ships behind a real quality gate.
            </p>
          </div>
          <FooterCol
            heading="Product"
            links={[
              { label: 'App Builder', href: APP_URL },
              { label: 'Dashboard', href: DASHBOARD_URL },
              { label: 'GitHub', href: GITHUB_URL }
            ]}
          />
          <FooterCol
            heading="Company"
            links={[
              { label: 'About', href: '/about' },
              { label: 'Contact', href: '/contact' }
            ]}
          />
          <FooterCol
            heading="Legal"
            links={[
              { label: 'Terms', href: '/terms' },
              { label: 'Privacy', href: '/privacy' }
            ]}
          />
        </div>
        <div style={{ borderTop: `1px solid ${theme.color.border}` }}>
          <div style={{ ...container, padding: `${theme.space.md}px ${theme.space.lg}px`, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: theme.space.sm }}>
            <small style={{ color: theme.color.muted }}>© {new Date().getFullYear()} RedAnvil</small>
            <small style={{ color: theme.color.muted }}>Built by the RedAnvil loop</small>
          </div>
        </div>
      </footer>
    </div>
  );
}

interface FooterColProps {
  heading: string;
  links: { label: string; href: string }[];
}

/** One labeled column of footer links. */
function FooterCol({ heading, links }: FooterColProps): JSX.Element {
  return (
    <div>
      <p style={{ color: theme.color.text, fontSize: theme.type.scale[1], fontWeight: 600, margin: `0 0 ${theme.space.sm}px` }}>{heading}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: theme.space.xs }}>
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} style={{ color: theme.color.muted, textDecoration: 'none', fontSize: theme.type.scale[1] }}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
