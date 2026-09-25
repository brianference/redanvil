import { useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { ExampleFilterBar } from '../components/examples/ExampleFilterBar';
import { ExampleGrid } from '../components/examples/ExampleGrid';
import { en } from '../i18n/en';
import { EXAMPLES } from '../lib/examples';
import { useDocumentMeta } from '../lib/useDocumentMeta';

/**
 * Examples as a card catalog: filter chips + equal magazine cards.
 * Each card expands into a measured "What it does" breakdown.
 */
export function Examples(): JSX.Element {
  const copy = en.pages.examples;
  useDocumentMeta({
    title: `${copy.title} · RedAnvil`,
    description: copy.intro.slice(0, 160),
    path: '/examples'
  });

  const [filter, setFilter] = useState<string>('All');

  const visible = useMemo(() => {
    if (filter === 'All') return EXAMPLES;
    return EXAMPLES.filter((ex) => ex.categories.includes(filter));
  }, [filter]);

  return (
    <Page title={copy.title} subtitle={copy.intro} breadcrumb={copy.title}>
      <div className="ex-catalog">
        <ExampleFilterBar shippedCount={EXAMPLES.length} filter={filter} onFilter={setFilter} />
        <ExampleGrid examples={visible} />
      </div>
    </Page>
  );
}
