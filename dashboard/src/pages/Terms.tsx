import { ContentSections } from '../components/ContentSections';
import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Terms of use for the free, read-only dashboard. */
export function Terms(): JSX.Element {
  const page = en.pages.terms;
  return (
    <Page title={page.title} breadcrumb={page.title}>
      <ContentSections intro={page.intro} updated={page.updated} sections={page.sections} />
    </Page>
  );
}
