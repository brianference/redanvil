import type { ReactNode } from 'react';

/** One headed section on a legal or info page. */
export interface LegalSection {
  heading: string;
  body: string;
  items?: readonly string[];
}

export interface LegalPageProps {
  /** Page h1. */
  title: string;
  /** Lead paragraph under the h1. */
  intro: string;
  /** Last-updated line shown under the intro. */
  updated: string;
  /** Headed body sections (rendered as h2). */
  sections: readonly LegalSection[];
  /** Optional node after sections (e.g. external source link). */
  after?: ReactNode;
}

/**
 * Renders a prose legal/info page: h1, intro, updated line, then h2 sections.
 * Sections sit in a full-width multi-column grid so painted content fills desktop
 * viewports; each card keeps a readable column measure.
 *
 * @param props - Title, intro, updated line, and headed sections.
 */
export function LegalPage({ title, intro, updated, sections, after }: LegalPageProps) {
  return (
    <article className="prose shell" data-testid="legal-page">
      <header className="prose__header">
        <h1>{title}</h1>
        <p className="prose__intro">{intro}</p>
        <p className="prose__updated">{updated}</p>
      </header>
      <div className="prose__sections">
        {sections.map((section) => (
          <section key={section.heading} className="prose__section">
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
            {section.items !== undefined && section.items.length > 0 ? (
              <ul>
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </div>
      {after !== undefined ? <div className="prose__after">{after}</div> : null}
    </article>
  );
}
