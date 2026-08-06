import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/** Terms page. Copy lives in the locale bundle (fe-i18n-central-copy). */
export function Terms(): JSX.Element {
  return <DocPage doc={en.pages.terms} />;
}
