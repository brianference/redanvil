import { ContentSections } from '../components/ContentSections';
import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Privacy notice: no personal data, no tracking cookies on the dashboard. */
export function Privacy(): JSX.Element {
  const page = en.pages.privacy;
  return (
    <Page title={page.title} breadcrumb={page.title}>
      <ContentSections intro={page.intro} updated={page.updated} sections={page.sections} />
    </Page>
  );
}
