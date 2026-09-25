import type { CSSProperties } from 'react';
import { en } from '../../i18n/en';
import { EXAMPLE_FILTERS } from '../../lib/examples';
import { theme } from '../../theme';
import { FilterChips } from './FilterChips';

export interface ExampleFilterBarProps {
  /** How many apps have shipped, shown before the chips. */
  shippedCount: number;
  /** The active filter chip. */
  filter: string;
  /** Select a filter chip. */
  onFilter: (filter: string) => void;
}

/**
 * Shipped-app count and the category chips that filter the catalog.
 *
 * @param props - Count, active filter and change handler.
 * @returns The catalog's filter bar.
 */
export function ExampleFilterBar({ shippedCount, filter, onFilter }: ExampleFilterBarProps): JSX.Element {
  const copy = en.pages.examples;
  return (
    <div className="ex-catalog__bar">
      <p className="ex-catalog__count" style={countStyle}>
        {copy.shippedCount(shippedCount)}
      </p>
      <FilterChips
        options={EXAMPLE_FILTERS}
        selected={filter}
        onSelect={onFilter}
        label={copy.filtersLabel}
      />
    </div>
  );
}

const countStyle: CSSProperties = { margin: 0, color: theme.color.muted };
