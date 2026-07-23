import { ContentSections } from '../components/ContentSections';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Terms of use for the free, read-only dashboard. */
export function Terms(): JSX.Element {
  const page = en.pages.terms;
  useDocumentMeta({
    title: `Terms · RedAnvil Dashboard`,
    description: page.intro.slice(0, 160),
    path: '/terms'
  });
  return (
    <Page title={page.title} breadcrumb={page.title}>
      <ContentSections intro={page.intro} updated={page.updated} sections={page.sections} />
    </Page>
  );
}
