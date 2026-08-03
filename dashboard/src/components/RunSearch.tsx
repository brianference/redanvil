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
 * Filter runs by slug against a (already-trimmed, lowercased) query.
 * Empty query matches everything.
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
    <div style={toolbarStyle}>
      <label htmlFor="run-search" style={{ display: 'none' }}>
        {en.pages.home.searchLabel}
      </label>
      <input
        id="run-search"
        type="search"
        role="searchbox"
        value={value}
        onChange={handleChange}
        placeholder={en.pages.home.searchPlaceholder}
        aria-label={en.pages.home.searchLabel}
        style={inputStyle}
      />
    </div>
  );
}
