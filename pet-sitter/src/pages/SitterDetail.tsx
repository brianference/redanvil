import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { fetchSitterDetail, type ReviewSummary, type SitterSummary } from '../lib/api';
import { en } from '../i18n/en';

/**
 * Sitter detail with reviews and external source link when present.
 */
export function SitterDetail(): JSX.Element {
  const { id } = useParams<{ id: string }>();
  const [sitter, setSitter] = useState<SitterSummary | null>(null);
  const [reviews, setReviews] = useState<ReviewSummary[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'not-found' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) {
      setStatus('not-found');
      return;
    }
    let cancelled = false;
    setStatus('loading');
    void fetchSitterDetail(id)
      .then((data) => {
        if (cancelled) return;
        setSitter(data.sitter);
        setReviews(data.reviews);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof Error && err.message === 'not-found') {
          setStatus('not-found');
          return;
        }
        setError(err instanceof Error ? err.message : en.detail.loadError);
        setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (status === 'loading') {
    return (
      <Page title={en.detail.loadingTitle}>
        <p className="state">{en.home.loading}</p>
      </Page>
    );
  }

  if (status === 'not-found') {
    return (
      <Page title={en.detail.notFoundTitle}>
        <p className="state state--empty">{en.detail.notFound}</p>
        <p>
          <Link to="/sitters">{en.detail.backToList}</Link>
        </p>
      </Page>
    );
  }

  if (status === 'error' || !sitter) {
    return (
      <Page title={en.detail.errorTitle}>
        <p className="state state--error" role="alert">
          {error ?? en.detail.loadError}
        </p>
      </Page>
    );
  }

  return (
    <Page title={sitter.name}>
      <div className="detail">
        <p className="detail__meta">
          {sitter.neighbourhood} · ${sitter.rate_per_night}
          {en.home.perNight} · {sitter.verified_reviews} {en.home.reviews}
        </p>
        <p className="detail__pets">
          <strong>{en.detail.petTypes}:</strong> {sitter.pet_types}
        </p>
        {sitter.available_from && sitter.available_to ? (
          <p className="detail__avail">
            <strong>{en.detail.availability}:</strong> {sitter.available_from} →{' '}
            {sitter.available_to}
          </p>
        ) : null}
        <p className="detail__bio">{sitter.bio}</p>
        {sitter.source_url ? (
          <p className="detail__source">
            <a href={sitter.source_url} rel="noopener noreferrer" target="_blank">
              {en.detail.sourceLink}
            </a>
          </p>
        ) : null}

        <h2>{en.detail.reviewsHeading}</h2>
        {reviews.length === 0 ? (
          <p className="state state--empty">{en.detail.noReviews}</p>
        ) : (
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r.id} className="review-list__item">
                <p className="review-list__rating">
                  {en.detail.rating}: {r.rating}/5
                </p>
                <p>{r.body}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="detail__back">
          <Link to="/sitters">{en.detail.backToList}</Link>
        </p>
      </div>
    </Page>
  );
}
