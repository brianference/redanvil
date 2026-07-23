import { Page } from './Page';
import { linkifyText } from '../lib/linkify';
import { theme } from '../theme';

export interface LegalSection {
  /** Section heading. */
  heading: string;
  /** Section body paragraph. */
  body: string;
}

export interface LegalPageProps {
  /** Page title, rendered as the single h1. */
  title: string;
  /** "Updated ..." line. */
  updated: string;
  /** Intro paragraph. */
  intro: string;
  /** Headed content sections. */
  sections: readonly LegalSection[];
}

/** Renders an informational/legal page: intro, updated date, and headed sections. */
export function LegalPage({ title, updated, intro, sections }: LegalPageProps): JSX.Element {
  return (
    <Page title={title} breadcrumb={title}>
      <p style={{ color: theme.color.muted, fontSize: theme.type.scale[1], margin: 0 }}>
        {updated}
      </p>
      <p
        style={{
          color: theme.color.text,
          fontSize: theme.type.scale[3],
          maxWidth: '44rem',
          marginTop: theme.space.sm
        }}
      >
        {intro}
      </p>
      {sections.map((s) => (
        <section key={s.heading} style={{ maxWidth: '44rem', marginTop: theme.space.xl }}>
          <h2 style={{ fontSize: theme.type.scale[3], margin: 0 }}>{s.heading}</h2>
          <p
            style={{
              color: theme.color.muted,
              fontSize: theme.type.scale[2],
              lineHeight: 1.7,
              marginTop: theme.space.sm
            }}
          >
            {linkifyText(s.body)}
          </p>
        </section>
      ))}
    </Page>
  );
}
