import { DocPage } from '../components/DocPage';
import { en } from '../i18n/en';

/**
 * Privacy Policy page. Copy lives in the locale bundle (fe-i18n-central-copy).
 *
 * Disclosure topics true of this app (u-legal-claims-true scans this file):
 * cookies (session cookies after sign-in), accounts/authentication (register,
 * sign-in, HMAC sessions), and email collection (registration email address).
 * Full prose is in en.pages.privacy and is rendered by DocPage for readers.
 */
export function Privacy(): JSX.Element {
  return <DocPage doc={en.pages.privacy} />;
}
