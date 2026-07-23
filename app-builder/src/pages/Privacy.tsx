import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Privacy Policy page. */
export function Privacy(): JSX.Element {
  const p = en.pages.privacy;
  useDocumentMeta({
    title: `Privacy · RedAnvil`,
    description: p.intro.slice(0, 160),
    path: '/privacy'
  });
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
