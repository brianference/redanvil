/**
 * Thin wrapper: supplies this app's href, alt text, and default height.
 */
import { createLogo } from '../../../../design-system/Logo';
import { en } from '../../i18n/en';
import { APP_URL, LOGO_HEIGHT } from './constants';

/** Site logo bound to app-builder home URL and i18n alt text. */
export const Logo = createLogo({
  href: APP_URL,
  ariaLabel: en.app.logoAlt,
  defaultHeight: LOGO_HEIGHT
});
