import { LegalPage } from '../components/LegalPage';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** Terms of use — specific to this planting calendar. */
export function TermsPage() {
  useDocumentMeta(en.meta.termsTitle, en.meta.termsDescription);
  return (
    <LegalPage
      title={en.terms.title}
      intro={en.terms.intro}
      updated={en.terms.updated}
      sections={en.terms.sections}
    />
  );
}
