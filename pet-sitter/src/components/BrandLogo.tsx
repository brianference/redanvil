import { Link } from 'react-router-dom';
import { en } from '../i18n/en';

export interface BrandLogoProps {
  /** Optional class on the link. */
  className?: string;
  /** Optional class on the mark image. */
  markClassName?: string;
  /** Optional class on the wordmark. */
  nameClassName?: string;
}

/**
 * Real brand mark (PNG) plus app name for the sticky header.
 * Mark is sized in CSS so fe-brand-mark-size can measure a real height.
 */
export function BrandLogo({
  className,
  markClassName,
  nameClassName
}: BrandLogoProps): JSX.Element {
  return (
    <Link to="/" className={className ?? 'brand'} data-testid="brand" aria-label={en.app.name}>
      <img
        src="/brand-mark.png"
        alt=""
        width={56}
        height={56}
        className={markClassName ?? 'brand__mark'}
        data-testid="brand-mark"
        data-measure="mark"
      />
      <span className={nameClassName ?? 'brand__name'}>{en.app.name}</span>
    </Link>
  );
}
