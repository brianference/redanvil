import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/** Privacy page. Copy lives in the locale bundle (fe-i18n-central-copy). */
export function Privacy(): JSX.Element {
  return <DocPage doc={en.pages.privacy} />;
}
