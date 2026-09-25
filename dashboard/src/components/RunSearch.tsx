import type { ChangeEvent, CSSProperties } from 'react';
import { en } from '../i18n/en';
import { theme } from '../theme';

export interface RunSearchProps {
  /** Current search query (controlled). */
  value: string;
  /** Called with the new query on every keystroke. */
  onChange: (value: string) => void;
}

const toolbarStyle: CSSProperties = {
  marginBottom: theme.space.sm,
  fontFamily: theme.type.family
};

const inputStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: theme.touch,
  borderRadius: theme.radius.md,
  border: `1px solid ${theme.color.border}`,
  background: theme.color.surface,
  color: theme.color.text,
  padding: `0 ${theme.space.md}px`,
  fontSize: theme.type.scale[2],
  fontFamily: theme.type.family
};

/**
 * Whether a run slug matches the visitor's raw query: trimmed, case-insensitive
 * substring. A blank query matches everything.
 *
 * @param slug - Run slug.
 * @param query - Raw query as typed.
 * @returns True when the slug contains the normalised query.
 */
export function matchesRunQuery(slug: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return true;
  return slug.toLowerCase().includes(q);
}

/**
 * Toolbar search input for the run list (option 1 from
 * design-refs/search-options/DECISION.md): a dedicated row between the KPI
 * band and the list, narrowing the run list by slug as the visitor types.
 */
export function RunSearch({ value, onChange }: RunSearchProps): JSX.Element {
  /**
   * Forward the raw input value to the controlled query.
   */
  function handleChange(event: ChangeEvent<HTMLInputElement>): void {
    onChange(event.target.value);
  }

  return (
    <div style={toolbarStyle} data-testid="live-search">
      {/* Visually hidden, not display:none: a display:none label never reaches
          the accessibility tree, so it named nothing. type="search" already
          carries the searchbox role. */}
      <label htmlFor="run-search" className="ra-visually-hidden">
        {en.pages.home.searchLabel}
      </label>
      <input
        id="run-search"
        type="search"
        value={value}
        onChange={handleChange}
        placeholder={en.pages.home.searchPlaceholder}
        style={inputStyle}
        data-testid="filter-search"
      />
    </div>
  );
}
