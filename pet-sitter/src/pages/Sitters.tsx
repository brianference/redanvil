import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Page } from '../components/Page';
import { fetchSitters, type SitterSummary } from '../lib/api';
import { en } from '../i18n/en';

/**
 * Full sitters collection with text search that narrows results.
 */
export function Sitters(): JSX.Element {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [sitters, setSitters] = useState<SitterSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    void fetchSitters({ q: submitted || undefined })
      .then((data) => {
        if (cancelled) return;
        setSitters(data.sitters);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : en.sitters.loadError);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [submitted]);

  /**
   * Apply search.
   *
   * @param event - Form submit.
   */
  function onSearch(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <Page title={en.sitters.title}>
      <p className="page-intro">{en.sitters.intro}</p>
      <form className="search-bar" role="search" onSubmit={onSearch}>
        <label htmlFor="sitters-page-search" className="search-bar__label">
          {en.home.searchLabel}
        </label>
        <div className="search-bar__row">
          <input
            id="sitters-page-search"
            type="search"
            name="q"
            className="search-bar__input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={en.home.searchPlaceholder}
          />
          <button type="submit" className="search-bar__submit">
            {en.home.searchSubmit}
          </button>
        </div>
      </form>
      <p className="result-meta" aria-live="polite">
        {status === 'ready'
          ? `${sitters.length} ${en.home.resultCountLabel}`
          : en.home.loading}
      </p>
      {status === 'error' ? (
        <p className="state state--error" role="alert">
          {error}
        </p>
      ) : null}
      {status === 'ready' && sitters.length === 0 ? (
        <p className="state state--empty">{en.home.empty}</p>
      ) : null}
      {status === 'ready' && sitters.length > 0 ? (
        <ul className="sitter-grid" data-testid="sitter-list">
          {sitters.map((s) => (
            <li key={s.id} className="sitter-card">
              <Link to={`/sitters/${s.id}`} className="sitter-card__link">
                <h2 className="sitter-card__name">{s.name}</h2>
                <p className="sitter-card__meta">
                  {s.neighbourhood} · ${s.rate_per_night}
                  {en.home.perNight}
                </p>
                <p className="sitter-card__pets">{s.pet_types}</p>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </Page>
  );
}
