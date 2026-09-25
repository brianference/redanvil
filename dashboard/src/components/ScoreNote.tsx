import type { CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';

/**
 * Muted and small on purpose: it explains the zeros without competing with the
 * numbers themselves, and it sits above the list so it is read before the FAIL
 * badges rather than after them.
 */
const scoreNoteStyle: CSSProperties = {
  margin: `0 0 ${theme.space.md}px`,
  // The 60ch measure lives on .ra-score-note in theme.css: an inline maxWidth
  // beats every class, so a media query could never lift it.
  fontSize: theme.type.scale[2],
  lineHeight: 1.55,
  color: theme.color.muted
};

/**
 * Context line under the KPI strip: what a score of 0 means.
 *
 * @returns The note paragraph.
 */
export function ScoreNote(): JSX.Element {
  return (
    <p className="ra-score-note" style={scoreNoteStyle}>
      {en.pages.home.scoreNote}
    </p>
  );
}
