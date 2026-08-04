/**
 * Thin wrapper: supplies this app's href, alt text, and default height.
 */
import { Logo as SharedLogo } from '../../../../design-system/Logo';
import { en } from '../../i18n/en';
import { APP_URL, LOGO_HEIGHT } from './constants';

export interface LogoProps {
  /** Lockup height in pixels. */
  height?: number;
  /**
   * Tag this instance as the measurable brand mark for qa-visual.
   *
   * Opt-in per call site on purpose. This wrapper renders in the header, the
   * footer and the mobile drawer, so marking every instance made
   * `[data-measure="mark"]` resolve to three elements and the harness hung
   * waiting on it. Exactly one instance — the header lockup — is the brand
   * mark being measured.
   */
  measurable?: boolean;
}

/**
 * Site logo: single transparent lockup for both themes (no theme-swap, no grey box).
 */
export function Logo({ height = LOGO_HEIGHT, measurable = false }: LogoProps): JSX.Element {
  return (
    <SharedLogo
      href={APP_URL}
      ariaLabel={en.app.logoAlt}
      height={height}
      {...(measurable ? { markMeasure: 'mark' } : {})}
    />
  );
}
