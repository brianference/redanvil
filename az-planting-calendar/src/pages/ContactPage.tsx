import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** Contact — how to report sourced-data issues. */
export function ContactPage() {
  useDocumentMeta(en.meta.contactTitle, en.meta.contactDescription);
  return (
    <article className="prose shell">
      <h1>{en.contact.title}</h1>
      {en.contact.body.map((p) => (
        <p key={p.slice(0, 48)}>{p}</p>
      ))}
    </article>
  );
}
