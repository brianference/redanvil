import { LegalPage } from '../components/LegalPage';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** Privacy — no cookie boilerplate for cookies we do not set. */
export function PrivacyPage() {
  useDocumentMeta(en.meta.privacyTitle, en.meta.privacyDescription);
  return (
    <LegalPage
      title={en.privacy.title}
      intro={en.privacy.intro}
      updated={en.privacy.updated}
      sections={en.privacy.sections}
    />
  );
}
