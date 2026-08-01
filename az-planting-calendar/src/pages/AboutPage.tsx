import { LegalPage } from '../components/LegalPage';
import { useDocumentMeta } from '../hooks/useDocumentMeta';
import { en } from '../i18n/en';
import './ProsePage.css';

/** About page with real content for this app. */
export function AboutPage() {
  useDocumentMeta(en.meta.aboutTitle, en.meta.aboutDescription);
  return (
    <LegalPage
      title={en.about.title}
      intro={en.about.intro}
      updated={en.about.updated}
      sections={en.about.sections}
      after={
        <p>
          <a
            href="https://extension.arizona.edu/publication/vegetable-planting-calendar-maricopa-county"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vegetable Planting Calendar for Maricopa County (UA Extension)
          </a>
        </p>
      }
    />
  );
}
