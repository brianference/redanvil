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

/**
 * Pass/fail marker using icon + text (not color alone) for non-color state.
 * Pass uses ✓; Fail uses ! (matches approved run-list mockup).
 */
export function StatusBadge({ passed, score, threshold }: StatusBadgeProps): JSX.Element {
  const label = passed ? en.status.pass : en.status.fail;
  const icon = passed ? '✓' : '!';
  const aria =
    score !== undefined && threshold !== undefined
      ? en.status.badgeAria(label, score, threshold)
      : label;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space.xs,
    padding: `${theme.space.xs}px ${theme.space.sm}px`,
    borderRadius: 999,
    fontSize: theme.type.scale[0],
    fontWeight: 700,
    letterSpacing: '0.03em',
    textTransform: 'uppercase',
    color: passed ? theme.color.success : theme.color.error,
    background: passed ? theme.color.successSoft : theme.color.errorSoft,
    border: 'none',
    fontFamily: theme.type.family,
    lineHeight: 1.3,
    whiteSpace: 'nowrap',
    flexShrink: 0
  };

  return (
    <span style={style} aria-label={aria}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
