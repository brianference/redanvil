import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Terms page. */
export function Terms(): JSX.Element {
  return (
    <Page title={en.pages.terms.title} breadcrumb={en.pages.terms.title}>
      <p>{en.pages.terms.body}</p>
    </Page>
  );
}
