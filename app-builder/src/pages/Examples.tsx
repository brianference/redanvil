import { useMemo, useState } from 'react';
import { Page } from '../components/Page';
import { ExampleCard } from '../components/examples/ExampleCard';
import { en } from '../i18n/en';
import { EXAMPLE_FILTERS, EXAMPLES } from '../lib/examples';
import { useDocumentMeta } from '../lib/useDocumentMeta';
import { theme } from '../theme';

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
        <div className="ex-catalog__bar">
          <p className="ex-catalog__count" style={{ margin: 0, color: theme.color.muted }}>
            {copy.shippedCount(EXAMPLES.length)}
          </p>
          <div
            className="ex-catalog__filters"
            role="group"
            aria-label={copy.filtersLabel}
          >
            {EXAMPLE_FILTERS.map((chip) => {
              const on = chip === filter;
              return (
                <button
                  key={chip}
                  type="button"
                  className={on ? 'ex-chip ex-chip--on' : 'ex-chip'}
                  aria-pressed={on}
                  onClick={() => setFilter(chip)}
                  data-testid="example-filter"
                  data-filter={chip}
                >
                  {chip}
                </button>
              );
            })}
          </div>
        </div>

        {visible.length === 0 ? (
          <p role="status" style={{ color: theme.color.muted }}>
            {copy.filterEmpty}
          </p>
        ) : (
          <div className="ex-catalog__grid">
            {visible.map((example) => (
              <ExampleCard key={example.slug} example={example} />
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}
