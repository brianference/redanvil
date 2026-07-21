import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';

/** About page. */
export function About(): JSX.Element {
  const p = en.pages.about;
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
