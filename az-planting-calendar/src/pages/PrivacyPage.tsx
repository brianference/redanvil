import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** Privacy — no cookie boilerplate for cookies we do not set. */
export function PrivacyPage() {
  useDocumentMeta(en.meta.privacyTitle, en.meta.privacyDescription);
  return (
    <article className="prose shell">
      <h1>{en.privacy.title}</h1>
      {en.privacy.body.map((p) => (
        <p key={p.slice(0, 48)}>{p}</p>
      ))}
    </article>
  );
}
