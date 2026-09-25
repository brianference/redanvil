import type { CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';

export interface StatusBadgeProps {
  /** Whether the subject passed the gate (or rule). */
  passed: boolean;
  /** Score and threshold for the run-level aria label; omit for rule-level badges. */
  score?: number;
  threshold?: number;
}

/** Glyph and colour pair for a pass/fail state, shared by the badge and the run-card icon. */
export interface StatusTone {
  icon: string;
  fg: string;
  soft: string;
}

/**
 * The one definition of how pass and fail look.
 *
 * @param passed - Whether the subject passed.
 * @returns Glyph, foreground colour and soft background colour.
 */
export function statusTone(passed: boolean): StatusTone {
  return passed
    ? { icon: '✓', fg: theme.color.success, soft: theme.color.successSoft }
    : { icon: '!', fg: theme.color.error, soft: theme.color.errorSoft };
}

/**
 * Pass/fail marker using icon + text (not color alone) for non-color state.
 * Pass uses ✓; Fail uses ! (matches approved run-list mockup).
 */
export function StatusBadge({ passed, score, threshold }: StatusBadgeProps): JSX.Element {
  const label = passed ? en.status.pass : en.status.fail;
  const tone = statusTone(passed);
  const aria =
    score !== undefined && threshold !== undefined
      ? en.status.badgeAria(label, score, threshold)
      : label;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space.xs,
    padding: `${theme.space.xs}px ${theme.space.sm}px`,
    // lg (20) exceeds half the badge height, so it still renders as a pill.
    borderRadius: theme.radius.lg,
    fontSize: theme.type.scale[1],
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: tone.fg,
    background: tone.soft,
    border: 'none',
    fontFamily: theme.type.family,
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    flexShrink: 0
  };

  return (
    <span style={style} aria-label={aria}>
      <span aria-hidden="true">{tone.icon}</span>
      <span>{label}</span>
    </span>
  );
}
