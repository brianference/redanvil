import { ContentSections } from '../components/ContentSections';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** About page: what RedAnvil is and what this dashboard shows. */
export function About(): JSX.Element {
  const page = en.pages.about;
  useDocumentMeta({
    title: `${page.title} · RedAnvil Dashboard`,
    description: page.intro.slice(0, 160),
    path: '/about'
  });
  return (
    <Page title={page.title} breadcrumb={page.title}>
      <ContentSections intro={page.intro} sections={page.sections} />
    </Page>
  );
}
