import { Breadcrumbs } from '../components/Breadcrumbs';
import { en } from '../i18n/en';

/** Contact page — no outbound form; true for this public catalog. */
export function ContactPage(): JSX.Element {
  return (
    <>
      <Breadcrumbs
        items={[
          { label: en.brand.name, to: '/' },
          { label: en.nav.contact }
        ]}
      />
      <main id="main">
        <h1 className="page-title">{en.contact.title}</h1>
        <div className="prose">
          <p>{en.contact.body}</p>
          <p>
            <strong>{en.contact.emailLabel}:</strong> {en.contact.email}
          </p>
          <p>{en.contact.privacyHint}</p>
          <p>{en.contact.dataHint}</p>
        </div>
      </main>
    </>
  );
}
