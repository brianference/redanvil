import type { CSSProperties, ReactNode } from 'react';
import { theme } from '../theme';

/**
 * The feed states every data page renders: loading, error, partial, and the
 * informational empty / not-found / no-match notes. Home and RunDetail each
 * carried their own copy of this markup; one set keeps the roles and colours
 * the same on both screens.
 */

export interface FeedNoteProps {
  /** Copy from the locale bundle. */
  children: ReactNode;
}

const mutedStyle: CSSProperties = { color: theme.color.muted };

// accentFg, not accent: accent is the fill colour and is not AA as text on the
// dark surface. accentFg is the token defined for accent-coloured text.
const alertStyle: CSSProperties = { color: theme.color.accentFg };

/**
 * The feed is still in flight.
 *
 * @returns A polite, busy status line.
 */
export function LoadingNote({ children }: FeedNoteProps): JSX.Element {
  return (
    <p role="status" aria-live="polite" aria-busy="true" style={mutedStyle}>
      {children}
    </p>
  );
}

/**
 * The feed failed, or part of it could not be read. Announced assertively,
 * because either way the page is not showing everything it should.
 *
 * @returns An alert line.
 */
export function AlertNote({ children }: FeedNoteProps): JSX.Element {
  return (
    <p role="alert" style={alertStyle}>
      {children}
    </p>
  );
}

/**
 * A settled, informational outcome: nothing recorded, nothing matched, no such run.
 *
 * @returns A status line.
 */
export function StatusNote({ children }: FeedNoteProps): JSX.Element {
  return (
    <p role="status" style={mutedStyle}>
      {children}
    </p>
  );
}
