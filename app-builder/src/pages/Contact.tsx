import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';

/** Contact page. */
export function Contact(): JSX.Element {
  const p = en.pages.contact;
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
