import { Page } from '../components/Page';
import { StatusNote } from '../components/FeedStatus';
import { BackToRunsLink } from '../components/runDetail/BackToRunsLink';
import { en } from '../i18n/en';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/**
 * Catch-all page for an unrecognised URL.
 *
 * Without it the router matched nothing and rendered an empty document — no
 * header, no heading, no way back — so a typo'd URL looked like a broken site
 * rather than a missing page. The design audit found it by measuring a route
 * that turned out not to exist, which is the more useful half of the story: the
 * failure mode was invisible precisely because nothing linked to a bad URL.
 *
 * @returns The 404 page inside the normal shell.
 */
export function NotFound(): JSX.Element {
  const copy = en.pages.notFound;
  useDocumentMeta({
    title: `${copy.title} · RedAnvil dashboard`,
    description: copy.body,
    path: '/404'
  });
  return (
    <Page title={copy.title} breadcrumb={copy.title}>
      <StatusNote>{copy.body}</StatusNote>
      <BackToRunsLink label={copy.home} />
    </Page>
  );
}
