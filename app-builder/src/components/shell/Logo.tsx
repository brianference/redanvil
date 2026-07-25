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
  return (
    <a
      href={APP_URL}
      aria-label={en.app.logoAlt}
      style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
    >
      {/* Two transparent lockups, one per theme. The single-image version was
          illegible in dark: the wordmark measured ~2:1 against the header. CSS
          classes own visibility — never an inline `display`, which beats the
          class rule and silently breaks the swap.

          Both images are decorative and the LINK carries the accessible name.
          Naming them individually left the anchor nameless in dark, because the
          only visible image there was aria-hidden — axe flagged it as a serious
          link-name violation on both sites. */}
      <img
        className="ra-logo-light"
        src="/logo-lockup.png"
        alt=""
        height={height}
        style={{ height, width: 'auto', maxWidth: 'min(58vw, 260px)', objectFit: 'contain' }}
      />
      <img
        className="ra-logo-dark"
        src="/logo-lockup-dark.png"
        alt=""
        aria-hidden="true"
        height={height}
        style={{ height, width: 'auto', maxWidth: 'min(58vw, 260px)', objectFit: 'contain' }}
      />
    </a>
  );
}
