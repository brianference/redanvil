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
 */
export function StatusBadge({ passed, score, threshold }: StatusBadgeProps): JSX.Element {
  const label = passed ? en.status.pass : en.status.fail;
  const icon = passed ? '✓' : '✗';
  const aria =
    score !== undefined && threshold !== undefined
      ? en.status.badgeAria(label, score, threshold)
      : label;

  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.space.xs,
    padding: `${theme.space.xs}px ${theme.space.sm}px`,
    borderRadius: theme.radius.sm,
    fontSize: theme.type.scale[0],
    fontWeight: 600,
    color: theme.color.text,
    background: theme.color.surface,
    border: `1px solid ${theme.color.border}`,
    fontFamily: theme.type.family,
    lineHeight: 1.2,
    whiteSpace: 'nowrap'
  };

  return (
    <span style={style} aria-label={aria}>
      <span aria-hidden="true">{icon}</span>
      <span>{label}</span>
    </span>
  );
}
