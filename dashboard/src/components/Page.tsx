import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode
} from 'react';
import { Link, useLocation } from 'react-router-dom';
import { en } from '../i18n/en';
import { useDrawerA11y } from '../lib/useDrawerA11y';
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

const SIDEBAR_WIDTH = theme.layout.sidebarWidth;
const LOGO_HEIGHT = 56;

/** Primary nav item used in the sidebar / mobile drawer. */
interface NavItem {
  key: string;
  label: string;
  /** Internal SPA path, or null when the item is external. */
  to: string | null;
  /** External absolute URL when `to` is null. */
  href?: string;
  /** Open in a new tab (external only). */
  external?: boolean;
}

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
  zIndex: 30,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  background: `color-mix(in srgb, ${theme.color.surface} 80%, transparent)`,
  borderBottom: `1px solid ${theme.color.border}`,
  paddingTop: 'env(safe-area-inset-top, 0px)'
};

/** Shared max-width column for main and footer so left/right edges align. */
const shellContainer: CSSProperties = {
  width: '100%',
  maxWidth: theme.layout.contentMaxWidth,
  margin: '0 auto',
  padding: `0 ${theme.space.lg}px`,
  boxSizing: 'border-box'
};

// Note: no `display` here on purpose — the `.ra-menu-btn` class owns
// visibility (hidden on desktop, inline-flex below 1024px).
const iconButton: CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: theme.touch,
  minHeight: theme.touch,
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

/**
 * Site logo: single transparent lockup for both themes (no theme-swap, no grey box).
 */
function Logo({ height = LOGO_HEIGHT }: { height?: number }): JSX.Element {
  return (
    <a
      href={APP_URL}
      style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
    >
      <img
        src="/logo-lockup.png"
        alt={en.app.logoAlt}
        height={height}
        style={{
          height,
          width: 'auto',
          maxWidth: 'min(58vw, 260px)',
          objectFit: 'contain'
        }}
      />
    </a>
  );
}

/**
 * Whether a primary nav item is the current page (for active styles).
 */
function isNavActive(pathname: string, key: string): boolean {
  if (key === 'runs') return pathname === '/' || pathname.startsWith('/run/');
  if (key === 'about') return pathname === '/about';
  if (key === 'contact') return pathname === '/contact';
  return false;
}

/**
 * Primary nav: one home entry (Runs) — no duplicate href="/" current pills.
 */
function primaryNavItems(): NavItem[] {
  return [
    { key: 'builder', label: en.app.navBuilder, to: null, href: APP_URL },
    { key: 'runs', label: en.app.navRuns, to: '/' },
    { key: 'about', label: en.app.navAbout, to: '/about' },
    { key: 'contact', label: en.app.navContact, to: '/contact' },
    { key: 'github', label: en.app.navGitHub, to: null, href: GITHUB_URL, external: true }
  ];
}

/** Shared page shell: sticky header, full-height rail, aligned main/footer, drawer. */
export function Page({ title, subtitle, breadcrumb, children }: PageProps): JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const navItems = primaryNavItems();
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  /**
   * Close the mobile nav drawer.
   */
  const closeMenu = useCallback((): void => {
    setMenuOpen(false);
  }, []);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useDrawerA11y({
    open: menuOpen,
    drawerRef,
    triggerRef: menuBtnRef,
    initialFocusRef: closeBtnRef,
    backgroundRefs: [headerRef, bodyRef],
    onClose: closeMenu
  });

  /**
   * Render one nav link (internal Link or external anchor).
   */
  function renderNavLink(item: NavItem, onNavigate?: () => void): JSX.Element {
    const active = isNavActive(location.pathname, item.key);
    const className = `ra-side-link${active ? ' is-active' : ''}`;
    if (item.to !== null) {
      return (
        <Link
          key={item.key}
          to={item.to}
          className={className}
          aria-current={active ? 'page' : undefined}
          onClick={onNavigate}
        >
          {item.label}
        </Link>
      );
    }
    return (
      <a
        key={item.key}
        href={item.href}
        className={className}
        target={item.external === true ? '_blank' : undefined}
        rel={item.external === true ? 'noreferrer' : undefined}
        onClick={onNavigate}
      >
        {item.label}
      </a>
    );
  }

  return (
    <div className="ra-shell" style={shell}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }

        .ra-side-link {
          display: flex;
          align-items: center;
          min-height: ${theme.touch}px;
          padding: ${theme.space.sm}px ${theme.space.md}px;
          border-radius: ${theme.radius.sm}px;
          color: ${theme.color.muted};
          text-decoration: none;
          font-size: ${theme.type.scale[2]}px;
          font-weight: 500;
          font-family: ${theme.type.family};
          border: 1px solid transparent;
          transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .ra-side-link:hover {
          color: ${theme.color.text};
          background: ${theme.color.surface2};
        }
        .ra-side-link:focus-visible {
          outline: 2px solid ${theme.color.accent};
          outline-offset: 2px;
        }
        .ra-side-link.is-active {
          color: ${theme.color.accentFg};
          font-weight: 600;
          background: color-mix(in srgb, ${theme.color.accent} 10%, ${theme.color.surface});
          border-color: color-mix(in srgb, ${theme.color.accent} 25%, ${theme.color.border});
        }

        .ra-menu-btn { display: none; }
        .ra-sidebar { display: none; }
        .ra-drawer-backdrop { display: none; }
        .ra-drawer { display: none; }

        .ra-body {
          display: flex;
          flex: 1;
          min-width: 0;
          width: 100%;
          align-items: stretch;
        }
        .ra-main-col {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
        }

        @media (min-width: 1024px) {
          .ra-sidebar {
            display: flex;
            flex-direction: column;
            width: ${SIDEBAR_WIDTH}px;
            flex-shrink: 0;
            align-self: stretch;
            min-height: 100%;
            position: sticky;
            top: 0;
            height: 100vh;
            overflow-y: auto;
            padding: ${theme.space.md}px ${theme.space.sm}px;
            border-right: 1px solid ${theme.color.border};
            background: color-mix(in srgb, ${theme.color.surface} 70%, ${theme.color.bg});
            gap: ${theme.space.xs}px;
            box-sizing: border-box;
          }
          .ra-sidebar nav {
            display: flex;
            flex-direction: column;
            gap: ${theme.space.xs}px;
          }
          .ra-sidebar-label {
            font-size: ${theme.type.scale[1]}px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: ${theme.color.muted};
            padding: ${theme.space.sm}px ${theme.space.md}px ${theme.space.xs}px;
            margin: 0;
          }
          .ra-menu-btn { display: none !important; }
        }

        @media (max-width: 1023px) {
          .ra-menu-btn { display: inline-flex !important; }
          .ra-drawer-backdrop[data-open="true"] {
            display: block !important;
            position: fixed;
            inset: 0;
            z-index: 40;
            background: rgba(0, 0, 0, 0.55);
          }
          .ra-drawer[data-open="true"] {
            display: flex !important;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            z-index: 50;
            width: min(18rem, 86vw);
            padding: calc(env(safe-area-inset-top, 0px) + ${theme.space.md}px) ${theme.space.md}px env(safe-area-inset-bottom, 0px);
            background: ${theme.color.surface};
            border-right: 1px solid ${theme.color.border};
            box-shadow: ${theme.color.shadow};
            gap: ${theme.space.sm}px;
            overflow-y: auto;
          }
          .ra-drawer nav {
            display: flex;
            flex-direction: column;
            gap: ${theme.space.xs}px;
          }
          .ra-drawer-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: ${theme.space.sm}px;
            margin-bottom: ${theme.space.sm}px;
            min-height: ${theme.touch}px;
          }
          .ra-header-controls[data-drawer-open="true"] {
            visibility: hidden;
            pointer-events: none;
          }
        }

        .ra-footer-grid {
          display: grid;
          gap: ${theme.space.lg}px;
          grid-template-columns: 1fr;
        }
        @media (min-width: 768px) and (max-width: 1023px) {
          .ra-footer-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }
        @media (min-width: 1024px) {
          .ra-footer-grid {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
        }

        @media (max-width: 560px) {
          .ra-h1 { font-size: 1.9rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ra-side-link { transition: none; }
        }
      `}</style>

      <header ref={headerRef} style={bar}>
        <div
          style={{
            width: '100%',
            maxWidth: 'none',
            margin: 0,
            padding: `0 ${theme.space.md}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: theme.space.sm,
            minHeight: LOGO_HEIGHT + theme.space.md
          }}
        >
          <Logo />
          <div
            className="ra-header-controls"
            data-drawer-open={menuOpen ? 'true' : 'false'}
            style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm, flexShrink: 0 }}
          >
            <ThemeToggle />
            <button
              ref={menuBtnRef}
              type="button"
              className="ra-menu-btn"
              style={iconButton}
              aria-expanded={menuOpen}
              aria-controls="ra-side-drawer"
              aria-label={menuOpen ? en.app.menuClose : en.app.menuOpen}
              onClick={() => {
                setMenuOpen((open) => !open);
              }}
            >
              <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
            </button>
          </div>
        </div>
      </header>

      <div
        className="ra-drawer-backdrop"
        data-open={menuOpen ? 'true' : 'false'}
        aria-hidden={!menuOpen}
        onClick={closeMenu}
      />
      <aside
        ref={drawerRef}
        id="ra-side-drawer"
        className="ra-drawer"
        data-open={menuOpen ? 'true' : 'false'}
        aria-label={en.app.primaryNav}
        aria-hidden={!menuOpen}
        tabIndex={-1}
      >
        <div className="ra-drawer-head">
          <Logo height={48} />
          <button
            ref={closeBtnRef}
            type="button"
            style={iconButton}
            aria-label={en.app.menuClose}
            onClick={closeMenu}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
        <nav aria-label={en.app.primaryNav}>
          {navItems.map((item) => renderNavLink(item, closeMenu))}
        </nav>
      </aside>

      <div ref={bodyRef} className="ra-body">
        <aside className="ra-sidebar" aria-label={en.app.primaryNav}>
          <p className="ra-sidebar-label">{en.app.sidebarLabel}</p>
          <nav aria-label={en.app.primaryNav}>{navItems.map((item) => renderNavLink(item))}</nav>
        </aside>

        <div className="ra-main-col">
          <main
            style={{
              ...shellContainer,
              flex: 1,
              padding: `${theme.space.xl}px ${theme.space.lg}px`
            }}
          >
            {breadcrumb !== undefined && <Breadcrumbs current={breadcrumb} />}
            <h1
              className="ra-h1"
              style={{ fontSize: theme.type.scale[5], margin: 0, letterSpacing: '-0.02em' }}
            >
              {title}
            </h1>
            {subtitle !== undefined && (
              <p
                style={{
                  color: theme.color.muted,
                  fontSize: theme.type.scale[3],
                  maxWidth: '40rem',
                  marginTop: theme.space.sm
                }}
              >
                {subtitle}
              </p>
            )}
            <div style={{ marginTop: theme.space.xl }}>{children}</div>
          </main>

          <footer
            style={{
              borderTop: `1px solid ${theme.color.border}`,
              background: `color-mix(in srgb, ${theme.color.surface} 50%, transparent)`,
              marginTop: theme.space.xl
            }}
          >
            <div
              className="ra-footer-grid"
              style={{
                ...shellContainer,
                padding: `${theme.space.xl}px ${theme.space.lg}px`
              }}
            >
              <div>
                <Logo height={48} />
                <p
                  style={{
                    color: theme.color.muted,
                    fontSize: theme.type.scale[2],
                    marginTop: theme.space.sm,
                    maxWidth: '18rem',
                    lineHeight: 1.5
                  }}
                >
                  {en.app.footerTagline}
                </p>
              </div>
              <FooterCol
                heading={en.app.footerProduct}
                links={[
                  { label: en.app.footerAppBuilder, href: APP_URL },
                  { label: en.app.footerDashboard, href: DASHBOARD_URL },
                  { label: en.app.footerGitHub, href: GITHUB_URL }
                ]}
              />
              <FooterCol
                heading={en.app.footerCompany}
                links={[
                  { label: en.app.footerAbout, href: '/about' },
                  { label: en.app.footerContact, href: '/contact' }
                ]}
              />
              <FooterCol
                heading={en.app.footerLegal}
                links={[
                  { label: en.app.footerTerms, href: '/terms' },
                  { label: en.app.footerPrivacy, href: '/privacy' }
                ]}
              />
            </div>
            <div style={{ borderTop: `1px solid ${theme.color.border}` }}>
              <div
                style={{
                  ...shellContainer,
                  padding: `${theme.space.md}px ${theme.space.lg}px`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: theme.space.sm
                }}
              >
                <small style={{ color: theme.color.muted, fontSize: theme.type.scale[1] }}>
                  {en.app.footerCopyright}
                </small>
              </div>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}

interface FooterColProps {
  heading: string;
  links: { label: string; href: string }[];
}

/** One labeled column of footer links (≥44px targets, ≥8px gap). */
function FooterCol({ heading, links }: FooterColProps): JSX.Element {
  return (
    <div>
      <p
        style={{
          color: theme.color.text,
          fontSize: theme.type.scale[2],
          fontWeight: 600,
          margin: `0 0 ${theme.space.sm}px`
        }}
      >
        {heading}
      </p>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          display: 'grid',
          gap: theme.space.sm
        }}
      >
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                minHeight: theme.touch,
                color: theme.color.muted,
                textDecoration: 'none',
                fontSize: theme.type.scale[2]
              }}
            >
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
