import { ContentSections } from '../components/ContentSections';
import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Contact page: how to reach the project via GitHub issues. */
export function Contact(): JSX.Element {
  const page = en.pages.contact;
  return (
    <Page title={page.title} breadcrumb={page.title}>
      <ContentSections intro={page.intro} sections={page.sections} />
    </Page>
  );
}
