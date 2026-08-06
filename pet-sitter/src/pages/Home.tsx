import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/** Home page. Copy lives in the locale bundle (fe-i18n-central-copy). */
export function Home(): JSX.Element {
  return <DocPage doc={en.pages.home} />;
}
