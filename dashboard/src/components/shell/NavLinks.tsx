import { Link, useLocation } from 'react-router-dom';
import { en } from '../../i18n/en';
import { APP_URL, GITHUB_URL } from './constants';

/** Primary nav item used in the header / mobile drawer. */
export interface NavItem {
  key: string;
  label: string;
  /** Internal SPA path, or null when the item is external. */
  to: string | null;
  /** External absolute URL when `to` is null. */
  href?: string;
  /** Open in a new tab (external only). */
  external?: boolean;
}

/**
 * Whether a primary nav item is the current page (for active styles).
 *
 * @param pathname - Current router pathname.
 * @param key - Nav item key.
 * @returns True when the item matches the current route.
 */
export function isNavActive(pathname: string, key: string): boolean {
  if (key === 'runs') return pathname === '/' || pathname.startsWith('/run/');
  if (key === 'about') return pathname === '/about';
  if (key === 'contact') return pathname === '/contact';
  return false;
}

/**
 * Desktop header primary links (brand mark stays separate). GitHub lives in the
 * mobile overflow drawer and footer so the top bar stays scannable.
 *
 * Labels match the product IA: App Builder (sibling), Dashboard home (Runs),
 * About, Contact — Saved is app-builder only.
 *
 * @returns Ordered primary nav items for the sticky header.
 */
export function headerNavItems(): NavItem[] {
  return [
    { key: 'builder', label: en.app.navBuilder, to: null, href: APP_URL },
    { key: 'runs', label: en.app.navRuns, to: '/' },
    { key: 'about', label: en.app.navAbout, to: '/about' },
    { key: 'contact', label: en.app.navContact, to: '/contact' }
  ];
}

/**
 * Mobile drawer list: primary routes plus secondary overflow (GitHub).
 *
 * @returns Ordered nav items for the mobile drawer.
 */
export function drawerNavItems(): NavItem[] {
  return [
    ...headerNavItems(),
    { key: 'github', label: en.app.navGitHub, to: null, href: GITHUB_URL, external: true }
  ];
}

export interface NavLinkProps {
  /** Nav item to render. */
  item: NavItem;
  /** Optional navigate handler (e.g. close mobile drawer). */
  onNavigate?: () => void;
}

/**
 * One primary nav link (internal SPA Link or external anchor).
 * Sets `aria-current="page"` on the active internal route.
 */
export function NavLink({ item, onNavigate }: NavLinkProps): JSX.Element {
  const location = useLocation();
  const active = isNavActive(location.pathname, item.key);
  const className = `ra-nav-link${active ? ' is-active' : ''}`;

  if (item.to !== null) {
    return (
      <Link
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
