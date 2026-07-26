/**
 * Thin wrapper: supplies dashboard nav, brand, and chrome to the shared Header.
 */
import type { RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { Header as SharedHeader } from '../../../../design-system/Header';
import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { ThemeToggle } from '../ThemeToggle';
import { LOGO_HEIGHT } from './constants';
import { Logo } from './Logo';
import { headerNavItems, isNavActive } from './NavLinks';
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
  const location = useLocation();
  return (
    <SharedHeader
      menuOpen={menuOpen}
      headerRef={headerRef}
      menuBtnRef={menuBtnRef}
      onToggleMenu={onToggleMenu}
      barStyle={barStyle}
      iconButtonStyle={iconButtonStyle}
      tokens={{
        contentMaxWidth: theme.layout.contentMaxWidth,
        paddingX: theme.space.md,
        gap: theme.space.sm,
        controlsGap: theme.space.sm,
        minHeight: LOGO_HEIGHT + theme.space.md
      }}
      copy={{
        primaryNav: en.app.primaryNav,
        menuClose: en.app.menuClose,
        menuOpen: en.app.menuOpen
      }}
      logo={<Logo />}
      themeToggle={<ThemeToggle />}
      items={headerNavItems()}
      isActive={(key) => isNavActive(location.pathname, key)}
    />
  );
}
