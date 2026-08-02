import { Link } from 'react-router-dom';
import { HALF_MONTH_LABELS } from '../lib/halfMonth';
import { en } from '../i18n/en';
import type { GridResponse } from '../lib/schemas';
import './YearGrid.css';

interface YearGridProps {
  data: GridResponse | null;
  loading: boolean;
  error: string | null;
  /** Distinct from empty: name search to /api/crops failed. */
  searchError?: string | null;
  /** Retry the failed crop name search. */
  onSearchRetry?: () => void;
}

/**
 * Full-year planting grid: crops × 24 half-months, scrollable at 375px.
 * Search API failure is a separate fail-closed alert -- never painted as empty.
 */
export function YearGrid({
  data,
  loading,
  error,
  searchError = null,
  onSearchRetry
}: YearGridProps) {
  const showSearchError = Boolean(searchError);
  // Empty-because-zero-matches only when search did not break.
  const showEmpty =
    Boolean(data) && !loading && !showSearchError && (data?.crops.length ?? 0) === 0;
  const showTable =
    Boolean(data) && !loading && !showSearchError && (data?.crops.length ?? 0) > 0;

  return (
    <section
      id="year-grid"
      className="year-grid shell"
      data-testid="year-grid"
      aria-labelledby="grid-title"
    >
      <div className="year-grid__intro">
        <h2 id="grid-title">{en.grid.title}</h2>
        <p>{en.grid.subtitle}</p>
        <p className="year-grid__legend mono">
          <span className="year-grid__leg year-grid__leg--s">{en.grid.legendS}</span>
          <span className="year-grid__leg year-grid__leg--t">{en.grid.legendT}</span>
          <span className="year-grid__leg">{en.grid.legendBoth}</span>
        </p>
      </div>

      {loading ? (
        <p role="status">{en.grid.loading}</p>
      ) : null}
      {error ? (
        <p role="alert">
          {en.grid.error} {error}
        </p>
      ) : null}

      {showSearchError ? (
        <div
          className="year-grid__search-error"
          role="alert"
          data-testid="grid-search-error"
        >
          <p>{en.grid.searchError}</p>
          {searchError ? <p className="mono">{searchError}</p> : null}
          {onSearchRetry ? (
            <button
              type="button"
              className="year-grid__search-retry"
              data-testid="grid-search-retry"
              onClick={onSearchRetry}
            >
              {en.grid.searchRetry}
            </button>
          ) : null}
        </div>
      ) : null}

      {showEmpty ? <p data-testid="grid-empty">{en.grid.empty}</p> : null}

      {showTable && data ? (
        <div className="year-grid__scroll" data-testid="grid-scroll">
          <table className="year-grid__table">
            <thead>
              <tr>
                <th scope="col" className="year-grid__sticky">
                  {en.grid.crop}
                </th>
                {HALF_MONTH_LABELS.map((label, i) => (
                  <th key={label} scope="col" className="year-grid__half mono">
                    <span className="year-grid__half-label">{label}</span>
                    <span className="year-grid__half-idx">{i}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.crops.map((row) => (
                <tr key={row.crop.id}>
                  <th scope="row" className="year-grid__sticky year-grid__crop">
                    <Link to={`/crop/${row.crop.id}`}>{row.crop.name}</Link>
                  </th>
                  {row.cells.map((cell) => {
                    const mark =
                      cell.methods.length === 0
                        ? ''
                        : cell.methods.length === 2
                          ? 'S/T'
                          : cell.methods[0] === 'S'
                            ? 'S'
                            : 'T';
                    const cls =
                      mark === 'S'
                        ? 'year-grid__cell year-grid__cell--s'
                        : mark === 'T'
                          ? 'year-grid__cell year-grid__cell--t'
                          : mark === 'S/T'
                            ? 'year-grid__cell year-grid__cell--both'
                            : 'year-grid__cell';
                    return (
                      <td
                        key={cell.half_month}
                        className={cls}
                        data-methods={mark || undefined}
                      >
                        <span className="mono">{mark}</span>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
