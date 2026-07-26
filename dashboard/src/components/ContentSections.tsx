import type { CSSProperties } from 'react';
import { linkifyText } from '../lib/linkify';
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

// Width lives in `.ra-prose-lead` / `.ra-prose-cols`, not here. These were
// inline 40rem caps, which no media query can lift, and they held every
// dashboard content page to 33% of a 1920 viewport. The app-builder side had
// already moved to the shared prose classes; this file had not, and the width
// check could not see it because it was measuring the container.
const introStyle: CSSProperties = {
  color: theme.color.text,
  fontSize: theme.type.scale[2],
  lineHeight: 1.6,
  margin: 0
};

const updatedStyle: CSSProperties = {
  color: theme.color.muted,
  // 16px: fe-type-floor is a blocker with a 16px body floor. Broadening the
  // design audit from `/` to every route is what surfaced this — measuring one
  // page hid a 14px line on four others.
  fontSize: theme.type.scale[2],
  margin: `${theme.space.sm}px 0 0`
};

const sectionStyle: CSSProperties = {
  marginTop: theme.space.xl
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
  fontSize: theme.type.scale[2],
  lineHeight: 1.6,
  margin: 0
};

/**
 * Renders a content page body: intro, optional updated line, then h2/p sections.
 * Bare URLs in body copy become real anchors. The page shell still owns the single h1.
 */
export function ContentSections({ intro, updated, sections }: ContentSectionsProps): JSX.Element {
  return (
    <>
      <p className="ra-prose-lead" style={introStyle}>
        {intro}
      </p>
      {updated !== undefined && <p style={updatedStyle}>{updated}</p>}
      <div className="ra-prose-cols">
        {sections.map((section) => (
          <section key={section.heading} style={sectionStyle}>
            <h2 style={headingStyle}>{section.heading}</h2>
            <p style={bodyStyle}>{linkifyText(section.body)}</p>
          </section>
        ))}
      </div>
    </>
  );
}
