import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Contact page. */
export function Contact(): JSX.Element {
  const p = en.pages.contact;
  useDocumentMeta({
    title: `${p.title} · RedAnvil`,
    description: p.intro.slice(0, 160),
    path: '/contact'
  });
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
