import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** Terms of use — specific to this planting calendar. */
export function TermsPage() {
  useDocumentMeta(en.meta.termsTitle, en.meta.termsDescription);
  return (
    <article className="prose shell">
      <h1>{en.terms.title}</h1>
      {en.terms.body.map((p) => (
        <p key={p.slice(0, 48)}>{p}</p>
      ))}
    </article>
  );
}
