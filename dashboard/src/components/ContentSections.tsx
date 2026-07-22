import type { CSSProperties } from 'react';
import { theme } from '../theme';

/** One labeled body block under a content-page intro. */
export interface ContentSection {
  heading: string;
  body: string;
}

export interface ContentSectionsProps {
  /** Lead paragraph under the page h1. */
  intro: string;
  /** Optional line such as a last-updated date. */
  updated?: string;
  /** Short sections, each rendered as h2 + p. */
  sections: readonly ContentSection[];
}

const introStyle: CSSProperties = {
  color: theme.color.text,
  fontSize: theme.type.scale[2],
  lineHeight: 1.6,
  maxWidth: '40rem',
  margin: 0
};

const updatedStyle: CSSProperties = {
  color: theme.color.muted,
  fontSize: theme.type.scale[0],
  margin: `${theme.space.sm}px 0 0`
};

const sectionStyle: CSSProperties = {
  marginTop: theme.space.xl,
  maxWidth: '40rem'
};

const headingStyle: CSSProperties = {
  color: theme.color.text,
  fontSize: theme.type.scale[3],
  fontWeight: 600,
  letterSpacing: '-0.01em',
  margin: `0 0 ${theme.space.sm}px`
};

const bodyStyle: CSSProperties = {
  color: theme.color.muted,
  fontSize: theme.type.scale[1],
  lineHeight: 1.6,
  margin: 0
};

/**
 * Renders a content page body: intro, optional updated line, then h2/p sections.
 * The page shell still owns the single h1.
 */
export function ContentSections({ intro, updated, sections }: ContentSectionsProps): JSX.Element {
  return (
    <>
      <p style={introStyle}>{intro}</p>
      {updated !== undefined && <p style={updatedStyle}>{updated}</p>}
      {sections.map((section) => (
        <section key={section.heading} style={sectionStyle}>
          <h2 style={headingStyle}>{section.heading}</h2>
          <p style={bodyStyle}>{section.body}</p>
        </section>
      ))}
    </>
  );
}
