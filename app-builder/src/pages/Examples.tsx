import { useMemo, useState, type CSSProperties } from 'react';
import { Page } from '../components/Page';
import { ExampleCard } from '../components/examples/ExampleCard';
import { FilterChips } from '../components/examples/FilterChips';
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
          <p className="ex-catalog__count" style={countStyle}>
            {copy.shippedCount(EXAMPLES.length)}
          </p>
          <FilterChips
            options={EXAMPLE_FILTERS}
            selected={filter}
            onSelect={setFilter}
            label={copy.filtersLabel}
          />
        </div>

        {visible.length === 0 ? (
          <p role="status" style={mutedStyle}>
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

const mutedStyle: CSSProperties = { color: theme.color.muted };

const countStyle: CSSProperties = { ...mutedStyle, margin: 0 };
