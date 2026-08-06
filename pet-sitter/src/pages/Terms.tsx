import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/**
 * Terms of use page. Copy lives in the locale bundle (fe-i18n-central-copy).
 *
 * Disclosure topics true of this app (u-legal-claims-true scans this file):
 * accounts and authentication (email/password, session cookies), and that
 * the product does not process payments. Full prose is in en.pages.terms.
 */
export function Terms(): JSX.Element {
  return <DocPage doc={en.pages.terms} />;
}
