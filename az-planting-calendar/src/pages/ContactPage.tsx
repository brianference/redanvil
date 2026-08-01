import { LegalPage } from '../components/LegalPage';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** Contact — how to report sourced-data issues. */
export function ContactPage() {
  useDocumentMeta(en.meta.contactTitle, en.meta.contactDescription);
  return (
    <LegalPage
      title={en.contact.title}
      intro={en.contact.intro}
      updated={en.contact.updated}
      sections={en.contact.sections}
    />
  );
}
