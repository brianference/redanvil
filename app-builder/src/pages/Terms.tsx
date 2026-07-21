import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';

/** Terms and Conditions page. */
export function Terms(): JSX.Element {
  const p = en.pages.terms;
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
