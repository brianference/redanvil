import type { CSSProperties, ReactNode } from 'react';
import { errorBannerStyle, statusBannerStyle } from './ui';

/**
 * Live-region banner announcing that something is in flight.
 *
 * The markup matters as much as the copy: `role="status"` with
 * `aria-live="polite"` and `aria-busy` is what makes a screen reader announce
 * the wait without stealing focus, and the glyph is `aria-hidden` so it is not
 * read out as punctuation. Every loading state uses this one component so that
 * combination cannot drift between screens.
 *
 * @param props.message - Copy from the locale bundle describing the wait.
 * @param props.style - Optional extra style merged over the banner (spacing only).
 * @returns The polite status banner.
 */
export function LoadingBanner({
  message,
  style
}: {
  message: string;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div role="status" aria-live="polite" aria-busy="true" style={{ ...statusBannerStyle(), ...style }}>
      <span aria-hidden="true">…</span>
      <span>{message}</span>
    </div>
  );
}

/**
 * Polite banner confirming that something finished.
 *
 * @param props.children - What finished, and any link to it.
 * @param props.style - Optional extra style merged over the banner (spacing only).
 * @returns The success status banner.
 */
export function SuccessBanner({
  children,
  style
}: {
  children: ReactNode;
  style?: CSSProperties;
}): JSX.Element {
  return (
    <div role="status" aria-live="polite" style={{ ...statusBannerStyle(), ...style }}>
      <span aria-hidden="true">✓</span>
      {children}
    </div>
  );
}

/**
 * Assertive banner for a failure the user has to see, with an optional way
 * out (such as Retry) under the message.
 *
 * @param props.message - Already-resolved error copy.
 * @param props.style - Optional extra style merged over the banner (spacing only).
 * @param props.children - Optional recovery action shown under the message.
 * @returns The alert banner.
 */
export function ErrorBanner({
  message,
  style,
  children
}: {
  message: string;
  style?: CSSProperties;
  children?: ReactNode;
}): JSX.Element {
  return (
    <div role="alert" style={{ ...errorBannerStyle(), ...style }}>
      <span aria-hidden="true">!</span>
      {children === undefined ? (
        <span>{message}</span>
      ) : (
        <div style={actionBodyStyle}>
          <p style={actionMessageStyle}>{message}</p>
          {children}
        </div>
      )}
    </div>
  );
}

/** Message and action column; shrinks so a long message wraps beside the glyph. */
const actionBodyStyle: CSSProperties = { flex: 1, minWidth: 0 };

const actionMessageStyle: CSSProperties = { margin: 0 };
