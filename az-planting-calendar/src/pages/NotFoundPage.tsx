import { Link } from 'react-router-dom';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** 404. */
export function NotFoundPage() {
  useDocumentMeta(`${en.notFound.title} — ${en.appName}`, en.notFound.body);
  return (
    <article className="prose shell">
      <h1>{en.notFound.title}</h1>
      <p>{en.notFound.body}</p>
      <p>
        <Link to="/">{en.notFound.home}</Link>
      </p>
    </article>
  );
}
