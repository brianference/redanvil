import type { CSSProperties } from 'react';
import { SafeExternalLink } from '../../../design-system/SafeExternalLink';
import { en } from '../i18n/en';
import { stackReferencesFor } from '../lib/prd/stackReferences';
import { theme } from '../theme';
import { cardStyle } from './ui';

/**
 * Links a saved PRD to the official docs for the stack it prescribes.
 *
 * @param props.markdown - Saved PRD markdown.
 * @returns The reference list, or null when the PRD names no known technology.
 */
export function StackReferences({ markdown }: { markdown: string }): JSX.Element | null {
  const references = stackReferencesFor(markdown);
  if (references.length === 0) return null;
  const copy = en.pages.savedPrd;
  return (
    <section aria-labelledby="stack-references-heading" style={cardStyle(theme.space.md)}>
      <h2 id="stack-references-heading" style={headingStyle}>
        {copy.referencesHeading}
      </h2>
      <p style={introStyle}>{copy.referencesIntro}</p>
      <ul style={listStyle}>
        {references.map((ref) => (
          <li key={ref.url}>
            <SafeExternalLink
              href={ref.url}
              aria-label={`${ref.name} ${copy.referenceOpensNewTab}`}
              style={linkStyle}
            >
              {ref.name}
            </SafeExternalLink>
          </li>
        ))}
      </ul>
    </section>
  );
}

const headingStyle: CSSProperties = {
  margin: 0,
  fontSize: theme.type.scale[3],
  color: theme.color.text
};

const introStyle: CSSProperties = {
  margin: `${theme.space.xs}px 0 ${theme.space.sm}px`,
  color: theme.color.muted,
  fontSize: theme.type.scale[2]
};

const listStyle: CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.space.xs,
  listStyle: 'none',
  margin: 0,
  padding: 0
};

const linkStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: theme.touch,
  padding: `0 ${theme.space.sm}px`,
  border: `1px solid ${theme.color.border}`,
  borderRadius: theme.radius.pill,
  color: theme.color.accentFg,
  fontSize: theme.type.scale[2],
  fontWeight: 600,
  textDecoration: 'underline',
  textUnderlineOffset: 3
};
