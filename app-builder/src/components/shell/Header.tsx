import type { RefObject } from 'react';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { ThemeToggle } from '../ThemeToggle';
import { LOGO_HEIGHT } from './constants';
import { Logo } from './Logo';
import { headerNavItems, NavLink } from './NavLinks';
import { barStyle, iconButtonStyle } from './styles';

export interface HeaderProps {
  /** Whether the mobile drawer is open. */
  menuOpen: boolean;
  /** Ref for the sticky header landmark (drawer a11y background). */
  headerRef: RefObject<HTMLElement>;
  /** Ref for the menu open/close control (drawer a11y trigger). */
  menuBtnRef: RefObject<HTMLButtonElement>;
  /** Toggle the mobile nav drawer. */
  onToggleMenu: () => void;
}

/**
 * Sticky site header: brand lockup, desktop primary nav, theme toggle, menu button.
 */
export function Header({
  menuOpen,
  headerRef,
  menuBtnRef,
  onToggleMenu
}: HeaderProps): JSX.Element {
  const topNavItems = headerNavItems();

  return (
    <header ref={headerRef} style={barStyle}>
      <div
        style={{
          width: '100%',
          maxWidth: theme.layout.contentMaxWidth,
          margin: '0 auto',
          padding: `0 ${theme.space.md}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: theme.space.sm,
          minHeight: LOGO_HEIGHT + theme.space.md,
          boxSizing: 'border-box'
        }}
      >
        <Logo />
        <nav className="ra-top-nav" aria-label={en.app.primaryNav}>
          {topNavItems.map((item) => (
            <NavLink key={item.key} item={item} />
          ))}
        </nav>
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
            style={iconButtonStyle}
            aria-expanded={menuOpen}
            aria-controls="ra-side-drawer"
            aria-label={menuOpen ? en.app.menuClose : en.app.menuOpen}
            onClick={onToggleMenu}
          >
            <span aria-hidden="true">{menuOpen ? '✕' : '☰'}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
