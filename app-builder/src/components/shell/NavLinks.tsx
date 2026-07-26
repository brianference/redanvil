/**
 * App-builder nav items and active-route rules.
 *
 * Shared `NavLink` markup lives in design-system; this file owns product IA
 * (Builder / Dashboard / Saved / About / Contact) and which path is current.
 */
import { useLocation } from 'react-router-dom';
import { NavLink as SharedNavLink, type NavItem } from '../../../../design-system/NavLink';
import { en } from '../../i18n/en';
import { DASHBOARD_URL, GITHUB_URL } from './constants';

export type { NavItem };

/**
 * Whether a primary nav item is the current page (for active styles).
 *
 * @param pathname - Current router pathname.
 * @param key - Nav item key.
 * @returns True when the item matches the current route.
 */
export function isNavActive(pathname: string, key: string): boolean {
  if (key === 'builder') return pathname === '/';
  if (key === 'saved') return pathname === '/saved' || pathname.startsWith('/prd/');
  if (key === 'about') return pathname === '/about';
  if (key === 'contact') return pathname === '/contact';
  return false;
}

/**
 * Desktop header primary links (brand mark stays separate). GitHub lives in the
 * mobile overflow drawer and footer so the top bar stays scannable.
 *
 * @returns Ordered primary nav items for the sticky header.
 */
export function headerNavItems(): NavItem[] {
  return [
    { key: 'builder', label: en.app.navBuilder, to: '/' },
    { key: 'dashboard', label: en.app.navDashboard, to: null, href: DASHBOARD_URL },
    { key: 'saved', label: en.app.navSaved, to: '/saved' },
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
 * One primary nav link with app-builder active-route rules.
 */
export function NavLink({ item, onNavigate }: NavLinkProps): JSX.Element {
  const location = useLocation();
  return (
    <SharedNavLink
      item={item}
      active={isNavActive(location.pathname, item.key)}
      onNavigate={onNavigate}
    />
  );
}
