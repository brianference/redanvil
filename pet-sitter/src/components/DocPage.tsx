import { Page } from './Page';

/** A headed section of a document. */
export interface DocSection {
  readonly heading: string;
  readonly body: string;
  readonly items?: readonly string[];
}

/** A complete document: intro, sections, last-updated date. */
export interface Doc {
  readonly title: string;
  readonly intro: string;
  readonly sections: readonly DocSection[];
  readonly updated: string;
}

export interface DocPageProps {
  /** The document to render. */
  doc: Doc;
}

/** Renders a document as real headed sections rather than one paragraph. */
export function DocPage({ doc }: DocPageProps): JSX.Element {
  return (
    <Page title={doc.title}>
      <p className="page-intro">{doc.intro}</p>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          <p>{section.body}</p>
          {section.items === undefined ? null : (
            <ul>
              {section.items.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="page-updated">Last updated: {doc.updated}</p>
    </Page>
  );
}
