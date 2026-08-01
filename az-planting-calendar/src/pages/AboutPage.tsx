import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** About page with real content for this app. */
export function AboutPage() {
  useDocumentMeta(en.meta.aboutTitle, en.meta.aboutDescription);
  return (
    <article className="prose shell">
      <h1>{en.about.title}</h1>
      {en.about.body.map((p) => (
        <p key={p.slice(0, 48)}>{p}</p>
      ))}
      <p>
        <a
          href="https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county"
          target="_blank"
          rel="noopener noreferrer"
        >
          Vegetable Planting Calendar for Maricopa County (UA Extension)
        </a>
      </p>
    </article>
  );
}
