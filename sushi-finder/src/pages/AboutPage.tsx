import { Breadcrumbs } from '../components/Breadcrumbs';
import { en } from '../i18n/en';

/** About page — product facts, how it works, coverage boundary. */
export function AboutPage(): JSX.Element {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.nav.about }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{en.about.title}</h1>
        <div className="prose">
          <p>{en.about.body}</p>
          <p>{en.brand.tagline}</p>
          <h2>{en.about.howTitle}</h2>
          <p>{en.about.howBody}</p>
          <h2>{en.about.coverageTitle}</h2>
          <p>{en.about.coverageBody}</p>
          <h2>{en.about.publicTitle}</h2>
          <p>{en.about.publicBody}</p>
        </div>
      </main>
    </>
  );
}
