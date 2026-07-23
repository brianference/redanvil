import { LegalPage } from '../components/LegalPage';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** About page. */
export function About(): JSX.Element {
  const p = en.pages.about;
  useDocumentMeta({
    title: `${p.title} · RedAnvil`,
    description: p.intro.slice(0, 160),
    path: '/about'
  });
  return <LegalPage title={p.title} updated={p.updated} intro={p.intro} sections={p.sections} />;
}
