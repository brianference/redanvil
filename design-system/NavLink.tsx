/**
 * Shared with every RedAnvil app.
 *
 * One primary nav link (internal SPA Link or external anchor). Active-route
 * logic is app-specific (different keys and path rules), so the caller passes
 * `active` rather than embedding either app's `isNavActive`.
 */
import React from 'react';
import { Link } from 'react-router-dom';

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

export interface NavLinkProps {
  /** Nav item to render. */
  item: NavItem;
  /** Whether this item matches the current route. */
  active: boolean;
  /** Optional navigate handler (e.g. close mobile drawer). */
  onNavigate?: () => void;
}

/**
 * One primary nav link (internal SPA Link or external anchor).
 * Sets `aria-current="page"` on the active internal route.
 */
export function NavLink({ item, active, onNavigate }: NavLinkProps): JSX.Element {
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

/**
 * Append a GitHub overflow item to primary header nav for the mobile drawer.
 *
 * Both RedAnvil shells keep GitHub out of the sticky bar and in the drawer.
 *
 * @param items - Primary header nav items.
 * @param label - Localised GitHub link label.
 * @param href - Absolute GitHub repository URL.
 * @returns Primary items plus the external GitHub entry.
 */
export function withGithubNav(
  items: readonly NavItem[],
  label: string,
  href: string
): NavItem[] {
  return [
    ...items,
    { key: 'github', label, to: null, href, external: true }
  ];
}
