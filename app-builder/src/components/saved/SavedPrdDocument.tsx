import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import type { SavedPrdRow } from '../../lib/savedList';
import { theme } from '../../theme';
import { FidelityWarning } from '../FidelityWarning';
import { StackReferences } from '../StackReferences';
import { cardStyle } from '../ui';

/**
 * Format an ISO date for display; fall back to the raw string if unparseable.
 *
 * @param iso - ISO-8601 timestamp string.
 * @returns Locale display string or the original value.
 */
function formatCreatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString();
}

/**
 * One loaded PRD: ready badge, save time, fidelity warning, the document, and
 * links to the docs for the stack it prescribes. Layout width comes from
 * `.ra-content-col`, so nothing here caps it.
 *
 * @param props.prd - The saved PRD row.
 */
export function SavedPrdDocument({ prd }: { prd: SavedPrdRow }): JSX.Element {
  const copy = en.pages.savedPrd;
  return (
    <section aria-label={prd.title}>
      <p style={readyStyle}>
        <span aria-hidden="true">✓ </span>
        {copy.readyBadge}
      </p>
      <p style={createdStyle}>{copy.createdAt(formatCreatedAt(prd.created_at))}</p>
      <FidelityWarning markdown={prd.markdown} />
      <div style={cardStyle(theme.space.md)}>
        <pre style={preStyle}>{prd.markdown}</pre>
      </div>
      <StackReferences markdown={prd.markdown} />
    </section>
  );
}

const readyStyle: CSSProperties = {
  margin: 0,
  color: theme.color.accent,
  fontSize: theme.type.scale[0],
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase'
};

const createdStyle: CSSProperties = {
  margin: 0,
  color: theme.color.muted,
  fontSize: theme.type.scale[1]
};

const preStyle: CSSProperties = {
  margin: 0,
  maxHeight: '28rem',
  overflow: 'auto',
  background: theme.color.bg,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.md,
  padding: theme.space.md,
  fontSize: theme.type.scale[1],
  lineHeight: 1.6,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-word',
  color: theme.color.text
};
