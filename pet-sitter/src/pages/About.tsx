import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/** About page. Copy lives in the locale bundle (fe-i18n-central-copy). */
export function About(): JSX.Element {
  return <DocPage doc={en.pages.about} />;
}
