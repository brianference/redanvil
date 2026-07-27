import { Page } from '../components/Page';
import { ExampleStory } from '../components/examples/ExampleStory';
import { en } from '../i18n/en';
import { EXAMPLES } from '../lib/examples';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/**
 * Examples: one prompt, followed all the way to a deployed app.
 *
 * Every frame is a real screenshot of a real deployment, captured against
 * production by `capture_example.mjs`. Nothing here is a mockup.
 */
export function Examples(): JSX.Element {
  const copy = en.pages.examples;
  useDocumentMeta({
    title: `${copy.title} · RedAnvil`,
    description: copy.intro.slice(0, 160),
    path: '/examples'
  });

  return (
    <Page title={copy.title} subtitle={copy.intro} breadcrumb={copy.title}>
      {EXAMPLES.map((example) => (
        <ExampleStory key={example.slug} example={example} />
      ))}
    </Page>
  );
}
