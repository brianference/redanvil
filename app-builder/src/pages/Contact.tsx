import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** Contact page. */
export function Contact(): JSX.Element {
  return (
    <Page title={en.pages.contact.title}>
      <p>{en.pages.contact.body}</p>
    </Page>
  );
}
