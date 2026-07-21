import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';

/** Privacy Policy page. */
export function Privacy(): JSX.Element {
  const p = en.pages.privacy;
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
