import { en } from '../i18n/en';

export interface SitterRatingProps {
  /** Average rating from review rows, or null when no review row exists. */
  avgRating: number | null;
  /** Display review count (verified_reviews seed column). */
  reviewCount: number;
  /** Optional extra class names. */
  className?: string;
}

/**
 * Stars + score when review rows exist; otherwise "Verified" + count.
 * Never invents a star score without a real review average.
 *
 * @param props - Rating inputs from API / seed.
 */
export function SitterRating({
  avgRating,
  reviewCount,
  className
}: SitterRatingProps): JSX.Element {
  if (avgRating == null) {
    return (
      <span
        className={className ? `rating ${className}` : 'rating'}
        aria-label={`${reviewCount} ${en.home.reviews}, verified`}
      >
        <span className="rating__score">{en.home.verified}</span>
        <span className="rating__count">
          · {reviewCount} {en.home.reviews}
        </span>
      </span>
    );
  }

  const rounded = Math.round(avgRating * 10) / 10;
  const full = Math.min(5, Math.max(0, Math.floor(rounded)));
  const stars = `${'★'.repeat(full)}${'☆'.repeat(5 - full)}`;

  return (
    <span
      className={className ? `rating ${className}` : 'rating'}
      aria-label={`${rounded.toFixed(1)} out of 5, ${reviewCount} ${en.home.reviews}`}
    >
      <span className="rating__stars" aria-hidden="true">
        {stars}
      </span>
      <span className="rating__score">{rounded.toFixed(1)}</span>
      <span className="rating__count">
        · {reviewCount} {en.home.reviews}
      </span>
    </span>
  );
}
