import { en } from '../../i18n/en';
import { theme } from '../../theme';
import { FidelityWarning } from '../FidelityWarning';
import { StackReferences } from '../StackReferences';
import { cardStyle } from '../ui';
import { prdCreatedAtStyle, prdMarkdownStyle, prdReadyStyle } from './styles';

/** Full PRD row from GET /api/prd/:id. */
export interface SavedPrdRow {
  id: string;
  slug: string;
  title: string;
  prompt: string;
  markdown: string;
  created_at: string;
}

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
 * One loaded saved PRD: ready badge, saved date, fidelity warning, the
 * markdown, and the stack documentation it references.
 *
 * @param props.prd - The loaded row.
 * @returns The PRD section.
 */
export function SavedPrdView({ prd }: { prd: SavedPrdRow }): JSX.Element {
  const copy = en.pages.savedPrd;
  return (
    <section aria-label={prd.title}>
      <p style={prdReadyStyle}>
        <span aria-hidden="true">✓ </span>
        {copy.readyBadge}
      </p>
      <p style={prdCreatedAtStyle}>{copy.createdAt(formatCreatedAt(prd.created_at))}</p>
      <FidelityWarning markdown={prd.markdown} />
      <div style={cardStyle(theme.space.md)}>
        <pre style={prdMarkdownStyle}>{prd.markdown}</pre>
      </div>
      <StackReferences markdown={prd.markdown} />
    </section>
  );
}
