import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { en } from '../i18n/en';
import { theme } from '../theme';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { TOUCH_TARGET_MIN_PX } from '../components/shell/constants';

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
      <p style={{ color: theme.color.muted, fontSize: theme.type.scale[3], margin: 0 }}>
        {copy.body}
      </p>
      {/* A standalone CTA, not a link inside a sentence, so WCAG 2.5.8's
          inline-text exemption does not apply and it has to carry a real 44px
          target. The first version was an inline-block with no padding and the
          audit failed it at 24px. */}
      <Link
        to="/"
        style={{
          color: theme.color.accent,
          fontWeight: 600,
          fontSize: theme.type.scale[2],
          display: 'inline-flex',
          alignItems: 'center',
          minHeight: TOUCH_TARGET_MIN_PX,
          padding: `0 ${theme.space.md}px`,
          border: `1px solid ${theme.color.border}`,
          borderRadius: theme.radius.md,
          textDecoration: 'none',
          marginTop: theme.space.lg
        }}
      >
        {copy.home}
      </Link>
    </Page>
  );
}
