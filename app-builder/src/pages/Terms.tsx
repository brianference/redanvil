import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Terms and Conditions page. */
export function Terms(): JSX.Element {
  const p = en.pages.terms;
  useDocumentMeta({
    title: `Terms · RedAnvil`,
    description: p.intro.slice(0, 160),
    path: '/terms'
  });
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
