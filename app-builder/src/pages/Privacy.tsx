import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Privacy page. */
export function Privacy(): JSX.Element {
  return (
    <Page title={en.pages.privacy.title}>
      <p>{en.pages.privacy.body}</p>
    </Page>
  );
}
