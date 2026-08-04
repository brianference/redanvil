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

/** Per-app lockup defaults bound by {@link createLogo}. */
export interface AppLogoConfig {
  /** Absolute or relative URL the lockup links to. */
  href: string;
  /** Accessible name for the link (images are decorative). */
  ariaLabel: string;
  /** Default lockup height in pixels (header size). */
  defaultHeight: number;
}

/** Props for an app-bound Logo from {@link createLogo}. */
export interface AppLogoProps {
  /** Lockup height in pixels. Defaults to the app's header height. */
  height?: number;
  /**
   * Tag this instance as the measurable brand mark for qa-visual.
   *
   * Opt-in per call site on purpose. Logo renders in the header, the footer and
   * the mobile drawer, so marking every instance made `[data-measure="mark"]`
   * resolve to three elements and the harness hung waiting on it. Exactly one
   * instance — the header lockup — is the brand mark being measured.
   */
  measurable?: boolean;
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

/**
 * Bind this app's href, alt text, and default height into a thin Logo wrapper.
 *
 * The measurable → markMeasure wiring is shared so apps do not re-copy the
 * qa-visual opt-in. Each app still supplies its own i18n label and home URL.
 *
 * @param config - Per-app lockup defaults.
 * @returns A Logo component with optional height and measurable props.
 */
export function createLogo(config: AppLogoConfig): (props: AppLogoProps) => JSX.Element {
  /**
   * Site logo for this app: single transparent lockup for both themes.
   */
  return function AppLogo({
    height = config.defaultHeight,
    measurable = false
  }: AppLogoProps): JSX.Element {
    return (
      <Logo
        href={config.href}
        ariaLabel={config.ariaLabel}
        height={height}
        {...(measurable ? { markMeasure: 'mark' } : {})}
      />
    );
  };
}
