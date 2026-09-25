export interface FilterChipsProps {
  /** Chip labels, in display order. */
  options: readonly string[];
  /** The label currently applied. */
  selected: string;
  /** Apply another label. */
  onSelect: (option: string) => void;
  /** Accessible name for the group. */
  label: string;
}

/**
 * Single-select toggle chips. Each is a button with aria-pressed, so a screen
 * reader hears which filter is on.
 *
 * @param props - Options, the selected one, the change handler and the group label.
 * @returns The chip group.
 */
export function FilterChips({ options, selected, onSelect, label }: FilterChipsProps): JSX.Element {
  return (
    <div className="ex-catalog__filters" role="group" aria-label={label}>
      {options.map((option) => {
        const on = option === selected;
        return (
          <button
            key={option}
            type="button"
            className={on ? 'ex-chip ex-chip--on' : 'ex-chip'}
            aria-pressed={on}
            onClick={() => onSelect(option)}
            data-testid="example-filter"
            data-filter={option}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
