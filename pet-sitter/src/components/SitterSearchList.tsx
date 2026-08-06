/**
 * Shared sitter catalog search + result list (Home and Sitters pages).
 */
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchSitters, type SitterSummary } from '../lib/api';
import { en } from '../i18n/en';

export interface SitterSearchListProps {
  /** Optional intro paragraph above the search form. */
  intro: string;
  /** When true, show a link to the full sitters catalog. */
  showBrowseAll?: boolean;
  /** Form data-testid when the home probe needs a stable handle. */
  formTestId?: string;
  /** Search input id (must be unique per page). */
  inputId: string;
}

/**
 * Text search over sitters with live narrowing and loading/error/empty states.
 *
 * @param props - Page-specific labels and ids.
 */
export function SitterSearchList({
  intro,
  showBrowseAll = false,
  formTestId,
  inputId
}: SitterSearchListProps): JSX.Element {
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [sitters, setSitters] = useState<SitterSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setStatus('loading');
    setError(null);
    void fetchSitters({ q: submitted || undefined })
      .then((data) => {
        if (cancelled) return;
        setSitters(data.sitters);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : en.home.loadError);
        setSitters([]);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [submitted]);

  const countLabel = useMemo(() => {
    if (status === 'loading') return en.home.loading;
    if (status === 'error') return en.home.errorCount;
    return `${sitters.length} ${en.home.resultCountLabel}`;
  }, [sitters.length, status]);

  /**
   * Apply the text search.
   *
   * @param event - Form submit.
   */
  function onSearch(event: FormEvent): void {
    event.preventDefault();
    setSubmitted(query.trim());
  }

  return (
    <>
      <p className="page-intro">{intro}</p>

      <form
        className="search-bar"
        role="search"
        onSubmit={onSearch}
        data-testid={formTestId}
      >
        <label htmlFor={inputId} className="search-bar__label">
          {en.home.searchLabel}
        </label>
        <div className="search-bar__row">
          <input
            id={inputId}
            type="search"
            name="q"
            className="search-bar__input"
            placeholder={en.home.searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
          <button type="submit" className="search-bar__submit">
            {en.home.searchSubmit}
          </button>
        </div>
      </form>

      <p className="result-meta" data-testid="result-count" aria-live="polite">
        {countLabel}
      </p>

      {status === 'error' ? (
        <p className="state state--error" role="alert">
          {error ?? en.home.loadError}
        </p>
      ) : null}

      {status === 'loading' ? <p className="state">{en.home.loading}</p> : null}

      {status === 'ready' && sitters.length === 0 ? (
        <p className="state state--empty" data-testid="empty-sitters">
          {en.home.empty}
        </p>
      ) : null}

      {status === 'ready' && sitters.length > 0 ? (
        <ul className="sitter-grid" data-testid="sitter-list">
          {sitters.map((s) => (
            <li key={s.id} className="sitter-card">
              <Link to={`/sitters/${s.id}`} className="sitter-card__link">
                <h2 className="sitter-card__name">{s.name}</h2>
                <p className="sitter-card__meta">
                  {s.neighbourhood} · ${s.rate_per_night}
                  {en.home.perNight} · {s.verified_reviews} {en.home.reviews}
                </p>
                <p className="sitter-card__pets">{s.pet_types}</p>
                {showBrowseAll ? <p className="sitter-card__bio">{s.bio}</p> : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}

      {showBrowseAll ? (
        <p className="home-more">
          <Link to="/sitters">{en.home.browseAll}</Link>
        </p>
      ) : null}
    </>
  );
}
