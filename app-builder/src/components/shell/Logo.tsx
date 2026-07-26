/**
 * Thin wrapper: supplies this app's href, alt text, and default height.
 */
import { Logo as SharedLogo } from '../../../../design-system/Logo';
import { en } from '../../i18n/en';
import { APP_URL, LOGO_HEIGHT } from './constants';

export interface LogoProps {
  /** Lockup height in pixels. */
  height?: number;
}

/**
 * Site logo: single transparent lockup for both themes (no theme-swap, no grey box).
 */
export function Logo({ height = LOGO_HEIGHT }: LogoProps): JSX.Element {
  return <SharedLogo href={APP_URL} ariaLabel={en.app.logoAlt} height={height} />;
}
