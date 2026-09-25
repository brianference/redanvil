import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import { EXAMPLE_FILTERS } from '../../lib/examples';
import { theme } from '../../theme';

export interface ExampleFilterBarProps {
  /** How many apps have shipped, shown before the chips. */
  shippedCount: number;
  /** The active filter chip. */
  filter: string;
  /** Select a filter chip. */
  onFilter: (filter: string) => void;
}

/**
 * Shipped-app count and the category chips that filter the catalog. Each chip
 * is a toggle button, so `aria-pressed` tells assistive tech which one is on.
 *
 * @param props - Count, active filter and change handler.
 */
export function ExampleFilterBar({ shippedCount, filter, onFilter }: ExampleFilterBarProps): JSX.Element {
  const copy = en.pages.examples;
  return (
    <div className="ex-catalog__bar">
      <p className="ex-catalog__count" style={countStyle}>
        {copy.shippedCount(shippedCount)}
      </p>
      <div className="ex-catalog__filters" role="group" aria-label={copy.filtersLabel}>
        {EXAMPLE_FILTERS.map((chip) => {
          const on = chip === filter;
          return (
            <button
              key={chip}
              type="button"
              className={on ? 'ex-chip ex-chip--on' : 'ex-chip'}
              aria-pressed={on}
              onClick={() => onFilter(chip)}
              data-testid="example-filter"
              data-filter={chip}
            >
              {chip}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const countStyle: CSSProperties = { margin: 0, color: theme.color.muted };
