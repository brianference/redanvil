import type { FormEvent } from 'react';
import { en } from '../../i18n/en';

export interface CompactSearchFieldProps {
  /** Unique input id for the page. */
  inputId: string;
  /** Current draft query text. */
  value: string;
  /** Draft change handler. */
  onChange: (value: string) => void;
  /** Form submit handler. */
  onSubmit: (event: FormEvent) => void;
  /** Optional form test id. */
  formTestId?: string;
  /** Input placeholder. */
  placeholder: string;
  /** Submit button label (visible). */
  submitLabel: string;
  /** Optional extra class on the form. */
  formClassName?: string;
  /** Optional extra class on the input. */
  inputClassName?: string;
  /** Optional extra class on the submit button. */
  buttonClassName?: string;
}

/**
 * Compact text search: sr-only label, search input, submit button.
 * Used by Map and Dates overlays (Photos owns a multi-field capsule instead).
 *
 * @param props - Controlled field + form chrome.
 */
export function CompactSearchField({
  inputId,
  value,
  onChange,
  onSubmit,
  formTestId,
  placeholder,
  submitLabel,
  formClassName = '',
  inputClassName = '',
  buttonClassName = ''
}: CompactSearchFieldProps): JSX.Element {
  return (
    <form
      className={formClassName}
      role="search"
      onSubmit={onSubmit}
      data-testid={formTestId}
      aria-label={en.home.searchLabel}
    >
      <label className="sr-only" htmlFor={inputId}>
        {en.home.searchLabel}
      </label>
      <input
        id={inputId}
        type="search"
        name="q"
        className={inputClassName}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="off"
        data-testid="filter-search"
        aria-label={en.home.searchLabel}
      />
      <button type="submit" className={buttonClassName} aria-label={en.home.searchSubmit}>
        {submitLabel}
      </button>
    </form>
  );
}
