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

/** Desktop sidebar rail width (px). Main content is offset by this at ≥1024px. */
const SIDEBAR_WIDTH = 220;

const LOGO_HEIGHT = 96;

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

const container: CSSProperties = {
  width: '100%',
  maxWidth: '68rem',
  margin: '0 auto',
  padding: `0 ${theme.space.lg}px`
};

// Note: no `display` here on purpose — the `.ra-menu-btn` class owns
// visibility (hidden on desktop, inline-flex below 1024px). An inline
// `display` would beat the class and leak the hamburger onto desktop.
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

/** Site logo: optimized lockup. Header uses ~2× prior size; footer stays compact. */
function Logo({ height = LOGO_HEIGHT }: { height?: number }): JSX.Element {
  // Theme-aware: dark-background raster for dark mode, transparent light lockup for
  // light mode (no black box on light pages). The .ra-logo-dark/.ra-logo-light
  // classes own visibility — no `display` inline, or it would beat the class.
  const imgStyle: CSSProperties = {
    height,
    width: 'auto',
    maxWidth: 'min(58vw, 260px)',
    objectFit: 'contain',
    borderRadius: theme.radius.sm
  };
  return (
    <a
      href={APP_URL}
      style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
    >
      <img
        className="ra-logo-dark"
        src="/logo-sm.png"
        alt="RedAnvil — forge apps from a prompt"
        height={height}
        style={imgStyle}
      />
      <img
        className="ra-logo-light"
        src="/logo-light.png"
        alt="RedAnvil — forge apps from a prompt"
        height={height}
        style={imgStyle}
      />
    </a>
  );
}

/**
 * Whether a primary nav item is the current page (for active styles).
 */
function isNavActive(pathname: string, key: string): boolean {
  if (key === 'builder') return pathname === '/';
  if (key === 'saved') return pathname === '/saved' || pathname.startsWith('/prd/');
  if (key === 'about') return pathname === '/about';
  if (key === 'contact') return pathname === '/contact';
  return false;
}

/**
 * Build the ordered primary nav list (sidebar + mobile drawer).
 */
function primaryNavItems(): NavItem[] {
  return [
    { key: 'builder', label: en.app.navBuilder, to: '/' },
    { key: 'dashboard', label: en.app.navDashboard, to: null, href: DASHBOARD_URL },
    { key: 'saved', label: en.app.navSaved, to: '/saved' },
    { key: 'about', label: en.app.navAbout, to: '/about' },
    { key: 'contact', label: en.app.navContact, to: '/contact' },
    { key: 'github', label: en.app.navGitHub, to: null, href: GITHUB_URL, external: true }
  ];
}

/** Shared page shell: sticky blurred header, collapsible sidebar, optional breadcrumbs, footer. */
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

  // Close the mobile drawer on route change.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Lock body scroll while the mobile drawer is open.
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
    <div style={shell}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }
        /* Theme-aware logo swap: dark lockup on dark, transparent light lockup on light. */
        .ra-logo-dark { display: block; }
        .ra-logo-light { display: none; }
        :root[data-theme='light'] .ra-logo-dark { display: none; }
        :root[data-theme='light'] .ra-logo-light { display: block; }
        @media (prefers-color-scheme: light) {
          :root:not([data-theme]) .ra-logo-dark { display: none; }
          :root:not([data-theme]) .ra-logo-light { display: block; }
        }
        .ra-side-link {
          display: flex;
          align-items: center;
          min-height: ${theme.touch}px;
          padding: ${theme.space.sm}px ${theme.space.md}px;
          border-radius: ${theme.radius.md}px;
          color: ${theme.color.muted};
          text-decoration: none;
          font-size: ${theme.type.scale[2]}px;
          font-weight: 500;
          border: 1px solid transparent;
          transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .ra-side-link:hover {
          color: ${theme.color.text};
          background: color-mix(in srgb, ${theme.color.surfaceElevated} 80%, transparent);
        }
        .ra-side-link.is-active {
          color: ${theme.color.accent};
          font-weight: 650;
          background: ${theme.color.accentSoft};
          border-color: color-mix(in srgb, ${theme.color.accent} 35%, ${theme.color.border});
        }
        .ra-side-link.is-active:hover {
          color: ${theme.color.accent};
        }
        .ra-menu-btn { display: none; }
        .ra-sidebar {
          display: none;
        }
        .ra-drawer-backdrop {
          display: none;
        }
        .ra-drawer {
          display: none;
        }
        .ra-body {
          display: flex;
          flex: 1;
          min-width: 0;
          width: 100%;
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
            position: sticky;
            /* Sit under the sticky header — no overlap with the logo bar. */
            top: calc(${LOGO_HEIGHT + theme.space.md}px + env(safe-area-inset-top, 0px));
            align-self: flex-start;
            max-height: calc(100vh - ${LOGO_HEIGHT + theme.space.md}px - env(safe-area-inset-top, 0px));
            overflow-y: auto;
            padding: ${theme.space.md}px ${theme.space.sm}px;
            border-right: 1px solid ${theme.color.border};
            background: color-mix(in srgb, ${theme.color.surface} 55%, ${theme.color.bg});
            gap: ${theme.space.xs}px;
          }
          .ra-sidebar nav {
            display: flex;
            flex-direction: column;
            gap: ${theme.space.xs}px;
          }
          .ra-sidebar-label {
            font-size: ${theme.type.scale[0]}px;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            color: ${theme.color.muted};
            padding: ${theme.space.sm}px ${theme.space.md}px ${theme.space.xs}px;
            margin: 0;
          }
        }
        @media (max-width: 1023px) {
          .ra-menu-btn { display: inline-flex !important; }
          .ra-drawer-backdrop[data-open="true"] {
            display: block !important;
            position: fixed;
            inset: 0;
            z-index: 40;
            background: var(--scrim);
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
            box-shadow: 8px 0 32px var(--shadow);
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
          .ra-drawer-title {
            font-size: ${theme.type.scale[1]}px;
            font-weight: 700;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: ${theme.color.muted};
            margin: 0;
          }
        }
        @media (max-width: 560px) {
          .ra-h1 { font-size: 1.9rem !important; }
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
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm, minWidth: 0 }}>
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
            <Logo />
          </div>
          <div
            style={{ display: 'flex', alignItems: 'center', gap: theme.space.sm, flexShrink: 0 }}
          >
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Mobile drawer (off-canvas); desktop uses the sticky rail below. */}
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
          <p className="ra-drawer-title">{en.app.sidebarLabel}</p>
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
            style={{ ...container, flex: 1, padding: `${theme.space.xl}px ${theme.space.lg}px` }}
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
                <p
                  style={{
                    color: theme.color.muted,
                    fontSize: theme.type.scale[0],
                    marginTop: theme.space.sm,
                    maxWidth: '18rem'
                  }}
                >
                  {en.app.footerTagline}
                </p>
              </div>
              <FooterCol
                heading={en.app.footerProduct}
                links={[
                  { label: en.app.navBuilder, href: '/' },
                  { label: en.app.navDashboard, href: DASHBOARD_URL },
                  { label: en.app.navSaved, href: '/saved' },
                  { label: en.app.navGitHub, href: GITHUB_URL }
                ]}
              />
              <FooterCol
                heading={en.app.footerCompany}
                links={[
                  { label: en.pages.about.title, href: '/about' },
                  { label: en.pages.contact.title, href: '/contact' }
                ]}
              />
              <FooterCol
                heading={en.app.footerLegal}
                links={[
                  { label: en.pages.terms.title, href: '/terms' },
                  { label: en.pages.privacy.title, href: '/privacy' }
                ]}
              />
            </div>
            <div
              style={{
                borderTop: `1px solid ${theme.color.border}`,
                paddingBottom: 'env(safe-area-inset-bottom, 0px)'
              }}
            >
              <div
                style={{
                  ...container,
                  padding: `${theme.space.md}px ${theme.space.lg}px`,
                  display: 'flex',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: theme.space.sm
                }}
              >
                <small style={{ color: theme.color.muted }}>
                  {en.app.footerCopyright(new Date().getFullYear())}
                </small>
                <small style={{ color: theme.color.muted }}>{en.app.footerQuality}</small>
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

/** One labeled column of footer links. */
function FooterCol({ heading, links }: FooterColProps): JSX.Element {
  return (
    <div>
      <p
        style={{
          color: theme.color.text,
          fontSize: theme.type.scale[1],
          fontWeight: 600,
          margin: `0 0 ${theme.space.sm}px`
        }}
      >
        {heading}
      </p>
      <ul
        style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: theme.space.xs }}
      >
        {links.map((l) => (
          <li key={l.label}>
            <a
              href={l.href}
              style={{
                color: theme.color.muted,
                textDecoration: 'none',
                fontSize: theme.type.scale[1]
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
