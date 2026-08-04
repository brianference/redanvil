/**
 * Shared with every RedAnvil app.
 *
 * Sticky header layout is identical; apps pass brand, nav items, theme toggle,
 * labels, and chrome tokens so each product keeps its own IA and palette.
 */
import React, { type CSSProperties, type ReactNode, type RefObject } from 'react';
import { NavLink, type NavItem } from './NavLink';

export interface HeaderTokens {
  /** Max width of the header content row. */
  contentMaxWidth: string;
  /** Horizontal padding, px. */
  paddingX: number;
  /** Gap between header clusters, px. */
  gap: number;
  /** Gap inside the controls cluster, px. */
  controlsGap: number;
  /** Minimum header row height, px. */
  minHeight: number;
}

export interface HeaderCopy {
  /** Accessible name for the primary nav landmark. */
  primaryNav: string;
  /** Aria label when the menu is open (close action). */
  menuClose: string;
  /** Aria label when the menu is closed (open action). */
  menuOpen: string;
}

export interface HeaderProps {
  /** Whether the mobile drawer is open. */
  menuOpen: boolean;
  /** Ref for the sticky header landmark (drawer a11y background). */
  headerRef: RefObject<HTMLElement>;
  /** Ref for the menu open/close control (drawer a11y trigger). */
  menuBtnRef: RefObject<HTMLButtonElement>;
  /** Toggle the mobile nav drawer. */
  onToggleMenu: () => void;
  /** Sticky bar chrome. */
  barStyle: CSSProperties;
  /** Icon button chrome for the menu control. */
  iconButtonStyle: CSSProperties;
  /** Layout metrics. */
  tokens: HeaderTokens;
  /** App labels. */
  copy: HeaderCopy;
  /** Brand lockup. */
  logo: ReactNode;
  /** Theme toggle control. */
  themeToggle: ReactNode;
  /** Desktop primary nav items. */
  items: readonly NavItem[];
  /** Whether a given item key is the current page. */
  isActive: (key: string) => boolean;
  /**
   * Optional qa-visual test id on the sticky header landmark
   * (e.g. "compact-header"). Omitted when the app does not instrument.
   */
  testId?: string;
  /**
   * Optional qa-visual data-measure on the sticky header
   * (e.g. "header"). Omitted when the app does not instrument.
   */
  measure?: string;
}

/**
 * Sticky site header: brand lockup, desktop primary nav, theme toggle, menu button.
 */
export function Header({
  menuOpen,
  headerRef,
  menuBtnRef,
  onToggleMenu,
  barStyle,
  iconButtonStyle,
  tokens,
  copy,
  logo,
  themeToggle,
  items,
  isActive,
  testId,
  measure
}: HeaderProps): JSX.Element {
  return (
    <header
      ref={headerRef}
      style={barStyle}
      {...(testId !== undefined ? { 'data-testid': testId } : {})}
      {...(measure !== undefined ? { 'data-measure': measure } : {})}
    >
      <div
        style={{
          width: '100%',
          maxWidth: tokens.contentMaxWidth,
          margin: '0 auto',
          padding: `0 ${tokens.paddingX}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: tokens.gap,
          minHeight: tokens.minHeight,
          boxSizing: 'border-box'
        }}
      >
        {logo}
        <nav className="ra-top-nav" aria-label={copy.primaryNav}>
          {items.map((item) => (
            <NavLink key={item.key} item={item} active={isActive(item.key)} />
          ))}
        </nav>
        <div
          className="ra-header-controls"
          data-drawer-open={menuOpen ? 'true' : 'false'}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: tokens.controlsGap,
            flexShrink: 0
          }}
        >
          {themeToggle}
          <button
            ref={menuBtnRef}
            type="button"
            className="ra-menu-btn"
            style={iconButtonStyle}
            aria-expanded={menuOpen}
            aria-controls="ra-side-drawer"
            aria-label={menuOpen ? copy.menuClose : copy.menuOpen}
            onClick={onToggleMenu}
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
