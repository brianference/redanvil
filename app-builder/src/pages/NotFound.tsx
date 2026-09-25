import { Page } from '../components/Page';
import { NotFoundMessage } from '../components/NotFoundMessage';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/**
 * Catch-all page for an unrecognised URL, so a mistyped link lands on a page
 * with the header, a heading and a way home rather than an empty document.
 *
 * @returns The 404 page inside the normal shell.
 */
export function NotFound(): JSX.Element {
  const copy = en.pages.notFound;
  useDocumentMeta({ title: `${copy.title} · RedAnvil`, description: copy.body, path: '/404' });
  return (
    <Page title={copy.title} breadcrumb={copy.title}>
      <NotFoundMessage />
    </Page>
  );
}
