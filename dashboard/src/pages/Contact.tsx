import { ContentSections } from '../components/ContentSections';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/** Contact page: how to reach the project via GitHub issues. */
export function Contact(): JSX.Element {
  const page = en.pages.contact;
  useDocumentMeta({
    title: `${page.title} · RedAnvil Dashboard`,
    description: page.intro.slice(0, 160),
    path: '/contact'
  });
  return (
    <Page title={page.title} breadcrumb={page.title}>
      <ContentSections intro={page.intro} sections={page.sections} />
    </Page>
  );
}
