import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Page } from '../components/Page';
import { PetTypePills } from '../components/PetTypePills';
import { SafeExternalLink } from '../components/SafeExternalLink';
import { SitterAvatar } from '../components/SitterAvatar';
import { SitterRating } from '../components/SitterRating';
import { fetchSitterDetail, type ReviewSummary, type SitterSummary } from '../lib/api';
import { en } from '../i18n/en';

/**
 * Sitter detail with avatar, rating from review rows, reviews, and source link.
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

  const avgFromReviews = useMemo(() => {
    if (reviews.length === 0) return null;
    const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
    return sum / reviews.length;
  }, [reviews]);

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

  const avgRating = sitter.avg_rating ?? avgFromReviews;

  return (
    <Page title={sitter.name}>
      <div className="detail">
        <div className="detail__hero">
          <SitterAvatar sitterId={sitter.id} name={sitter.name} className="detail__avatar" />
          <div className="detail__intro">
            <p className="detail__meta">
              {sitter.neighbourhood} · ${sitter.rate_per_night}
              {en.home.perNight}
            </p>
            <SitterRating avgRating={avgRating} reviewCount={sitter.verified_reviews} />
            <PetTypePills petTypes={sitter.pet_types} />
          </div>
        </div>
        {sitter.available_from && sitter.available_to ? (
          <p className="detail__avail">
            <strong>{en.detail.availability}:</strong> {sitter.available_from} →{' '}
            {sitter.available_to}
          </p>
        ) : null}
        <p className="detail__bio">{sitter.bio}</p>
        {sitter.source_url ? (
          <p className="detail__source">
            <SafeExternalLink href={sitter.source_url} data-testid="sitter-source-link">
              {en.detail.sourceLink}
            </SafeExternalLink>
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
