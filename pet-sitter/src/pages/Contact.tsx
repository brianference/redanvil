import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/** Contact page. Copy lives in the locale bundle (fe-i18n-central-copy). */
export function Contact(): JSX.Element {
  return <DocPage doc={en.pages.contact} />;
}
