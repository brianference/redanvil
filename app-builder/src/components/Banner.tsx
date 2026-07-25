import type { CSSProperties } from 'react';
import { errorBannerStyle, statusBannerStyle } from './ui';

/**
 * Live-region banner announcing that something is in flight.
 *
 * The markup matters as much as the copy: `role="status"` with
 * `aria-live="polite"` and `aria-busy` is what makes a screen reader announce
 * the wait without stealing focus, and the glyph is `aria-hidden` so it is not
 * read out as punctuation. That combination was copy-pasted into the PRD result
 * and the saved-PRD page, where it could have drifted apart silently.
 *
 * @param props.message - Copy from the locale bundle describing the wait.
 * @returns The polite status banner.
 */
export function LoadingBanner({ message }: { message: string }): JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={statusBannerStyle()}>
      <span aria-hidden="true">…</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Assertive banner for a failure the user has to see.
 *
 * @param props.message - Already-resolved error copy.
 * @param props.style - Optional extra style merged over the banner (spacing only).
 * @returns The alert banner.
 */
export function ErrorBanner({
  message,
  style
}: {
  message: string;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div role="alert" style={{ ...errorBannerStyle(), ...style }}>
      <span aria-hidden="true">!</span>
      <span>{message}</span>
    </div>
  );
}
