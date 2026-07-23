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

const LOGO_HEIGHT = 96;
const SIDEBAR_WIDTH = theme.layout.sidebarWidth;

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
// visibility (hidden on desktop, inline-flex below 1024px). An inline
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

/**
 * Site logo: theme-aware lockup. The dark-background raster ships for dark mode;
 * a transparent light version renders in light mode (no black box on light pages).
 * Visibility is owned by the `.ra-logo-dark` / `.ra-logo-light` classes (see the
 * style block) — no `display` in the inline style, or it would beat the class.
 */
function Logo({ height = LOGO_HEIGHT }: { height?: number }): JSX.Element {
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
        alt={en.app.logoAlt}
        height={height}
        style={imgStyle}
      />
      <img
        className="ra-logo-light"
        src="/logo-light.png"
        alt={en.app.logoAlt}
        height={height}
        style={imgStyle}
      />
    </a>
  );
}

type NavKey = 'dashboard' | 'runs' | 'about' | 'contact';

/**
 * Whether a primary nav item is the current page (for active styles).
 */
function isNavActive(pathname: string, key: NavKey): boolean {
  if (key === 'dashboard' || key === 'runs') return pathname === '/';
  if (key === 'about') return pathname === '/about';
  if (key === 'contact') return pathname === '/contact';
  return false;
}

interface NavItem {
  key: string;
  label: string;
  href?: string;
  to?: string;
  activeKey?: NavKey;
  external?: boolean;
}

/**
 * Primary nav items for the sidebar and mobile drawer.
 */
function navItems(): readonly NavItem[] {
  return [
    { key: 'builder', label: en.app.navBuilder, href: APP_URL, external: true },
    { key: 'dashboard', label: en.app.navDashboard, to: '/', activeKey: 'dashboard' },
    { key: 'runs', label: en.app.navRuns, to: '/', activeKey: 'runs' },
    { key: 'about', label: en.app.navAbout, to: '/about', activeKey: 'about' },
    { key: 'contact', label: en.app.navContact, to: '/contact', activeKey: 'contact' },
    { key: 'github', label: en.app.navGitHub, href: GITHUB_URL, external: true }
  ];
}

interface SideNavProps {
  pathname: string;
  /** Called after an in-app link is activated (closes the mobile drawer). */
  onNavigate?: () => void;
  /** Accessible label for the nav landmark. */
  ariaLabel: string;
  /** Extra class on the nav element (desktop rail vs drawer). */
  className?: string;
  id?: string;
}

/**
 * Shared primary navigation list used by the desktop rail and mobile drawer.
 */
function SideNav({ pathname, onNavigate, ariaLabel, className, id }: SideNavProps): JSX.Element {
  return (
    <nav id={id} className={className} aria-label={ariaLabel}>
      <ul className="ra-side-list">
        {navItems().map((item) => {
          const active =
            item.activeKey !== undefined ? isNavActive(pathname, item.activeKey) : false;
          const classNameLink = `ra-side-link${active ? ' is-active' : ''}`;

          if (item.to !== undefined) {
            return (
              <li key={item.key}>
                <Link
                  to={item.to}
                  className={classNameLink}
                  aria-current={active ? 'page' : undefined}
                  onClick={onNavigate}
                >
                  {item.label}
                </Link>
              </li>
            );
          }

          return (
            <li key={item.key}>
              <a
                href={item.href}
                className={classNameLink}
                target={item.external === true ? '_blank' : undefined}
                rel={item.external === true ? 'noreferrer' : undefined}
                onClick={onNavigate}
              >
                {item.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Shared page shell: sticky blurred header, optional breadcrumbs, hero title, footer. */
export function Page({ title, subtitle, breadcrumb, children }: PageProps): JSX.Element {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const mainColRef = useRef<HTMLDivElement>(null);

  /**
   * Close the mobile nav drawer.
   */
  const closeMenu = useCallback((): void => {
    setMenuOpen(false);
  }, []);

  // Close the drawer on route change.
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
    backgroundRefs: [sidebarRef, mainColRef],
    onClose: closeMenu
  });

  return (
    <div className="ra-shell" style={shell}>
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; overflow-x: hidden; font-size: 16px; }

        /* Theme-aware logo: dark lockup on dark, transparent light lockup on light. */
        .ra-logo-dark { display: block; }
        .ra-logo-light { display: none; }
        :root[data-theme='light'] .ra-logo-dark { display: none; }
        :root[data-theme='light'] .ra-logo-light { display: block; }
        @media (prefers-color-scheme: light) {
          :root:not([data-theme]) .ra-logo-dark { display: none; }
          :root:not([data-theme]) .ra-logo-light { display: block; }
        }

        .ra-shell {
          --ra-sidebar-w: ${SIDEBAR_WIDTH}px;
        }

        .ra-side-list {
          list-style: none;
          margin: 0;
          padding: ${theme.space.md}px ${theme.space.sm}px;
          display: flex;
          flex-direction: column;
          gap: ${theme.space.xs}px;
        }

        .ra-side-link {
          display: flex;
          align-items: center;
          min-height: 44px;
          padding: ${theme.space.sm}px ${theme.space.md}px;
          border-radius: ${theme.radius.sm}px;
          color: ${theme.color.muted};
          text-decoration: none;
          font-size: ${theme.type.scale[1]}px;
          font-weight: 500;
          font-family: ${theme.type.family};
          border: 1px solid transparent;
          transition: color 0.15s ease, background 0.15s ease, border-color 0.15s ease;
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
          color: ${theme.color.accent};
          font-weight: 600;
          background: color-mix(in srgb, ${theme.color.accent} 10%, ${theme.color.surface});
          border-color: color-mix(in srgb, ${theme.color.accent} 25%, ${theme.color.border});
        }

        /* Desktop left rail — persistent, does not overlap sticky header */
        .ra-sidebar {
          display: none;
        }

        .ra-menu-btn { display: none; }

        /* Mobile drawer (default: closed) */
        .ra-drawer-backdrop {
          display: none;
        }
        .ra-drawer {
          display: none;
        }

        .ra-main-column {
          display: flex;
          flex-direction: column;
          min-height: 100vh;
          min-width: 0;
          width: 100%;
        }

        @media (min-width: 1024px) {
          .ra-shell {
            display: grid !important;
            grid-template-columns: var(--ra-sidebar-w) minmax(0, 1fr);
            min-height: 100vh;
          }
          .ra-sidebar {
            display: flex;
            flex-direction: column;
            position: sticky;
            top: 0;
            align-self: start;
            height: 100vh;
            width: var(--ra-sidebar-w);
            border-right: 1px solid ${theme.color.border};
            background: color-mix(in srgb, ${theme.color.surface} 92%, ${theme.color.bg});
            overflow-y: auto;
            z-index: 20;
          }
          .ra-sidebar-brand {
            display: flex;
            align-items: center;
            min-height: ${LOGO_HEIGHT + theme.space.md}px;
            padding: ${theme.space.sm}px ${theme.space.md}px;
            border-bottom: 1px solid ${theme.color.border};
          }
          .ra-header-logo { display: none !important; }
          .ra-menu-btn { display: none !important; }
          .ra-header-inner {
            min-height: 56px !important;
          }
        }

        @media (max-width: 1023px) {
          .ra-menu-btn { display: inline-flex !important; }
          .ra-drawer-backdrop[data-open="true"] {
            display: block;
            position: fixed;
            inset: 0;
            background: color-mix(in srgb, ${theme.color.bg} 55%, transparent);
            z-index: 40;
          }
          .ra-drawer[data-open="true"] {
            display: flex;
            flex-direction: column;
            position: fixed;
            top: 0;
            left: 0;
            bottom: 0;
            width: min(var(--ra-sidebar-w), 86vw);
            max-width: 100%;
            background: ${theme.color.surface};
            border-right: 1px solid ${theme.color.border};
            box-shadow: ${theme.color.shadow};
            z-index: 50;
            overflow-y: auto;
          }
          .ra-drawer-brand {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: ${theme.space.sm}px;
            min-height: 56px;
            padding: ${theme.space.sm}px ${theme.space.md}px;
            border-bottom: 1px solid ${theme.color.border};
          }
        }

        @media (max-width: 560px) {
          .ra-h1 { font-size: 1.9rem !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          .ra-side-link { transition: none; }
        }
      `}</style>

      {/* Desktop persistent rail */}
      <aside ref={sidebarRef} className="ra-sidebar" aria-label={en.app.primaryNav}>
        <div className="ra-sidebar-brand">
          <Logo height={56} />
        </div>
        <SideNav pathname={location.pathname} ariaLabel={en.app.primaryNav} />
      </aside>

      <div ref={mainColRef} className="ra-main-column">
        <header style={bar}>
          <div
            className="ra-header-inner"
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
            <div className="ra-header-logo">
              <Logo />
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: theme.space.sm,
                flexShrink: 0,
                marginLeft: 'auto'
              }}
            >
              <ThemeToggle />
              <button
                ref={menuBtnRef}
                type="button"
                className="ra-menu-btn"
                style={iconButton}
                aria-expanded={menuOpen}
                aria-controls="ra-mobile-drawer"
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

        <main style={{ ...container, flex: 1, padding: `${theme.space.xl}px ${theme.space.lg}px` }}>
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
                ...container,
                padding: `${theme.space.md}px ${theme.space.lg}px`,
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: theme.space.sm
              }}
            >
              <small style={{ color: theme.color.muted }}>
                © {new Date().getFullYear()} {en.app.name}
              </small>
            </div>
          </div>
        </footer>
      </div>

      {/* Mobile drawer + backdrop */}
      <div
        className="ra-drawer-backdrop"
        data-open={menuOpen ? 'true' : 'false'}
        aria-hidden="true"
        onClick={closeMenu}
      />
      <aside
        ref={drawerRef}
        id="ra-mobile-drawer"
        className="ra-drawer"
        data-open={menuOpen ? 'true' : 'false'}
        aria-hidden={!menuOpen}
        hidden={!menuOpen}
        tabIndex={-1}
      >
        <div className="ra-drawer-brand">
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
        <SideNav
          pathname={location.pathname}
          ariaLabel={en.app.primaryNav}
          onNavigate={closeMenu}
        />
      </aside>
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
