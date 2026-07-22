import { Page } from '../components/Page';
import { en } from '../i18n/en';

/** About page. */
export function About(): JSX.Element {
  return (
    <Page title={en.pages.about.title} breadcrumb={en.pages.about.title}>
      <p>{en.pages.about.body}</p>
    </Page>
  );
}
