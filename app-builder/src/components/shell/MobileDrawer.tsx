/**
 * Thin wrapper: supplies app-builder nav, logo, and labels to the shared drawer.
 */
import { useLocation } from 'react-router-dom';
import { MobileDrawer as SharedMobileDrawer } from '../../../../design-system/MobileDrawer';
import type { PageDrawerProps } from '../../../../design-system/Page';
import { en } from '../../i18n/en';
import { DRAWER_LOGO_HEIGHT } from './constants';
import { Logo } from './Logo';
import { drawerNavItems, isNavActive } from './NavLinks';
import { iconButtonStyle } from './styles';

/**
 * Mobile side drawer with backdrop: brand, close control, and overflow nav.
 */
export function MobileDrawer({
  open,
  drawerRef,
  closeBtnRef,
  onClose
}: PageDrawerProps): JSX.Element {
  const location = useLocation();
  return (
    <SharedMobileDrawer
      open={open}
      drawerRef={drawerRef}
      closeBtnRef={closeBtnRef}
      onClose={onClose}
      logo={<Logo height={DRAWER_LOGO_HEIGHT} />}
      items={drawerNavItems()}
      isActive={(key) => isNavActive(location.pathname, key)}
      navLabel={en.app.primaryNav}
      closeLabel={en.app.menuClose}
      iconButtonStyle={iconButtonStyle}
    />
  );
}
