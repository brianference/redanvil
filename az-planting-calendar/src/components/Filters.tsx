import { en } from '../i18n/en';
import type { Method } from '../lib/schemas';
import './Filters.css';

export interface FiltersState {
  method: Method | '';
  month: number | '';
  date: string;
}

interface FiltersProps {
  value: FiltersState;
  onChange: (next: FiltersState) => void;
  showDate?: boolean;
}

/**
 * Method + month (+ optional date) filters for plantable list and grid.
 */
export function Filters({ value, onChange, showDate = true }: FiltersProps) {
  return (
    <section className="filters" aria-label={en.filters.title} data-testid="filters">
      <h2 className="filters__title">{en.filters.title}</h2>
      <div className="filters__row">
        {showDate ? (
          <label className="filters__field">
            <span className="filters__label">{en.filters.date}</span>
            <input
              type="date"
              className="filters__control mono"
              value={value.date}
              onChange={(e) => onChange({ ...value, date: e.target.value })}
              data-testid="filter-date"
            />
          </label>
        ) : null}
        <label className="filters__field">
          <span className="filters__label">{en.filters.method}</span>
          <select
            className="filters__control"
            value={value.method}
            onChange={(e) =>
              onChange({
                ...value,
                method: e.target.value as Method | ''
              })
            }
            data-testid="filter-method"
          >
            <option value="">{en.filters.methodAll}</option>
            <option value="S">{en.filters.methodSeed}</option>
            <option value="T">{en.filters.methodTransplant}</option>
          </select>
        </label>
        <label className="filters__field">
          <span className="filters__label">{en.filters.month}</span>
          <select
            className="filters__control"
            value={value.month === '' ? '' : String(value.month)}
            onChange={(e) => {
              const v = e.target.value;
              onChange({
                ...value,
                month: v === '' ? '' : Number(v)
              });
            }}
            data-testid="filter-month"
          >
            <option value="">{en.filters.monthAll}</option>
            {en.filters.months.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="filters__clear"
          onClick={() => onChange({ method: '', month: '', date: value.date })}
          data-testid="filter-clear"
        >
          {en.filters.clear}
        </button>
      </div>
    </section>
  );
}
