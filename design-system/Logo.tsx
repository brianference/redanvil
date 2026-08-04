/**
 * Shared with every RedAnvil app.
 *
 * The dual lockup (light + dark, CSS-class visibility) is identical; only the
 * home href, accessible name, and default height differ per app.
 */
import React from 'react';

export interface LogoProps {
  /** Absolute or relative URL the lockup links to. */
  href: string;
  /** Accessible name for the link (images are decorative). */
  ariaLabel: string;
  /** Lockup height in pixels. */
  height: number;
  /**
   * Optional qa-visual data-measure on the brand lockup link
   * (e.g. "mark"). Placed on the always-visible anchor so light/dark
   * image swap does not hide the measure target. Omitted when unused.
   */
  markMeasure?: string;
}

/**
 * Site logo: two transparent lockups, one per theme (no grey box).
 * CSS classes own visibility — never an inline `display`.
 */
export function Logo({ href, ariaLabel, height, markMeasure }: LogoProps): JSX.Element {
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      style={{ display: 'flex', alignItems: 'center', textDecoration: 'none', flexShrink: 0 }}
      {...(markMeasure !== undefined ? { 'data-measure': markMeasure } : {})}
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
        style={{ height, width: 'auto', maxWidth: 'min(52vw, 440px)', objectFit: 'contain' }}
      />
      <img
        className="ra-logo-dark"
        src="/logo-lockup-dark.png"
        alt=""
        aria-hidden="true"
        height={height}
        style={{ height, width: 'auto', maxWidth: 'min(52vw, 440px)', objectFit: 'contain' }}
      />
    </a>
  );
}
